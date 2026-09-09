import argparse
import logging
import uuid

from fastapi import HTTPException

from app.agents.document_processing_agent import DocumentProcessingAgent
from app.config.settings import get_settings
from app.database.repositories import DocumentProcessingRepository
from app.provenance.audit_service import ProvenanceAuditService
from app.provenance.repository import ProvenanceRepository
from app.provenance.run_provenance_audit import _summary

logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit or deterministically rebuild document provenance")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--force-rebuild", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    provenance_repository = ProvenanceRepository(settings.database_url)
    audit_service = ProvenanceAuditService(provenance_repository)
    before = audit_service.audit(organization_id=args.organization_id, document_id=args.document_id)
    before_summary = _summary(before)
    affected_pages = sorted({issue.page_number for issue in before.issues if issue.page_number is not None})
    print("Current audit:", before_summary["audit_result"])
    print("Invalid image-text rows:", before_summary["invalid_image_text_relationships"])
    print("Invalid content blocks:", sum(issue.content_block_id is not None for issue in before.issues))
    print("Contaminated chunks:", len({issue.chunk_index for issue in before.issues if issue.chunk_index is not None}))
    print("Affected pages:", affected_pages)
    print("Proposed actions: reacquire placed images, fingerprint/OCR, rebuild canonical blocks and chunks, then audit")
    if args.dry_run:
        return 0
    logger.warning("PROVENANCE_REPAIR_START organization_id=%s document_id=%s", args.organization_id, args.document_id)
    payload = provenance_repository.latest_job_payload(
        organization_id=args.organization_id, document_id=args.document_id,
    )
    try:
        DocumentProcessingAgent(settings, DocumentProcessingRepository(settings.database_url)).process_job(
            payload, request_id=f"provenance-repair-{uuid.uuid4()}",
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        print("Repair blocked:", detail.get("error_code", exc.status_code), detail.get("message", ""))
        return 2
    after = audit_service.audit(organization_id=args.organization_id, document_id=args.document_id)
    logger.warning("PROVENANCE_REPAIR_DONE organization_id=%s document_id=%s outcome=%s issue_count=%s", args.organization_id, args.document_id, "PASS" if after.passed else "FAIL", len(after.issues))
    print("Final audit:", "PASS" if after.passed else "FAIL")
    print("Images:", after.image_count, "Image OCR rows:", after.image_text_count, "Chunks:", after.chunk_count)
    return 0 if after.passed else 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    raise SystemExit(main())
