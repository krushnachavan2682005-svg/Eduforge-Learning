import logging
import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import fitz

from app.config.settings import get_settings
from app.content_layout.models import LayoutCandidate
from app.content_layout.reading_order import ReadingOrderResolver
from app.database.repositories import RepositoryError
from app.image_ocr.candidate_selector import EmbeddedImageOcrCandidateSelector
from app.image_ocr.image_loader import EmbeddedImageLoader
from app.image_ocr.models import AcquiredImage, EmbeddedImageOcrCandidate
from app.image_ocr.ocr_engine import EmbeddedImageOcrEngine
from app.image_ocr.service import (
    EmbeddedImageOcrPersistenceError,
    EmbeddedImageOcrService,
    _duplicates_native_text,
)


def settings(**changes):
    return replace(get_settings(), ai_service_temp_dir=tempfile.gettempdir(), **changes)


def candidate(**changes) -> EmbeddedImageOcrCandidate:
    values = {
        "image_id": "00000000-0000-0000-0000-000000000001",
        "page_number": 1, "image_index": 1, "xref": 4,
        "pixel_width": 1200, "pixel_height": 400,
        "bbox": (50.0, 100.0, 550.0, 300.0),
        "page_width": 600.0, "page_height": 800.0,
        "is_decorative": False, "image_metadata": {},
    }
    values.update(changes)
    return EmbeddedImageOcrCandidate(**values)


class CandidateSelectorTests(unittest.TestCase):
    def test_meaningful_image_is_selected(self) -> None:
        self.assertTrue(EmbeddedImageOcrCandidateSelector(settings()).select(candidate()).selected)

    def test_decorative_image_is_skipped(self) -> None:
        decision = EmbeddedImageOcrCandidateSelector(settings()).select(candidate(is_decorative=True))
        self.assertEqual(decision.skip_reason, "DECORATIVE_IMAGE")

    def test_synthetic_scanned_page_is_skipped(self) -> None:
        decision = EmbeddedImageOcrCandidateSelector(settings()).select(candidate(
            page_has_ocr=True, bbox=(0.0, 0.0, 600.0, 800.0),
        ))
        self.assertEqual(decision.skip_reason, "SYNTHETIC_SCANNED_PAGE")

    def test_explicit_logo_is_skipped(self) -> None:
        decision = EmbeddedImageOcrCandidateSelector(settings()).select(candidate(
            image_metadata={"classification": "logo"},
        ))
        self.assertEqual(decision.skip_reason, "NON_SEMANTIC_IMAGE")

    def test_completed_result_requires_post_acquisition_fingerprint_validation(self) -> None:
        decision = EmbeddedImageOcrCandidateSelector(settings()).select(candidate(
            existing_status="COMPLETED", existing_config={
                "strategy": "embedded_image_ocr_v1", "language": "eng",
                "accept_confidence": 70.0, "fallback_enabled": True,
                "render_scale": 3.0, "preprocessing": "grayscale_autocontrast_v1",
            },
        ))
        self.assertTrue(decision.selected)
        self.assertIsNone(decision.skip_reason)


class OcrEngineTests(unittest.TestCase):
    def test_no_text_status(self) -> None:
        engine = EmbeddedImageOcrEngine(settings())
        self.assertEqual(engine.classify_status({"text_length": 0, "valid_token_count": 0}), "NO_TEXT_DETECTED")

    def test_low_confidence_requires_review(self) -> None:
        engine = EmbeddedImageOcrEngine(settings(image_ocr_accept_confidence=70))
        self.assertEqual(engine.classify_status({"text_length": 10, "valid_token_count": 2, "confidence_score": 55}), "REVIEW_REQUIRED")

    def test_primary_success_does_not_run_fallback(self) -> None:
        primary = {"text": "Clear text", "text_length": 10, "confidence_score": 91.0, "valid_token_count": 2, "tokens": [], "psm": 6}
        with patch("app.image_ocr.ocr_engine.run_tesseract_data", return_value=primary) as run:
            result = EmbeddedImageOcrEngine(settings()).extract("unused.png")
        self.assertEqual(result["passes_executed"], [6])
        self.assertEqual(run.call_count, 1)

    def test_sparse_fallback_is_selected_deterministically(self) -> None:
        primary = {"text": "?", "text_length": 1, "confidence_score": 20.0, "valid_token_count": 1, "tokens": [], "psm": 6}
        fallback = {"text": "INPUT OUTPUT", "text_length": 12, "confidence_score": 88.0, "valid_token_count": 2, "tokens": [], "psm": 11}
        with patch("app.image_ocr.ocr_engine.run_tesseract_data", side_effect=[primary, fallback]):
            result = EmbeddedImageOcrEngine(settings()).extract("unused.png")
        self.assertEqual(result["psm"], 11)
        self.assertEqual(result["passes_executed"], [6, 11])


class ImageLoaderTests(unittest.TestCase):
    def test_xref_failure_falls_back_to_bbox_and_cleans_up(self) -> None:
        fd, pdf_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        document = fitz.open()
        page = document.new_page(width=600, height=800)
        page.insert_text((60, 150), "CROP TEXT", fontsize=24)
        document.save(pdf_path)
        document.close()
        acquired = None
        try:
            acquired = EmbeddedImageLoader(temp_dir=tempfile.gettempdir(), render_scale=2).load(
                pdf_path=pdf_path, candidate=candidate(xref=999999),
            )
            self.assertEqual(acquired.strategy, "BBOX_RENDER")
            self.assertTrue(Path(acquired.path).exists())
        finally:
            if acquired:
                Path(acquired.path).unlink(missing_ok=True)
            Path(pdf_path).unlink(missing_ok=True)
        self.assertFalse(Path(pdf_path).exists())


class FakeRepository:
    def __init__(self, *, wrong_tenant: bool = False, fail_persist: bool = False) -> None:
        self.wrong_tenant = wrong_tenant
        self.fail_persist = fail_persist
        self.persisted = ["previous"]

    def load_context(self, **_):
        if self.wrong_tenant:
            raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found", False)
        return {
            "document": {}, "native_texts": [],
            "images": [{
                "id": "00000000-0000-0000-0000-000000000001",
                "page_number": 1, "image_index": 1,
                "image_metadata": {"xref": 4, "width": 1200, "height": 400},
                "x0": 50, "y0": 100, "x1": 550, "y1": 300,
                "page_width": 600, "page_height": 800, "is_decorative": False,
                "page_has_ocr": False, "existing_status": None, "existing_config": {},
                "existing_text_length": 0, "existing_confidence_score": None,
                "existing_duplicate_native_text": False,
                "xref_occurrences": 1,
            }],
        }

    def persist_results(self, *, results, **_):
        if self.fail_persist:
            raise RuntimeError("forced persistence failure")
        self.persisted = list(results)
        return len(results)


class FakeLoader:
    def __init__(self) -> None:
        self.paths = []

    def load(self, **_) -> AcquiredImage:
        fd, path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        self.paths.append(path)
        return AcquiredImage(path, "XREF", 1200, 400, "a" * 64)


class FakePreprocessor:
    def __init__(self) -> None:
        self.paths = []

    def preprocess(self, _path: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        self.paths.append(path)
        return path


class FakeEngine:
    PRIMARY_PSM = 6
    FALLBACK_PSM = 11

    def extract(self, _path: str, **_) -> dict:
        return {
            "text": "INPUT Digital page LAYOUT Mixed blocks OUTPUT Ordered content",
            "text_length": 61, "confidence_score": 88.0, "valid_token_count": 9,
            "tokens": [], "psm": 6, "passes_executed": [6], "junk_character_ratio": 0.0,
        }

    def classify_status(self, _result: dict) -> str:
        return "COMPLETED"


class EmbeddedImageOcrServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        logging.disable(logging.CRITICAL)

    @classmethod
    def tearDownClass(cls) -> None:
        logging.disable(logging.NOTSET)

    def _service(self, repository: FakeRepository) -> EmbeddedImageOcrService:
        service = EmbeddedImageOcrService(settings(), repository)
        service.loader = FakeLoader()
        service.preprocessor = FakePreprocessor()
        service.engine = FakeEngine()
        return service

    def test_meaningful_image_persists_text_and_cleans_temp_files(self) -> None:
        repository = FakeRepository()
        service = self._service(repository)
        summary = service.process(organization_id="org", document_id="doc", pdf_path="unused")
        self.assertEqual(repository.persisted[0].ocr_status, "COMPLETED")
        self.assertEqual(summary.image_text_blocks_created, 1)
        self.assertTrue(all(not Path(path).exists() for path in service.loader.paths + service.preprocessor.paths))

    def test_wrong_tenant_changes_nothing(self) -> None:
        repository = FakeRepository(wrong_tenant=True)
        with self.assertRaises(RepositoryError):
            self._service(repository).process(organization_id="wrong", document_id="doc", pdf_path="unused")
        self.assertEqual(repository.persisted, ["previous"])

    def test_persistence_rollback_preserves_previous_state(self) -> None:
        repository = FakeRepository(fail_persist=True)
        with self.assertRaises(EmbeddedImageOcrPersistenceError):
            self._service(repository).process(organization_id="org", document_id="doc", pdf_path="unused")
        self.assertEqual(repository.persisted, ["previous"])

    def test_hidden_native_text_is_suppressed(self) -> None:
        duplicate = _duplicates_native_text(
            (50, 100, 550, 300), "INPUT Digital page OUTPUT",
            [{"bbox": [60, 120, 500, 180], "text": "INPUT Digital page OUTPUT"}],
            overlap_threshold=0.7, similarity_threshold=0.88,
        )
        self.assertTrue(duplicate)

    def test_image_text_follows_parent_image(self) -> None:
        blocks, _ = ReadingOrderResolver().resolve_page([
            LayoutCandidate(1, "TEXT", "DOCUMENT_PAGE_TEXT", "text1", "test", (10, 10, 590, 50), 600, 800),
            LayoutCandidate(1, "IMAGE_TEXT", "DOCUMENT_IMAGE_TEXT", "it", "tesseract", (50, 100, 550, 300), 600, 800, metadata={"parent_image_id": "image"}),
            LayoutCandidate(1, "IMAGE", "DOCUMENT_IMAGE", "image", "pymupdf", (50, 100, 550, 300), 600, 800),
            LayoutCandidate(1, "TABLE", "DOCUMENT_TABLE", "table", "pdfplumber", (50, 100, 550, 300), 600, 800),
            LayoutCandidate(1, "TEXT", "DOCUMENT_PAGE_TEXT", "text2", "test", (10, 500, 590, 550), 600, 800),
        ])
        self.assertEqual([block.block_type for block in blocks], ["TEXT", "IMAGE", "IMAGE_TEXT", "TABLE", "TEXT"])


if __name__ == "__main__":
    unittest.main()
