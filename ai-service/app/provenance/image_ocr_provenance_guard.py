import logging

from app.provenance.audit_service import ProvenanceAuditService
from app.provenance.models import ProvenanceIntegrityError

logger=logging.getLogger(__name__)
IMAGE_CODES={"IMAGE_TEXT_PARENT_MISSING","IMAGE_TEXT_IMAGE_MISMATCH","IMAGE_TEXT_PAGE_MISMATCH","IMAGE_TEXT_DOCUMENT_MISMATCH","IMAGE_TEXT_TENANT_MISMATCH","IMAGE_FINGERPRINT_MISMATCH","OCR_CONFIG_FINGERPRINT_MISMATCH"}


class ImageOcrProvenanceGuard:
    def __init__(self,audit_service: ProvenanceAuditService) -> None: self.audit_service=audit_service

    def validate(self, *, organization_id: str, document_id: str) -> None:
        report=self.audit_service.audit(organization_id=organization_id,document_id=document_id,include_derived=False)
        invalid=[issue for issue in report.issues if issue.error_code in IMAGE_CODES]
        if invalid:
            for issue in invalid: logger.error("IMAGE_TEXT_PARENT_REJECTED organization_id=%s document_id=%s page_number=%s image_id=%s image_text_id=%s error_code=%s",organization_id,document_id,issue.page_number,issue.image_id,issue.image_text_id,issue.error_code)
            report.issues=invalid; raise ProvenanceIntegrityError(report)
        logger.info("IMAGE_TEXT_PARENT_VALIDATED organization_id=%s document_id=%s valid_relationships=%s",organization_id,document_id,report.valid_image_text_relationships)
