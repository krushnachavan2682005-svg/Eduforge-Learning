import logging
from copy import deepcopy
import unittest
from unittest.mock import Mock

from app.content_layout.content_layout_service import ContentLayoutService
from app.content_layout.models import LayoutCandidate
from app.content_layout.persistence_service import ContentBlockPersistenceError
from app.content_layout.reading_order import ReadingOrderResolver
from app.database.repositories import RepositoryError


def candidate(kind: str, bbox: tuple[float, float, float, float] | None, source_id: str) -> LayoutCandidate:
    source_type = {
        "TEXT": "DOCUMENT_PAGE_TEXT", "OCR_TEXT": "OCR_RESULT",
        "TABLE": "DOCUMENT_TABLE", "IMAGE": "DOCUMENT_IMAGE",
    }[kind]
    return LayoutCandidate(
        page_number=1, block_type=kind, source_type=source_type,
        source_id=source_id, extraction_method="test", bbox=bbox,
        page_width=600, page_height=800, content_text=source_id if "TEXT" in kind else None,
    )


class ReadingOrderResolverTests(unittest.TestCase):
    def test_native_subscript_is_not_lost_when_table_flattens_it(self) -> None:
        table = candidate("TABLE", (0, 0, 500, 200), "table")
        table = LayoutCandidate(**{**table.__dict__, "content_text": "COD | 102 mg O2/L"})
        text = candidate("TEXT", (10, 10, 490, 190), "COD = 102 mg O₂/L")
        blocks, suppressed = ReadingOrderResolver().resolve_page([table, text])
        self.assertEqual(suppressed, 0)
        self.assertTrue(any("O₂" in (block.content_text or "") for block in blocks))

    def setUp(self) -> None:
        self.resolver = ReadingOrderResolver()

    def test_text_only_page(self) -> None:
        blocks, _ = self.resolver.resolve_page([
            candidate("TEXT", (20, 20, 580, 50), "heading"),
            candidate("TEXT", (20, 70, 580, 110), "p1"),
            candidate("TEXT", (20, 130, 580, 170), "p2"),
        ])
        self.assertEqual([block.block_type for block in blocks], ["TEXT", "TEXT", "TEXT"])
        self.assertEqual([block.block_order for block in blocks], [0, 1, 2])

    def test_mixed_page(self) -> None:
        blocks, _ = self.resolver.resolve_page([
            candidate("TABLE", (20, 300, 580, 400), "table"),
            candidate("TEXT", (20, 450, 580, 500), "tail"),
            candidate("IMAGE", (20, 150, 580, 250), "image"),
            candidate("TEXT", (20, 20, 580, 80), "intro"),
        ])
        self.assertEqual([block.block_type for block in blocks], ["TEXT", "IMAGE", "TABLE", "TEXT"])

    def test_table_duplicate_text_is_suppressed(self) -> None:
        blocks, suppressed = self.resolver.resolve_page([
            candidate("TEXT", (100, 210, 500, 280), "cell text"),
            candidate("TABLE", (80, 190, 520, 300), "table"),
        ])
        self.assertEqual([block.block_type for block in blocks], ["TABLE"])
        self.assertEqual(suppressed, 1)

    def test_two_columns_are_not_interleaved(self) -> None:
        blocks, _ = self.resolver.resolve_page([
            candidate("TEXT", (20, 20, 270, 60), "left1"),
            candidate("TEXT", (330, 30, 580, 70), "right1"),
            candidate("TEXT", (20, 100, 270, 140), "left2"),
            candidate("TEXT", (330, 110, 580, 150), "right2"),
        ])
        self.assertEqual([block.source_id for block in blocks], ["left1", "left2", "right1", "right2"])

    def test_full_width_heading_precedes_columns(self) -> None:
        blocks, _ = self.resolver.resolve_page([
            candidate("TEXT", (20, 10, 580, 50), "heading"),
            candidate("TEXT", (330, 70, 580, 110), "right"),
            candidate("TEXT", (20, 60, 270, 100), "left"),
        ])
        self.assertEqual([block.source_id for block in blocks], ["heading", "left", "right"])

    def test_coordinate_convention_remains_top_left(self) -> None:
        blocks, _ = self.resolver.resolve_page([
            candidate("IMAGE", (10, 200, 50, 250), "lower"),
            candidate("TEXT", (10, 20, 50, 50), "upper"),
        ])
        self.assertEqual([block.source_id for block in blocks], ["upper", "lower"])


class FakeRepository:
    def __init__(self, sources: dict, fail: bool = False) -> None:
        self.sources = sources
        self.fail = fail
        self.persisted = ["previous"]

    def load_sources(self, **_: str) -> dict:
        if self.sources == "wrong_tenant":
            raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found for organization", False)
        return self.sources

    def replace_blocks(self, *, blocks: list, **_: object) -> int:
        if self.fail:
            raise RuntimeError("forced insert failure")
        self.persisted = list(blocks)
        return len(blocks)


def scanned_sources() -> dict:
    return {
        "pages": [{"page_number": 1, "page_width": 600, "page_height": 800, "needs_ocr": False}],
        "texts": [{
            "id": "text-id", "page_number": 1, "text": "OCR text", "extraction_method": "tesseract_ocr",
            "source": "OCR", "layout_blocks": [], "page_width": 600, "page_height": 800,
        }],
        "tables": [],
        "images": [{
            "id": "image-id", "page_number": 1, "image_index": 1,
            "image_metadata": {"is_synthetic_page_visual": True}, "extraction_method": "pymupdf",
            "x0": None, "y0": None, "x1": None, "y1": None,
            "page_width": 600, "page_height": 800, "is_decorative": True,
        }],
    }


def mixed_table_sources() -> dict:
    table_data = [
        ["Step", "Block Type", "Unique Test Token", "Expected Position"],
        ["1", "HEADING", "HEADING_BLOCK_01", "First"],
        ["5", "TEXT", "PARAGRAPH_AFTER_TABLE", "Fifth"],
    ]
    return {
        "pages": [{"page_number": 1, "page_width": 600, "page_height": 800, "needs_ocr": False}],
        "texts": [{
            "id": "text-id", "page_number": 1, "text": "tail", "extraction_method": "pymupdf",
            "source": "NATIVE", "layout_blocks": [{"block_index": 1, "text": "tail", "bbox": [10, 450, 590, 500]}],
            "page_width": 600, "page_height": 800,
        }],
        "tables": [{
            "id": "table-id", "page_number": 1, "table_index": 1, "table_data": table_data,
            "extraction_method": "pdfplumber", "x0": 10, "y0": 300, "x1": 590, "y1": 400,
            "page_width": 600, "page_height": 800, "row_count": 3, "column_count": 4,
        }],
        "images": [{
            "id": "image-id", "page_number": 1, "image_index": 1, "image_metadata": {"xref": 1},
            "extraction_method": "pymupdf", "x0": 10, "y0": 100, "x1": 590, "y1": 200,
            "page_width": 600, "page_height": 800, "is_decorative": False,
        }],
        "image_texts": [{
            "id": "image-text-id", "image_id": "image-id", "page_number": 1,
            "raw_text": "IMAGE BLOCK 01", "confidence_score": 90, "ocr_status": "COMPLETED",
            "ocr_engine": "tesseract", "ocr_config": {"selected_psm": 6},
            "x0": 10, "y0": 100, "x1": 590, "y1": 200,
            "page_width": 600, "page_height": 800, "image_index": 1,
            "source_image_fingerprint": "a" * 64,
            "ocr_configuration_fingerprint": "b" * 64,
        }],
    }


class ContentLayoutServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        logging.disable(logging.CRITICAL)

    @classmethod
    def tearDownClass(cls) -> None:
        logging.disable(logging.NOTSET)

    def test_scanned_page_has_ocr_without_synthetic_image(self) -> None:
        repository = FakeRepository(scanned_sources())
        summary = ContentLayoutService(repository).process(organization_id="org", document_id="doc")
        self.assertEqual(summary.ocr_blocks, 1)
        self.assertEqual(summary.image_blocks, 0)
        self.assertEqual(summary.decorative_images_excluded, 1)

    def test_resolver_failure_uses_safe_page_fallback(self) -> None:
        repository = FakeRepository(scanned_sources())
        service = ContentLayoutService(repository)
        service.resolver.resolve_page = Mock(side_effect=RuntimeError("layout failure"))
        summary = service.process(organization_id="org", document_id="doc")
        self.assertEqual(summary.total_blocks, 1)
        self.assertEqual(summary.warning_count, 1)
        self.assertIn("SAFE_TOP_TO_BOTTOM_LEFT_TO_RIGHT", summary.fallbacks_used)

    def test_idempotent_rerun_is_deterministic(self) -> None:
        repository = FakeRepository(scanned_sources())
        service = ContentLayoutService(repository)
        first = service.process(organization_id="org", document_id="doc")
        first_rows = list(repository.persisted)
        second = service.process(organization_id="org", document_id="doc")
        self.assertEqual(first.total_blocks, second.total_blocks)
        self.assertEqual(first_rows, repository.persisted)

    def test_table_content_is_persisted_from_unchanged_structured_source(self) -> None:
        sources = mixed_table_sources()
        original_table_data = deepcopy(sources["tables"][0]["table_data"])
        repository = FakeRepository(sources)

        ContentLayoutService(repository).process(organization_id="org", document_id="doc")

        table = next(block for block in repository.persisted if block.block_type == "TABLE")
        self.assertEqual(table.source_id, "table-id")
        self.assertEqual(table.source_type, "DOCUMENT_TABLE")
        self.assertIn("Step | Block Type | Unique Test Token | Expected Position", table.content_text)
        self.assertEqual(table.content_text, table.readable_text)
        self.assertEqual(sources["tables"][0]["table_data"], original_table_data)

    def test_ordered_mixed_page_keeps_image_text_table_and_text(self) -> None:
        repository = FakeRepository(mixed_table_sources())
        ContentLayoutService(repository).process(organization_id="org", document_id="doc")
        self.assertEqual(
            [block.block_type for block in repository.persisted],
            ["IMAGE", "IMAGE_TEXT", "TABLE", "TEXT"],
        )
        self.assertIn("1 | HEADING | HEADING_BLOCK_01 | First", repository.persisted[2].content_text)

    def test_table_layout_rerun_is_deterministic_without_duplicates(self) -> None:
        repository = FakeRepository(mixed_table_sources())
        service = ContentLayoutService(repository)
        service.process(organization_id="org", document_id="doc")
        first = list(repository.persisted)
        service.process(organization_id="org", document_id="doc")
        tables = [block for block in repository.persisted if block.block_type == "TABLE"]
        self.assertEqual(repository.persisted, first)
        self.assertEqual(len(tables), 1)

    def test_wrong_tenant_does_not_replace_rows(self) -> None:
        repository = FakeRepository("wrong_tenant")
        with self.assertRaises(RepositoryError):
            ContentLayoutService(repository).process(organization_id="wrong", document_id="doc")
        self.assertEqual(repository.persisted, ["previous"])

    def test_persistence_failure_preserves_previous_set(self) -> None:
        repository = FakeRepository(scanned_sources(), fail=True)
        with self.assertRaises(ContentBlockPersistenceError):
            ContentLayoutService(repository).process(organization_id="org", document_id="doc")
        self.assertEqual(repository.persisted, ["previous"])


if __name__ == "__main__":
    unittest.main()
