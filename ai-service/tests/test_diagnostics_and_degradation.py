import unittest
from unittest.mock import Mock

from app.diagnostics.document_processing_diagnostics import DocumentProcessingDiagnosticsService
from app.diagnostics.policy import GracefulDegradationPolicy


def _data(status="FAILED", error_code="EXTRACTION_PERSISTENCE_FAILED", pages=10):
    return {
        "document": {"id":"d","original_file_name":"stress.pdf","storage_key":"key","status":status,"processing_stage":"FAILED" if status=="FAILED" else "EMBEDDING_READY","page_count":pages},
        "job": {"status":status,"error_code":error_code if status=="FAILED" else None,"error_message":"safe failure","result_metadata":{"ocr_required":False}},
        "counts": {"page_count":pages,"page_text_count":pages,"table_count":1,"image_count":1,"image_text_count":1,"content_block_count":pages,"chunk_count":1 if status!="FAILED" else 0},
        "pages": [{"page_number":n,"route":"DIGITAL_TEXT","text_length":10,"tables_detected":0,"images_detected":0,"image_ocr_completed":0,"content_blocks_created":1,"content_block_types":["TEXT"],"image_ocr_statuses":[]} for n in range(1,pages+1)],
    }


class DiagnosticsAndDegradationTests(unittest.TestCase):
    def test_failed_job_identifies_one_exact_terminal_stage(self):
        repo=Mock(); repo.load.return_value=_data()
        report=DocumentProcessingDiagnosticsService(repo).diagnose(organization_id="o",document_id="d")
        self.assertEqual(report.terminal_failure_stage, "SOURCE_PERSISTENCE")
        self.assertEqual(sum(stage.status.value.startswith("FAILED") for stage in report.stages), 1)

    def test_ten_page_input_returns_ten_page_diagnostics(self):
        repo=Mock(); repo.load.return_value=_data(status="COMPLETED",error_code=None)
        self.assertEqual(len(DocumentProcessingDiagnosticsService(repo).diagnose(organization_id="o",document_id="d").pages), 10)

    def test_recoverable_policy(self):
        cases = [("TABLE_EXTRACTION_FAILED","NATIVE_PAGE_TEXT"),("EMBEDDED_IMAGE_OCR_FAILED","PRESERVE_IMAGE_WITH_REVIEW_STATUS"),("CONTENT_LAYOUT_FAILED","SAFE_TOP_TO_BOTTOM_LEFT_TO_RIGHT"),("OVERSIZED_BLOCK","PARAGRAPH_SENTENCE_TOKEN_SPLIT"),("OVERSIZED_TABLE","COMPLETE_ROW_SPLIT_REPEAT_HEADER")]
        for code,fallback in cases:
            with self.subTest(code=code):
                decision=GracefulDegradationPolicy().classify(error_code=code,stage="TEST")
                self.assertTrue(decision.recoverable); self.assertEqual(decision.fallback,fallback)

    def test_critical_policy(self):
        for code in ("PDF_DOWNLOAD_FAILED","EXTRACTION_PERSISTENCE_FAILED","DATABASE_UNAVAILABLE","ORG_MISMATCH"):
            with self.subTest(code=code): self.assertFalse(GracefulDegradationPolicy().classify(error_code=code,stage="TEST").recoverable)

    def test_unknown_failure_is_critical(self):
        self.assertFalse(GracefulDegradationPolicy().classify(error_code="UNKNOWN",stage="TEST").recoverable)
