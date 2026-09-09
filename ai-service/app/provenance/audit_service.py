import logging
import time

from app.provenance.fingerprints import ocr_configuration_fingerprint
from app.provenance.models import ProvenanceAuditReport, ProvenanceIssue
from app.provenance.repository import ProvenanceRepository

logger=logging.getLogger(__name__)


class ProvenanceAuditService:
    def __init__(self, repository: ProvenanceRepository) -> None:
        self.repository=repository

    def audit(self, *, organization_id: str, document_id: str, include_derived: bool=True) -> ProvenanceAuditReport:
        started=time.monotonic(); logger.info("PROVENANCE_VALIDATION_START organization_id=%s document_id=%s",organization_id,document_id)
        data=self.repository.load(organization_id=organization_id,document_id=document_id); issues=[]
        images={str(x["id"]):x for x in data["images"]}; image_texts={str(x["id"]):x for x in data["image_texts"]}
        valid=0
        for row in data["image_texts"]:
            iid,tid=str(row["image_id"]),str(row["id"]); parent=images.get(iid)
            def add(code,msg): issues.append(ProvenanceIssue(error_code=code,message=msg,page_number=row["page_number"],image_id=iid,image_text_id=tid))
            if not parent: add("IMAGE_TEXT_PARENT_MISSING","Image-text parent image is missing"); continue
            if str(parent["organization_id"])!=organization_id: add("IMAGE_TEXT_TENANT_MISMATCH","Tenant differs from parent image")
            if str(parent["document_id"])!=document_id: add("IMAGE_TEXT_DOCUMENT_MISMATCH","Document differs from parent image")
            if parent["page_number"]!=row["page_number"]: add("IMAGE_TEXT_PAGE_MISMATCH","Page differs from parent image")
            source=row.get("source_image_fingerprint"); config=row.get("ocr_configuration_fingerprint")
            if row["ocr_status"] not in {"FAILED","SKIPPED"} and not source: add("IMAGE_FINGERPRINT_MISMATCH","Source image fingerprint is missing")
            if row["ocr_status"] not in {"FAILED","SKIPPED"} and not config: add("OCR_CONFIG_FINGERPRINT_MISMATCH","OCR configuration fingerprint is missing")
            parent_fp=(parent.get("image_metadata") or {}).get("source_image_fingerprint")
            if source and parent_fp and source!=parent_fp: add("IMAGE_FINGERPRINT_MISMATCH","Source fingerprint differs from parent image metadata")
            basis=(row.get("ocr_config") or {}).get("fingerprint_basis")
            if config and basis and ocr_configuration_fingerprint(basis)!=config: add("OCR_CONFIG_FINGERPRINT_MISMATCH","OCR configuration fingerprint is invalid")
            if not any(x.image_text_id==tid for x in issues): valid+=1
        if include_derived:
            blocks=data["blocks"]; by_id={str(x["id"]):x for x in blocks}; page_groups={}
            for block in blocks: page_groups.setdefault(block["page_number"],[]).append(block)
            attachments={}
            for page,rows in page_groups.items():
                for index,block in enumerate(rows):
                    if block["block_type"]!="IMAGE_TEXT": continue
                    bid=str(block["id"]); tid=str(block["image_text_id"]) if block.get("image_text_id") else None; iid=str(block["image_id"]) if block.get("image_id") else None
                    def badd(code,msg): issues.append(ProvenanceIssue(error_code=code,message=msg,page_number=page,image_id=iid,image_text_id=tid,content_block_id=bid))
                    source=image_texts.get(tid or ""); parent=images.get(iid or "")
                    if not source: badd("IMAGE_TEXT_PARENT_MISSING","Image-text source is missing"); continue
                    if not parent: badd("IMAGE_TEXT_PARENT_MISSING","Parent image is missing"); continue
                    if str(source["image_id"])!=iid: badd("IMAGE_TEXT_IMAGE_MISMATCH","Block parent differs from image-text parent")
                    if source["page_number"]!=page or parent["page_number"]!=page: badd("CROSS_PAGE_IMAGE_TEXT_CONTAMINATION","Block page differs from source page")
                    previous=rows[index-1] if index else None
                    if not previous or previous["block_type"]!="IMAGE" or str(previous.get("image_id"))!=iid: badd("IMAGE_TEXT_PARENT_MISSING","IMAGE_TEXT does not immediately follow its exact IMAGE")
                    attachments.setdefault(tid,set()).add((iid,page))
            for tid,parents in attachments.items():
                if len(parents)>1: issues.append(ProvenanceIssue(error_code="DUPLICATE_IMAGE_TEXT_ATTACHMENT",message="Image-text is attached to multiple parents/pages",image_text_id=tid,metadata={"parents":sorted(parents)}))
            for chunk in data["chunks"]:
                for source_id in chunk["source_block_ids"]:
                    block=by_id.get(str(source_id))
                    if not block: issues.append(ProvenanceIssue(error_code="CHUNK_SOURCE_DOCUMENT_MISMATCH",message="Chunk source block is missing",chunk_index=chunk["chunk_index"],content_block_id=str(source_id))); continue
                    if block["page_number"] not in chunk["source_pages"]: issues.append(ProvenanceIssue(error_code="CHUNK_SOURCE_PAGE_MISMATCH",message="Chunk source_pages omit block page",page_number=block["page_number"],chunk_index=chunk["chunk_index"],content_block_id=str(source_id)))
        report=ProvenanceAuditReport(organization_id=organization_id,document_id=document_id,page_count=data["document"].get("page_count") or 0,image_count=len(images),image_text_count=len(image_texts),image_block_count=sum(x["block_type"]=="IMAGE" for x in data["blocks"]),image_text_block_count=sum(x["block_type"]=="IMAGE_TEXT" for x in data["blocks"]),chunk_count=len(data["chunks"]),valid_image_text_relationships=valid,issues=issues)
        event="PROVENANCE_AUDIT_PASSED" if report.passed else "PROVENANCE_AUDIT_FAILED";getattr(logger,"info" if report.passed else "error")("%s organization_id=%s document_id=%s issue_count=%s duration_ms=%s",event,organization_id,document_id,len(issues),round((time.monotonic()-started)*1000))
        return report
