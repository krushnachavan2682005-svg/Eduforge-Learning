import argparse
import json
from pathlib import Path

from app.config.settings import get_settings
from app.provenance.audit_service import ProvenanceAuditService
from app.provenance.repository import ProvenanceRepository


def _summary(report) -> dict:
    codes = [issue.error_code for issue in report.issues]
    return {
        "document": report.document_id,
        "pages": report.page_count,
        "images": report.image_count,
        "image_ocr_rows": report.image_text_count,
        "image_blocks": report.image_block_count,
        "image_text_blocks": report.image_text_block_count,
        "chunks": report.chunk_count,
        "valid_image_text_relationships": report.valid_image_text_relationships,
        "invalid_image_text_relationships": report.image_text_count - report.valid_image_text_relationships,
        "cross_page_contamination": codes.count("CROSS_PAGE_IMAGE_TEXT_CONTAMINATION"),
        "cross_document_contamination": codes.count("IMAGE_TEXT_DOCUMENT_MISMATCH"),
        "missing_parents": codes.count("IMAGE_TEXT_PARENT_MISSING"),
        "fingerprint_mismatches": sum("FINGERPRINT_MISMATCH" in code for code in codes),
        "chunk_source_mismatches": sum(code.startswith("CHUNK_SOURCE_") for code in codes),
        "duplicate_attachments": codes.count("DUPLICATE_IMAGE_TEXT_ATTACHMENT"),
        "audit_result": "PASS" if report.passed else "FAIL",
        "issues": [issue.model_dump(mode="json") for issue in report.issues],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only document provenance audit")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--show-blocks", action="store_true")
    parser.add_argument("--show-chunks", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--output-file")
    args = parser.parse_args()
    repository = ProvenanceRepository(get_settings().database_url)
    report = ProvenanceAuditService(repository).audit(
        organization_id=args.organization_id, document_id=args.document_id,
    )
    output = _summary(report)
    if args.show_blocks or args.show_chunks:
        data = repository.load(organization_id=args.organization_id, document_id=args.document_id)
        if args.show_blocks:
            output["blocks"] = data["blocks"]
        if args.show_chunks:
            output["chunk_rows"] = data["chunks"]
    rendered = json.dumps(output, indent=2, default=str) if args.json else "\n".join(
        f"{key.replace('_', ' ').title()}: {value}" for key, value in output.items() if key not in {"issues", "blocks", "chunk_rows"}
    )
    if report.issues and not args.json:
        rendered += "\nIssues:\n" + "\n".join(f"- {x.error_code}: {x.message}" for x in report.issues)
    print(rendered)
    if args.output_file:
        Path(args.output_file).write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
