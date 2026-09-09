import unittest
from unittest.mock import Mock

from app.persistence.extraction_persistence_service import ExtractionPersistenceService


class ExtractionPersistenceIdempotencyTests(unittest.TestCase):
    def test_matching_atomic_source_set_is_reused(self) -> None:
        repository = Mock()
        repository.get_existing_extraction_summary.return_value = {
            "pages": 1, "texts": 1, "text_length": 4, "tables": 0, "images": 0,
        }
        service = ExtractionPersistenceService(repository)
        rows = Mock()
        rows.pages=[Mock()]; rows.page_texts=[Mock(text_length=4)]; rows.tables=[]; rows.images=[]
        service._build_rows = Mock(return_value=rows)
        summary = service.persist(organization_id="o",document_id="d",extraction_result=Mock(),text_pages=[],table_pages=[],image_pages=[])
        self.assertEqual(summary.document_pages_saved, 1)
        repository.persist_extraction_result.assert_not_called()

    def test_mismatched_source_set_uses_atomic_replacement(self) -> None:
        repository = Mock()
        repository.get_existing_extraction_summary.return_value = {"pages":0,"texts":0,"text_length":0,"tables":0,"images":0}
        repository.persist_extraction_result.return_value = "saved"
        service = ExtractionPersistenceService(repository)
        rows=Mock();rows.pages=[Mock()];rows.page_texts=[];rows.tables=[];rows.images=[]
        service._build_rows=Mock(return_value=rows)
        self.assertEqual(service.persist(organization_id="o",document_id="d",extraction_result=Mock(),text_pages=[],table_pages=[],image_pages=[]),"saved")
