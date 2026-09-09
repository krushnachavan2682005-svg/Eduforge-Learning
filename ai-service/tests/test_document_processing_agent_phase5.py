import unittest
from unittest.mock import Mock, patch

from app.agents.document_processing_agent import DocumentProcessingAgent
from app.config.settings import Settings


class DocumentProcessingAgentPhase5Tests(unittest.TestCase):
    @patch("app.agents.document_processing_agent.write_temp_pdf")
    @patch("app.agents.document_processing_agent.cleanup_temp_file")
    @patch("app.agents.document_processing_agent.ObjectStorage", autospec=True)
    def test_preprocess_pdf_does_not_execute_chunking(
        self,
        mock_storage, mock_cleanup, mock_write
    ) -> None:
        mock_write.return_value = "/tmp/mock.pdf"
        
        settings = Mock(spec=Settings)
        settings.database_url = "postgresql://mock:mock@localhost:5432/mock"
        settings.chunk_target_tokens = 500
        settings.chunk_max_tokens = 1000
        settings.chunk_min_tokens = 100
        settings.chunk_overlap_tokens = 50
        settings.supabase_url = "mock"
        settings.supabase_service_role_key = "mock"
        settings.ocr_engine = "mock"
        settings.ocr_language = "mock"
        settings.ocr_render_scale = 2.0
        settings.image_ocr_enabled = False
        settings.image_ocr_fallback_enabled = False
        repository = Mock()
        repository.prepare_job.return_value = None
        repository.get_ocr_required_pages.return_value = []
        
        agent = DocumentProcessingAgent(settings, repository)
        agent.storage = mock_storage.return_value
        agent.tool_registry = Mock()
        agent.persistence_service = Mock()
        agent.ocr_pipeline = Mock()
        agent.content_layout_service = Mock()
        agent.chunking_pipeline = Mock()
        agent.router = Mock()
        agent.embedded_image_ocr_service = Mock()
        agent.provenance_audit = Mock()
        agent.image_provenance_guard = Mock()
        
        agent.storage.download_pdf.return_value = b"%PDF-1.4 mock"
        
        # mock router response
        mock_result = Mock()
        mock_result.document_type = "NATIVE_PDF"
        mock_result.total_text_length = 1000
        mock_result.ocr_required = False
        mock_result.pages_requiring_ocr = 0
        mock_result.page_count = 1
        mock_result.total_table_count = 0
        mock_result.total_image_count = 0
        mock_result.extraction_summary = {}
        agent.router.route.return_value = mock_result
        
        # mock persistence
        mock_persistence_summary = Mock()
        mock_persistence_summary.model_dump.return_value = {}
        agent.persistence_service.persist.return_value = mock_persistence_summary
        
        # mock layout
        mock_layout_summary = Mock()
        mock_layout_summary.image_text_blocks = 0
        mock_layout_summary.model_dump.return_value = {"warning_count": 0, "fallbacks_used": []}
        agent.content_layout_service.process.return_value = mock_layout_summary
        
        # mock image ocr
        mock_image_ocr_summary = Mock()
        mock_image_ocr_summary.model_dump.return_value = {"review_required": 0, "failed": 0}
        agent.embedded_image_ocr_service.process.return_value = mock_image_ocr_summary
        
        payload = {
            "job_id": "job123",
            "document_id": "doc123",
            "organization_id": "org123",
            "processing_type": "PREPROCESS_PDF",
            "storage_bucket": "test-bucket",
            "storage_key": "test-key"
        }
        
        agent.process_job(payload, "req123")
        
        agent.chunking_pipeline.run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
