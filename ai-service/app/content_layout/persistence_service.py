import logging
import time

from app.content_layout.models import ContentLayoutSummary, ResolvedContentBlock
from app.content_layout.repository import ContentBlockRepository

logger = logging.getLogger(__name__)


class ContentBlockPersistenceError(Exception):
    pass


class ContentBlockPersistenceService:
    def __init__(self, repository: ContentBlockRepository) -> None:
        self.repository = repository

    def persist(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        blocks: list[ResolvedContentBlock],
        summary: ContentLayoutSummary,
    ) -> int:
        started = time.monotonic()
        try:
            count = self.repository.replace_blocks(
                job_id=job_id,
                organization_id=organization_id,
                document_id=document_id,
                blocks=blocks,
                content_layout_metadata=summary.model_dump(exclude={"page_summaries"}),
            )
            logger.info(
                "CONTENT_LAYOUT_BLOCKS_PERSISTED organization_id=%s document_id=%s persisted_count=%s duration_ms=%s",
                organization_id, document_id, count, round((time.monotonic() - started) * 1000),
            )
            return count
        except Exception as exc:
            table_blocks = [block for block in blocks if block.block_type == "TABLE"]
            for block in table_blocks:
                logger.exception(
                    "TABLE_RECONSTRUCTION_FAILED organization_id=%s document_id=%s table_id=%s page_number=%s table_index=%s row_count=%s column_count=%s formatted_text_length=%s block_order=%s duration_ms=%s",
                    organization_id, document_id, block.source_id, block.page_number,
                    block.metadata.get("table_index"), block.metadata.get("row_count"),
                    block.metadata.get("column_count"), len(block.content_text or ""),
                    block.block_order, round((time.monotonic() - started) * 1000),
                )
            logger.error(
                "CONTENT_LAYOUT_FAILED organization_id=%s document_id=%s duration_ms=%s",
                organization_id, document_id, round((time.monotonic() - started) * 1000),
            )
            raise ContentBlockPersistenceError("Failed to replace ordered content blocks") from exc
