import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.chunking.models import DocumentChunk
from app.content_layout.models import ResolvedContentBlock
from app.extractors.image_extractor import detect_page_images
from app.provenance.audit_service import ProvenanceAuditService
from app.provenance.content_integrity_validator import CanonicalContentIntegrityValidator
from app.provenance.fingerprints import cache_identity, ocr_configuration_fingerprint


def block(block_type, source_id, page=1, parent=None, order=0):
    return ResolvedContentBlock(
        page, block_type, f"DOCUMENT_{block_type}", source_id, "test",
        (0, 0, 10, 10), 100, 100, "text", "text",
        {"parent_image_id": parent} if parent else {}, order,
    )


def sources(text_page=1, text_image="image-1", fingerprints=True):
    text = {"id": "text-1", "image_id": text_image, "page_number": text_page}
    if fingerprints:
        text.update(source_image_fingerprint="a" * 64, ocr_configuration_fingerprint="b" * 64)
    return {"images": [{"id": "image-1", "page_number": 1}], "image_texts": [text]}


class FingerprintTests(unittest.TestCase):
    def test_same_dimensions_different_pixels_have_different_fingerprints(self):
        self.assertNotEqual(hashlib.sha256(b"pixels-a").hexdigest(), hashlib.sha256(b"pixels-b").hexdigest())

    def test_configuration_change_invalidates_fingerprint(self):
        self.assertNotEqual(ocr_configuration_fingerprint({"psm": 6}), ocr_configuration_fingerprint({"psm": 11}))

    def test_same_xref_across_documents_has_separate_cache_identity(self):
        base = dict(image_id="image", source_image_fingerprint="a" * 64, ocr_configuration_fingerprint="b" * 64)
        self.assertNotEqual(cache_identity(organization_id="org", document_id="doc-a", **base), cache_identity(organization_id="org", document_id="doc-b", **base))

    def test_same_xref_across_pages_cannot_override_image_identity(self):
        base = dict(organization_id="org", document_id="doc", source_image_fingerprint="a" * 64, ocr_configuration_fingerprint="b" * 64)
        self.assertNotEqual(cache_identity(image_id="page1-image", **base), cache_identity(image_id="page2-image", **base))


class CanonicalIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.validator = CanonicalContentIntegrityValidator()

    def test_wrong_image_id_attachment_rejected(self):
        valid, warnings = self.validator.validate_resolved([block("IMAGE", "image-1"), block("IMAGE_TEXT", "text-1", parent="image-1")], sources(text_image="other"))
        self.assertEqual([x.block_type for x in valid], ["IMAGE"])
        self.assertEqual(warnings[0]["warning_code"], "IMAGE_TEXT_IMAGE_MISMATCH")

    def test_wrong_page_attachment_rejected(self):
        valid, warnings = self.validator.validate_resolved([block("IMAGE", "image-1"), block("IMAGE_TEXT", "text-1", parent="image-1")], sources(text_page=9))
        self.assertEqual([x.block_type for x in valid], ["IMAGE"])
        self.assertEqual(warnings[0]["warning_code"], "CROSS_PAGE_IMAGE_TEXT_CONTAMINATION")

    def test_missing_parent_image_block_excludes_image_text(self):
        valid, warnings = self.validator.validate_resolved([block("IMAGE_TEXT", "text-1", parent="image-1")], sources())
        self.assertEqual(valid, [])
        self.assertEqual(warnings[-1]["warning_code"], "IMAGE_TEXT_PARENT_MISSING")

    def test_exact_parent_adjacency_is_enforced(self):
        valid, warnings = self.validator.validate_resolved([block("IMAGE_TEXT", "text-1", parent="image-1"), block("IMAGE", "image-1")], sources())
        self.assertFalse(warnings)
        self.assertEqual([(x.block_type, x.source_id) for x in valid], [("IMAGE", "image-1"), ("IMAGE_TEXT", "text-1")])

    def test_unfingerprinted_source_is_rejected(self):
        valid, warnings = self.validator.validate_resolved([block("IMAGE", "image-1"), block("IMAGE_TEXT", "text-1", parent="image-1")], sources(fingerprints=False))
        self.assertEqual([x.block_type for x in valid], ["IMAGE"])
        self.assertEqual(warnings[0]["warning_code"], "IMAGE_FINGERPRINT_MISMATCH")

    def test_chunk_source_page_mismatch_fails(self):
        chunk = DocumentChunk(0, "x", 1, 1, [1], None, ["TEXT"], ["block-1"], 1, 1, "test", "test", "fp", {})
        with self.assertRaisesRegex(ValueError, "CHUNK_SOURCE_PAGE_MISMATCH"):
            self.validator.validate_chunk_sources([chunk], [{"id": "block-1", "page_number": 9, "block_type": "TEXT"}])


class ImagePlacementRegressionTests(unittest.TestCase):
    def test_unplaced_shared_xobject_is_not_owned_by_page(self):
        rect = SimpleNamespace(width=100, height=100, x0=1, y0=1, x1=101, y1=101)
        page1 = SimpleNamespace(get_images=lambda full=True: [(4, 0, 100, 100)], get_image_rects=lambda _: [], rect=SimpleNamespace(width=600, height=800))
        page2 = SimpleNamespace(get_images=lambda full=True: [(4, 0, 100, 100)], get_image_rects=lambda _: [rect], rect=SimpleNamespace(width=600, height=800))
        document = SimpleNamespace(__iter__=lambda self: iter([page1, page2]), close=lambda: None)
        class FakeDocument:
            def __iter__(self): return iter([page1, page2])
            def close(self): pass
        with patch("app.extractors.image_extractor.fitz.open", return_value=FakeDocument()), patch("app.extractors.image_extractor._page_has_renderable_content", return_value=True):
            result = detect_page_images("unused.pdf")
        self.assertEqual([x.image_count for x in result], [0, 1])


class AuditRegressionTests(unittest.TestCase):
    def test_cross_page_contamination_is_reported(self):
        class Repository:
            def load(self, **_):
                return {
                    "document": {"page_count": 10},
                    "images": [{"id": "image-9", "organization_id": "org", "document_id": "doc", "page_number": 9, "image_metadata": {"source_image_fingerprint": "a" * 64}}],
                    "image_texts": [{"id": "text-9", "image_id": "image-9", "organization_id": "org", "document_id": "doc", "page_number": 9, "ocr_status": "COMPLETED", "source_image_fingerprint": "a" * 64, "ocr_configuration_fingerprint": "b" * 64, "ocr_config": {}}],
                    "blocks": [{"id": "b1", "page_number": 1, "block_order": 0, "block_type": "IMAGE_TEXT", "image_id": "image-9", "image_text_id": "text-9"}],
                    "chunks": [],
                }
        report = ProvenanceAuditService(Repository()).audit(organization_id="org", document_id="doc")
        self.assertFalse(report.passed)
        self.assertEqual(report.issue_count("CROSS_PAGE_IMAGE_TEXT_CONTAMINATION"), 1)


if __name__ == "__main__":
    unittest.main()
