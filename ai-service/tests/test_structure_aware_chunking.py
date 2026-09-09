import logging
import unittest

from app.chunking.chunker import StructureAwarePageAwareChunker
from app.chunking.cleaner import ContentTypeAwareTextCleaner
from app.chunking.header_footer_detector import RepeatedHeaderFooterDetector
from app.chunking.models import ChunkConfig, HeaderFooterConfig, SemanticUnit
from app.chunking.pipeline import ChunkingPipeline, DocumentChunkingError
from app.chunking.section_detector import SectionDetector
from app.chunking.token_counter import TokenCounter
from app.chunking.validator import ChunkValidationError, ChunkValidator
from app.database.repositories import RepositoryError


def unit(index: int, text: str, *, page: int = 1, kind: str = "TEXT", content_type: str = "PARAGRAPH", **kwargs) -> SemanticUnit:
    return SemanticUnit(
        content_block_id=f"00000000-0000-0000-0000-{index:012d}", page_number=page,
        block_order=index, block_type=kind, source_type="DOCUMENT_PAGE_TEXT",
        source_record_id=f"source-{index}", text=text, content_type=content_type, **kwargs,
    )


class CleaningAndDetectionTests(unittest.TestCase):
    def test_superscripts_and_subscripts_are_preserved(self) -> None:
        source = unit(1, "COD = 102 mg O₂/L; area = m²", kind="TEXT")
        cleaned = ContentTypeAwareTextCleaner().clean([source])
        self.assertEqual(cleaned[0].text, "COD = 102 mg O₂/L; area = m²")

    def setUp(self) -> None:
        self.cleaner = ContentTypeAwareTextCleaner()

    def test_digital_text_repairs_safe_wrapping(self) -> None:
        actual = self.cleaner.clean([unit(1, "Payment is due within thirty\ndays after receipt.")])[0].text
        self.assertEqual(actual, "Payment is due within thirty days after receipt.")

    def test_identifiers_financial_values_and_dates_are_unchanged(self) -> None:
        text = "DOC-7F3A-9921\nINR 12,450.75\n12/07/2026\n98.4%"
        actual = self.cleaner.clean([unit(1, text)])[0].text
        for value in ("DOC-7F3A-9921", "INR 12,450.75", "12/07/2026", "98.4%"):
            self.assertIn(value, actual)

    def test_json_and_code_structure_is_preserved(self) -> None:
        text = '{\n  "field_name": "DOC-1",\n  "value": 12.5\n}'
        self.assertEqual(self.cleaner.clean([unit(1, text)])[0].text, text)

    def test_table_rows_and_pipes_are_preserved(self) -> None:
        table = unit(1, "A | B\n1 | 2", kind="TABLE", content_type="TABLE", table_id="table")
        self.assertEqual(self.cleaner.clean([table])[0].text, "A | B\n1 | 2")

    def test_image_without_text_is_not_fabricated(self) -> None:
        image = unit(1, "", kind="IMAGE", content_type="IMAGE")
        self.assertEqual(self.cleaner.clean([image]), [])

    def test_low_confidence_ocr_metadata_is_preserved(self) -> None:
        ocr = unit(1, "0 1 5 8 remain", kind="OCR_TEXT", content_type="OCR_PARAGRAPH", confidence_score=42.5, review_status="REVIEW_REQUIRED")
        cleaned = self.cleaner.clean([ocr])[0]
        self.assertEqual(cleaned.confidence_score, 42.5)
        self.assertEqual(cleaned.review_status, "REVIEW_REQUIRED")
        self.assertEqual(cleaned.text, "0 1 5 8 remain")

    def test_repeated_header_footer_requires_three_pages_and_preserves_first_title(self) -> None:
        units = []
        for page in range(1, 4):
            units.extend([
                unit(page * 10, "Annual Report", page=page, bbox=(0, 0, 100, 10), page_height=100),
                unit(page * 10 + 1, f"Body {page}", page=page, bbox=(0, 30, 100, 60), page_height=100),
                unit(page * 10 + 2, f"Page {page} of 3", page=page, bbox=(0, 90, 100, 100), page_height=100),
            ])
        detected, headers, footers = RepeatedHeaderFooterDetector(HeaderFooterConfig()).detect(units)
        self.assertEqual(headers, 2)
        self.assertEqual(footers, 3)
        self.assertIsNone(detected[0].excluded_reason)
        self.assertTrue(all(next(u for u in detected if u.text == f"Body {page}").excluded_reason is None for page in range(1, 4)))

    def test_one_page_header_footer_is_not_removed(self) -> None:
        detected, headers, footers = RepeatedHeaderFooterDetector(HeaderFooterConfig()).detect([unit(1, "Page 1")])
        self.assertEqual((headers, footers), (0, 0))
        self.assertIsNone(detected[0].excluded_reason)

    def test_section_heading_stays_active(self) -> None:
        assigned = SectionDetector().assign([unit(1, "SECTION 3 CLAIMS"), unit(2, "Related paragraph.")])
        self.assertTrue(assigned[0].is_heading)
        self.assertEqual(assigned[1].section_title, "SECTION 3 CLAIMS")


class ChunkAssemblyTests(unittest.TestCase):
    def make_chunker(self, target: int = 30, maximum: int = 40, minimum: int = 5, overlap: int = 6) -> StructureAwarePageAwareChunker:
        return StructureAwarePageAwareChunker(TokenCounter(), ChunkConfig(target, maximum, minimum, overlap))

    def test_heading_remains_with_related_paragraph(self) -> None:
        units = SectionDetector().assign([unit(1, "SECTION 1 INTRODUCTION"), unit(2, "This paragraph belongs to the heading.")])
        chunks = self.make_chunker().create(units)
        self.assertEqual(len(chunks), 1)
        self.assertIn("SECTION 1 INTRODUCTION\n\nThis paragraph", chunks[0].content)

    def test_small_table_stays_together_and_retains_id(self) -> None:
        chunks = self.make_chunker().create([unit(1, "A | B\n1 | 2\n3 | 4", kind="TABLE", content_type="TABLE", table_id="table-1")])
        self.assertEqual(len(chunks), 1)
        self.assertIn("3 | 4", chunks[0].content)
        self.assertEqual(chunks[0].metadata["source_blocks"][0]["table_id"], "table-1")

    def test_oversized_table_splits_rows_and_repeats_header(self) -> None:
        text = "Name | Value\n" + "\n".join(f"row_{i} | value_{i}" for i in range(12))
        chunks = self.make_chunker(target=12, maximum=16, minimum=2, overlap=2).create([unit(1, text, kind="TABLE", content_type="TABLE", table_id="table-1")])
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.content.startswith("Name | Value") for chunk in chunks))
        combined = "\n".join(chunk.content for chunk in chunks)
        self.assertTrue(all(f"row_{i} | value_{i}" in combined for i in range(12)))
        self.assertTrue(any(source.get("table_header_repeated") for chunk in chunks for source in chunk.metadata["source_blocks"]))

    def test_oversized_paragraph_splits_at_sentences(self) -> None:
        text = " ".join(f"Sentence {i} has useful context." for i in range(20))
        chunks = self.make_chunker(target=20, maximum=25, minimum=3, overlap=3).create([unit(1, text)])
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.token_count <= 25 for chunk in chunks))
        self.assertTrue(all(f"Sentence {i}" in "\n".join(c.content for c in chunks) for i in range(20)))

    def test_very_long_sentence_uses_token_fallback_without_token_loss(self) -> None:
        text = " ".join(f"token{i}" for i in range(101))
        chunks = self.make_chunker(target=20, maximum=25, minimum=2, overlap=0).create([unit(1, text)])
        combined = " ".join(chunk.content for chunk in chunks)
        self.assertTrue(all(f"token{i}" in combined for i in range(101)))
        self.assertTrue(all(chunk.token_count <= 25 for chunk in chunks))

    def test_contextual_overlap_uses_complete_units(self) -> None:
        units = [unit(i, f"Paragraph {i} contains several useful context words.") for i in range(1, 8)]
        chunks = self.make_chunker(target=18, maximum=24, minimum=2, overlap=8).create(units)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(any(chunk.metadata["overlap_source_block_ids"] for chunk in chunks[1:]))

    def test_adjacent_pages_may_merge_and_non_adjacent_pages_do_not(self) -> None:
        adjacent = self.make_chunker().create([unit(1, "page one", page=1), unit(2, "page two", page=2)])
        self.assertEqual(adjacent[0].source_pages, [1, 2])
        separated = self.make_chunker().create([unit(1, "page one", page=1), unit(2, "page three", page=3)])
        self.assertEqual(len(separated), 2)

    def test_mixed_content_order_and_traceability(self) -> None:
        units = [
            unit(1, "native"),
            unit(2, "INPUT LAYOUT OUTPUT", kind="IMAGE_TEXT", content_type="IMAGE_TEXT", image_id="image", image_text_id="image-text", confidence_score=87.39),
            unit(3, "A | B\n1 | 2", kind="TABLE", content_type="TABLE", table_id="table"),
            unit(4, "tail"),
        ]
        chunk = self.make_chunker().create(units)[0]
        self.assertLess(chunk.content.index("native"), chunk.content.index("INPUT"))
        self.assertLess(chunk.content.index("INPUT"), chunk.content.index("A | B"))
        self.assertLess(chunk.content.index("A | B"), chunk.content.index("tail"))
        self.assertEqual([source["block_order"] for source in chunk.metadata["source_blocks"]], [1, 2, 3, 4])
        self.assertEqual(chunk.metadata["source_blocks"][1]["confidence_score"], 87.39)

    def test_deterministic_rerun_has_same_fingerprints_and_indexes(self) -> None:
        units = [unit(i, f"Paragraph {i} with deterministic words.") for i in range(1, 10)]
        chunker = self.make_chunker()
        first, second = chunker.create(units), chunker.create(units)
        self.assertEqual([(c.chunk_index, c.content_fingerprint) for c in first], [(c.chunk_index, c.content_fingerprint) for c in second])

    def test_validator_rejects_token_overflow(self) -> None:
        chunk = self.make_chunker().create([unit(1, "valid text")])[0]
        chunk.token_count = 100
        with self.assertRaises(ChunkValidationError):
            ChunkValidator().validate([chunk], max_tokens=10)


class TokenCounterTests(unittest.TestCase):
    def test_unicode_regex_counter_is_stable(self) -> None:
        counter = TokenCounter()
        self.assertEqual(counter.count("Amount: INR 12,450.75"), counter.count("Amount: INR 12,450.75"))
        self.assertEqual(counter.name, "unicode_regex_v1")


class FakeContentRepository:
    def __init__(self, blocks=None, wrong_tenant: bool = False) -> None:
        self.blocks = blocks or []
        self.wrong_tenant = wrong_tenant

    def load(self, **_):
        if self.wrong_tenant:
            raise RepositoryError("DOCUMENT_NOT_FOUND", "wrong tenant", False)
        return {"document": {"job_id": "job"}, "blocks": self.blocks}


class FakeChunkRepository:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.persisted = ["old-valid-set"]
        self.stage = "CONTENT_BLOCKS_READY"

    def replace(self, *, chunks, **_):
        if self.fail:
            raise RuntimeError("forced insert failure")
        self.persisted = list(chunks)
        self.stage = "EMBEDDING_READY"
        return len(chunks)

    def mark_no_text(self, **_):
        self.persisted = []
        self.stage = "NO_TEXT_AVAILABLE"


def pipeline(content_repository, chunk_repository) -> ChunkingPipeline:
    return ChunkingPipeline(
        content_repository=content_repository, chunk_repository=chunk_repository,
        chunk_config=ChunkConfig(30, 40, 5, 6), header_footer_config=HeaderFooterConfig(),
    )


def block_row(text: str, block_type: str = "TEXT") -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000000001", "page_number": 1, "block_order": 0,
        "block_type": block_type, "source_type": "DOCUMENT_IMAGE" if block_type == "IMAGE" else "DOCUMENT_PAGE_TEXT",
        "page_text_id": None if block_type == "IMAGE" else "00000000-0000-0000-0000-000000000002",
        "image_id": "00000000-0000-0000-0000-000000000003" if block_type == "IMAGE" else None,
        "table_id": None, "image_text_id": None, "content_text": text, "readable_text": None,
        "x0": None, "y0": None, "x1": None, "y1": None, "page_height": 800,
        "metadata": {}, "confidence_score": None, "image_text_status": None, "parent_image_id": None,
    }


class PipelineSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        logging.disable(logging.CRITICAL)

    @classmethod
    def tearDownClass(cls) -> None:
        logging.disable(logging.NOTSET)

    def test_no_text_sets_safe_non_embedding_stage(self) -> None:
        chunk_repository = FakeChunkRepository()
        chunks, summary = pipeline(FakeContentRepository([block_row("", "IMAGE")]), chunk_repository).run(
            organization_id="org", document_id="doc",
        )
        self.assertEqual(chunks, [])
        self.assertEqual(summary.chunks_created, 0)
        self.assertEqual(chunk_repository.stage, "NO_TEXT_AVAILABLE")

    def test_wrong_tenant_leaves_chunks_unchanged(self) -> None:
        chunk_repository = FakeChunkRepository()
        with self.assertRaises(DocumentChunkingError):
            pipeline(FakeContentRepository(wrong_tenant=True), chunk_repository).run(organization_id="wrong", document_id="doc")
        self.assertEqual(chunk_repository.persisted, ["old-valid-set"])

    def test_persistence_failure_preserves_old_valid_set(self) -> None:
        chunk_repository = FakeChunkRepository(fail=True)
        with self.assertRaises(DocumentChunkingError):
            pipeline(FakeContentRepository([block_row("meaningful text")]), chunk_repository).run(organization_id="org", document_id="doc")
        self.assertEqual(chunk_repository.persisted, ["old-valid-set"])
        self.assertEqual(chunk_repository.stage, "CONTENT_BLOCKS_READY")


if __name__ == "__main__":
    unittest.main()
