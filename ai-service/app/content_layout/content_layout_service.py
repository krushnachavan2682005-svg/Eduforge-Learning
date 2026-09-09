import logging
import time
from collections import defaultdict
from decimal import Decimal
from typing import Any

from app.content_layout.models import BBox, ContentLayoutSummary, LayoutCandidate, ResolvedContentBlock
from app.content_layout.persistence_service import ContentBlockPersistenceService
from app.content_layout.reading_order import ReadingOrderResolver
from app.content_layout.repository import ContentBlockRepository
from app.content_layout.table_readable_text_formatter import TableReadableTextFormatter
from app.provenance.content_integrity_validator import CanonicalContentIntegrityValidator

logger = logging.getLogger(__name__)


class ContentLayoutService:
    def __init__(self, repository: ContentBlockRepository) -> None:
        self.repository = repository
        self.resolver = ReadingOrderResolver()
        self.persistence = ContentBlockPersistenceService(repository)
        self.table_formatter = TableReadableTextFormatter()
        self.integrity_validator = CanonicalContentIntegrityValidator()

    def process(self, *, job_id: str, organization_id: str, document_id: str) -> ContentLayoutSummary:
        try:
            return self._process(job_id=job_id, organization_id=organization_id, document_id=document_id)
        except Exception:
            logger.exception(
                "CONTENT_LAYOUT_FAILED organization_id=%s document_id=%s",
                organization_id, document_id,
            )
            raise

    def _process(self, *, job_id: str, organization_id: str, document_id: str) -> ContentLayoutSummary:
        started = time.monotonic()
        logger.info("CONTENT_LAYOUT_START organization_id=%s document_id=%s", organization_id, document_id)
        sources = self.repository.load_sources(organization_id=organization_id, document_id=document_id)
        logger.info(
            "CONTENT_LAYOUT_SOURCE_FETCHED organization_id=%s document_id=%s pages=%s texts=%s tables=%s images=%s image_texts=%s",
            organization_id, document_id, len(sources["pages"]), len(sources["texts"]),
            len(sources["tables"]), len(sources["images"]), len(sources.get("image_texts", [])),
        )
        source_warnings: list[dict[str, Any]] = []
        candidates_by_page, decorative_excluded = self._create_candidates(
            sources, organization_id=organization_id, document_id=document_id,
            warnings=source_warnings,
        )
        resolved: list[ResolvedContentBlock] = []
        page_summaries: list[dict[str, Any]] = []
        total_suppressed = 0
        page_numbers = [page["page_number"] for page in sources["pages"]]
        for page_number in page_numbers:
            page_started = time.monotonic()
            candidates = candidates_by_page.get(page_number, [])
            counts = _counts(candidates)
            logger.info(
                "CONTENT_LAYOUT_PAGE_START organization_id=%s document_id=%s page_number=%s",
                organization_id, document_id, page_number,
            )
            logger.info(
                "CONTENT_LAYOUT_CANDIDATES_CREATED organization_id=%s document_id=%s page_number=%s text_block_count=%s table_block_count=%s image_block_count=%s ocr_block_count=%s",
                organization_id, document_id, page_number, counts["text"], counts["table"], counts["image"], counts["ocr"],
            )
            page_warnings = [warning for warning in source_warnings if warning["page_number"] == page_number]
            try:
                page_blocks, suppressed = self.resolver.resolve_page(candidates)
            except Exception as exc:
                logger.exception("RECOVERABLE_PROCESSING_ERROR organization_id=%s document_id=%s stage=CONTENT_LAYOUT page_number=%s warning_code=LAYOUT_FALLBACK_USED recoverable=true", organization_id, document_id, page_number)
                page_blocks = _safe_page_fallback(candidates)
                suppressed = 0
                page_warnings.append({"warning_code": "LAYOUT_FALLBACK_USED", "page_number": page_number, "fallback_used": "SAFE_TOP_TO_BOTTOM_LEFT_TO_RIGHT", "message": "Layout resolver failed; safe geometric order was used."})
                logger.warning("PROCESSING_FALLBACK_APPLIED organization_id=%s document_id=%s stage=CONTENT_LAYOUT page_number=%s fallback=SAFE_TOP_TO_BOTTOM_LEFT_TO_RIGHT", organization_id, document_id, page_number)
            page_blocks, integrity_warnings = self.integrity_validator.validate_resolved(page_blocks, sources)
            page_warnings.extend(integrity_warnings)
            total_suppressed += suppressed
            resolved.extend(page_blocks)
            logger.info(
                "CONTENT_LAYOUT_DUPLICATES_SUPPRESSED organization_id=%s document_id=%s page_number=%s suppressed_count=%s",
                organization_id, document_id, page_number, suppressed,
            )
            logger.info(
                "CONTENT_LAYOUT_READING_ORDER_RESOLVED organization_id=%s document_id=%s page_number=%s persisted_count=%s",
                organization_id, document_id, page_number, len(page_blocks),
            )
            page_summary = {"page_number": page_number, "persisted_count": len(page_blocks), "suppressed_count": suppressed, "warnings": page_warnings}
            page_summaries.append(page_summary)
            logger.info(
                "CONTENT_LAYOUT_PAGE_DONE organization_id=%s document_id=%s page_number=%s persisted_count=%s duration_ms=%s",
                organization_id, document_id, page_number, len(page_blocks), round((time.monotonic() - page_started) * 1000),
            )
        final_counts = _counts(resolved)
        summary = ContentLayoutSummary(
            pages_processed=len(page_numbers), total_blocks=len(resolved),
            text_blocks=final_counts["text"], table_blocks=final_counts["table"],
            image_blocks=final_counts["image"], ocr_blocks=final_counts["ocr"],
            image_text_blocks=final_counts["image_text"],
            decorative_images_excluded=decorative_excluded,
            duplicate_text_blocks_suppressed=total_suppressed,
            warning_count=sum(len(page.get("warnings", [])) for page in page_summaries),
            fallbacks_used=sorted({warning["fallback_used"] for page in page_summaries for warning in page.get("warnings", [])}),
            page_summaries=page_summaries,
        )
        self.persistence.persist(
            job_id=job_id, organization_id=organization_id, document_id=document_id, blocks=resolved, summary=summary,
        )
        for block in resolved:
            if block.block_type == "TABLE":
                logger.info(
                    "TABLE_RECONSTRUCTION_DONE organization_id=%s document_id=%s table_id=%s page_number=%s table_index=%s row_count=%s column_count=%s formatted_text_length=%s block_order=%s duration_ms=%s",
                    organization_id, document_id, block.source_id, block.page_number,
                    block.metadata.get("table_index"), block.metadata.get("row_count"),
                    block.metadata.get("column_count"), len(block.content_text or ""),
                    block.block_order, round((time.monotonic() - started) * 1000),
                )
        logger.info(
            "CONTENT_LAYOUT_DONE organization_id=%s document_id=%s pages_processed=%s persisted_count=%s duration_ms=%s",
            organization_id, document_id, summary.pages_processed, summary.total_blocks,
            round((time.monotonic() - started) * 1000),
        )
        return summary

    def _create_candidates(
        self,
        sources: dict[str, list[dict[str, Any]]],
        *,
        organization_id: str,
        document_id: str,
        warnings: list[dict[str, Any]] | None = None,
    ) -> tuple[dict[int, list[LayoutCandidate]], int]:
        result: dict[int, list[LayoutCandidate]] = defaultdict(list)
        ocr_pages = {
            row["page_number"]
            for row in sources["texts"]
            if row.get("source") == "OCR" or "ocr" in row["extraction_method"].lower()
        }
        for row in sources["texts"]:
            blocks = row.get("layout_blocks") or []
            if blocks:
                for block in blocks:
                    result[row["page_number"]].append(LayoutCandidate(
                        page_number=row["page_number"], block_type="TEXT",
                        source_type="DOCUMENT_PAGE_TEXT", source_id=str(row["id"]),
                        extraction_method=row["extraction_method"], bbox=_bbox(block.get("bbox")),
                        page_width=_float(row.get("page_width")), page_height=_float(row.get("page_height")),
                        content_text=block.get("text"), metadata={"source_block_index": block.get("block_index")},
                    ))
            elif (row.get("text") or "").strip():
                is_ocr = row.get("source") == "OCR" or "ocr" in row["extraction_method"].lower()
                width, height = _float(row.get("page_width")), _float(row.get("page_height"))
                result[row["page_number"]].append(LayoutCandidate(
                    page_number=row["page_number"], block_type="OCR_TEXT" if is_ocr else "TEXT",
                    source_type="OCR_RESULT" if is_ocr else "DOCUMENT_PAGE_TEXT", source_id=str(row["id"]),
                    extraction_method=row["extraction_method"], bbox=(0.0, 0.0, width, height) if width and height else None,
                    page_width=width, page_height=height, content_text=row["text"],
                    metadata={"layout_precision": "page_level"},
                ))
        for row in sources["tables"]:
            table_started = time.monotonic()
            table_metadata = {
                "table_index": row["table_index"],
                "row_count": row["row_count"],
                "column_count": row["column_count"],
            }
            try:
                readable_table_text = self.table_formatter.format_table(
                    row["table_data"],
                    metadata={
                        "organization_id": organization_id,
                        "document_id": document_id,
                        "table_id": str(row["id"]),
                        "page_number": row["page_number"],
                        **table_metadata,
                    },
                )
            except Exception:
                logger.exception(
                    "TABLE_RECONSTRUCTION_FAILED organization_id=%s document_id=%s table_id=%s page_number=%s table_index=%s row_count=%s column_count=%s formatted_text_length=%s block_order=%s duration_ms=%s",
                    organization_id, document_id, row["id"], row["page_number"],
                    row["table_index"], row["row_count"], row["column_count"],
                    0, None, round((time.monotonic() - table_started) * 1000),
                )
                if warnings is not None:
                    warnings.append({"warning_code": "TABLE_EXTRACTION_FALLBACK", "page_number": row["page_number"], "fallback_used": "NATIVE_PAGE_TEXT", "message": "Structured table reconstruction failed; native page text was retained."})
                continue
            result[row["page_number"]].append(LayoutCandidate(
                page_number=row["page_number"], block_type="TABLE", source_type="DOCUMENT_TABLE",
                source_id=str(row["id"]), extraction_method=row["extraction_method"], bbox=_row_bbox(row),
                page_width=_float(row.get("page_width")), page_height=_float(row.get("page_height")),
                content_text=readable_table_text,
                readable_text=readable_table_text,
                metadata=table_metadata,
            ))
        decorative_excluded = 0
        included_image_ids: set[str] = set()
        for row in sources["images"]:
            metadata = row.get("image_metadata") or {}
            if (
                row.get("is_decorative")
                or metadata.get("is_synthetic_page_visual")
                or metadata.get("type") == "rendered_page_visual_content"
                or row["page_number"] in ocr_pages
            ):
                decorative_excluded += 1
                continue
            result[row["page_number"]].append(LayoutCandidate(
                page_number=row["page_number"], block_type="IMAGE", source_type="DOCUMENT_IMAGE",
                source_id=str(row["id"]), extraction_method=row["extraction_method"], bbox=_row_bbox(row),
                page_width=_float(row.get("page_width")), page_height=_float(row.get("page_height")),
                metadata={"image_index": row["image_index"], "xref": metadata.get("xref")},
            ))
            included_image_ids.add(str(row["id"]))
        for row in sources.get("image_texts", []):
            if str(row["image_id"]) not in included_image_ids:
                continue
            result[row["page_number"]].append(LayoutCandidate(
                page_number=row["page_number"], block_type="IMAGE_TEXT",
                source_type="DOCUMENT_IMAGE_TEXT", source_id=str(row["id"]),
                extraction_method=row["ocr_engine"], bbox=_row_bbox(row),
                page_width=_float(row.get("page_width")), page_height=_float(row.get("page_height")),
                content_text=row["raw_text"],
                metadata={
                    "parent_image_id": str(row["image_id"]),
                    "image_index": row["image_index"],
                    "ocr_status": row["ocr_status"],
                    "confidence_score": _float(row.get("confidence_score")),
                    "selected_psm": (row.get("ocr_config") or {}).get("selected_psm"),
                    "source_image_fingerprint": row.get("source_image_fingerprint"),
                    "ocr_configuration_fingerprint": row.get("ocr_configuration_fingerprint"),
                },
            ))
        return result, decorative_excluded


def _bbox(value: Any) -> BBox | None:
    if not value or len(value) != 4:
        return None
    return tuple(float(item) for item in value)  # type: ignore[return-value]


def _row_bbox(row: dict[str, Any]) -> BBox | None:
    values = [row.get(name) for name in ("x0", "y0", "x1", "y1")]
    return _bbox(values) if all(value is not None for value in values) else None


def _float(value: Decimal | float | int | None) -> float | None:
    return float(value) if value is not None else None


def _counts(items: list[Any]) -> dict[str, int]:
    return {
        "text": sum(item.block_type == "TEXT" for item in items),
        "table": sum(item.block_type == "TABLE" for item in items),
        "image": sum(item.block_type == "IMAGE" for item in items),
        "image_text": sum(item.block_type == "IMAGE_TEXT" for item in items),
        "ocr": sum(item.block_type == "OCR_TEXT" for item in items),
    }


def _safe_page_fallback(candidates: list[LayoutCandidate]) -> list[ResolvedContentBlock]:
    def key(item: LayoutCandidate) -> tuple[float, float, str, str]:
        if item.bbox:
            return item.bbox[1], item.bbox[0], item.block_type, item.source_id
        return float("inf"), float("inf"), item.block_type, item.source_id
    ordered = sorted(candidates, key=key)
    return [ResolvedContentBlock(**candidate.__dict__, block_order=index) for index, candidate in enumerate(ordered)]
