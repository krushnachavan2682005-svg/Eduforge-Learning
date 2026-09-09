import logging
from dataclasses import replace
from typing import Any

from app.content_layout.models import ResolvedContentBlock

logger=logging.getLogger(__name__)


class CanonicalContentIntegrityValidator:
    def validate_resolved(self, blocks: list[ResolvedContentBlock], sources: dict[str,list[dict[str,Any]]]) -> tuple[list[ResolvedContentBlock],list[dict[str,Any]]]:
        images={str(x["id"]):x for x in sources.get("images",[])}; texts={str(x["id"]):x for x in sources.get("image_texts",[])}; warnings=[]; valid=[]
        for block in blocks:
            if block.block_type=="IMAGE":
                image=images.get(block.source_id)
                if image and image["page_number"]==block.page_number: valid.append(block)
                else: warnings.append(_warning("IMAGE_TEXT_PARENT_MISSING",block,"Invalid IMAGE source excluded"))
            elif block.block_type=="IMAGE_TEXT":
                text=texts.get(block.source_id); parent_id=str(block.metadata.get("parent_image_id") or ""); parent=images.get(parent_id)
                if not text or not parent: warnings.append(_warning("IMAGE_TEXT_PARENT_MISSING",block,"IMAGE_TEXT without exact parent excluded")); continue
                if str(text["image_id"])!=parent_id: warnings.append(_warning("IMAGE_TEXT_IMAGE_MISMATCH",block,"IMAGE_TEXT parent identity mismatch")); continue
                if text["page_number"]!=block.page_number or parent["page_number"]!=block.page_number: warnings.append(_warning("CROSS_PAGE_IMAGE_TEXT_CONTAMINATION",block,"Cross-page IMAGE_TEXT excluded")); continue
                if not text.get("source_image_fingerprint") or not text.get("ocr_configuration_fingerprint"): warnings.append(_warning("IMAGE_FINGERPRINT_MISMATCH",block,"Unfingerprinted IMAGE_TEXT excluded")); continue
                valid.append(block)
            else: valid.append(block)
        image_texts={str(x.metadata.get("parent_image_id")):x for x in valid if x.block_type=="IMAGE_TEXT"}; ordered=[]; attached=set()
        for block in valid:
            if block.block_type=="IMAGE_TEXT": continue
            ordered.append(block)
            child=image_texts.get(block.source_id) if block.block_type=="IMAGE" else None
            if child: ordered.append(child);attached.add(child.source_id)
        for child in (x for x in valid if x.block_type=="IMAGE_TEXT" and x.source_id not in attached): warnings.append(_warning("IMAGE_TEXT_PARENT_MISSING",child,"IMAGE_TEXT missing parent IMAGE block"))
        result=[replace(block,block_order=index) for index,block in enumerate(ordered)]
        logger.info("CANONICAL_CONTENT_VALIDATION_DONE valid_blocks=%s excluded_blocks=%s",len(result),len(warnings))
        return result,warnings

    def validate_chunk_sources(self, chunks: list[Any], source_rows: list[dict[str,Any]]) -> None:
        by_id={str(row["id"]):row for row in source_rows}
        for chunk in chunks:
            for source_id in chunk.source_block_ids:
                row=by_id.get(str(source_id))
                if not row: raise ValueError("CHUNK_SOURCE_DOCUMENT_MISMATCH")
                if row["page_number"] not in chunk.source_pages: raise ValueError("CHUNK_SOURCE_PAGE_MISMATCH")
                if row["block_type"]=="IMAGE_TEXT" and (not row.get("image_id") or not row.get("image_text_id")): raise ValueError("IMAGE_TEXT_PARENT_MISSING")
        logger.info("CHUNK_PROVENANCE_VALIDATION_DONE chunk_count=%s",len(chunks))


def _warning(code: str, block: ResolvedContentBlock, message: str) -> dict[str,Any]:
    return {"warning_code":code,"page_number":block.page_number,"source_record_id":block.source_id,"fallback_used":"EXCLUDE_INVALID_IMAGE_TEXT","message":message}
