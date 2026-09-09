import argparse
import json
import sys

from app.config.settings import get_settings
from app.diagnostics.document_processing_diagnostics import DocumentProcessingDiagnosticsService
from app.diagnostics.repository import DiagnosticsRepository


def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--organization-id",required=True); parser.add_argument("--document-id",required=True)
    parser.add_argument("--show-pages",action="store_true"); parser.add_argument("--show-stage-metadata",action="store_true")
    parser.add_argument("--json",action="store_true"); parser.add_argument("--output-file")
    args=parser.parse_args()
    try:
        report=DocumentProcessingDiagnosticsService(DiagnosticsRepository(get_settings().database_url)).diagnose(organization_id=args.organization_id,document_id=args.document_id)
        if args.json:
            output=report.model_dump_json(indent=2)
        else:
            d,j=report.document,report.job or {}
            lines=[f"Document: {d.get('original_file_name')}",f"Page count: {d.get('page_count')}",f"Current stage: {d.get('processing_stage')}",f"Job status: {j.get('status')}",f"Terminal failure stage: {report.terminal_failure_stage or 'NONE'}",f"Critical failures: {sum(not x.recoverable for x in report.failures)}",f"Recoverable warnings: {len(report.warnings)}",""]
            for s in report.stages: lines.append(f"{s.stage:30} {s.status.value.replace('_',' ')}")
            if args.show_pages:
                for p in report.pages: lines.extend(["",f"Page {p.page_number}:",f"  text_length={p.text_length} tables={p.tables_detected} images={p.images_detected} image_texts={p.image_ocr_completed} content_blocks={p.content_blocks_created}",f"  warnings={','.join(w.warning_code for w in p.warnings) or 'NONE'}"])
            output="\n".join(lines)
        if args.output_file: open(args.output_file,"w",encoding="utf-8").write(output+"\n")
        print(output); return 0
    except Exception as exc:
        print(f"Diagnostics failed: {exc}",file=sys.stderr); return 1


if __name__ == "__main__": raise SystemExit(main())
