import logging
import time
from typing import Any

from app.chunking.assembler import CanonicalContentAssembler
from app.chunking.chunker import StructureAwarePageAwareChunker
from app.chunking.cleaner import ContentTypeAwareTextCleaner
from app.chunking.header_footer_detector import RepeatedHeaderFooterDetector
from app.chunking.models import ChunkConfig, ChunkingSummary, HeaderFooterConfig
from app.chunking.persistence_service import ChunkPersistenceService
from app.chunking.repository import CanonicalContentRepository, ChunkRepository
from app.chunking.section_detector import SectionDetector
from app.chunking.token_counter import TokenCounter
from app.chunking.validator import ChunkValidator
from app.config.settings import Settings
from app.provenance.content_integrity_validator import CanonicalContentIntegrityValidator

logger = logging.getLogger(__name__)


class TextCleaningError(RuntimeError): pass
class DocumentChunkingError(RuntimeError): pass


class ChunkingPipeline:
    def __init__(
        self,
        *,
        content_repository: CanonicalContentRepository,
        chunk_repository: ChunkRepository,
        chunk_config: ChunkConfig,
        header_footer_config: HeaderFooterConfig,
    ) -> None:
        self.content_repository = content_repository
        self.assembler = CanonicalContentAssembler()
        self.header_footer = RepeatedHeaderFooterDetector(header_footer_config)
        self.cleaner = ContentTypeAwareTextCleaner()
        self.sections = SectionDetector()
        self.counter = TokenCounter()
        self.chunker = StructureAwarePageAwareChunker(self.counter, chunk_config)
        self.validator = ChunkValidator()
        self.persistence = ChunkPersistenceService(chunk_repository)
        self.config = chunk_config
        self.integrity = CanonicalContentIntegrityValidator()

    @classmethod
    def from_settings(cls, settings: Settings) -> "ChunkingPipeline":
        return cls(
            content_repository=CanonicalContentRepository(settings.database_url),
            chunk_repository=ChunkRepository(settings.database_url),
            chunk_config=ChunkConfig(settings.chunk_target_tokens, settings.chunk_max_tokens, settings.chunk_min_tokens, settings.chunk_overlap_tokens),
            header_footer_config=HeaderFooterConfig(settings.header_footer_min_pages, settings.header_footer_occurrence_ratio, settings.header_top_band_ratio, settings.footer_bottom_band_ratio, settings.header_footer_similarity),
        )

    def run(self, *, organization_id: str, document_id: str, job_id: str | None = None, dry_run: bool = False) -> tuple[list[Any], ChunkingSummary]:
        started = time.monotonic()
        logger.info("CHUNKING_START organization_id=%s document_id=%s job_id=%s target_tokens=%s max_tokens=%s overlap_tokens=%s", organization_id, document_id, job_id, self.config.target_tokens, self.config.max_tokens, self.config.overlap_tokens)
        try:
            loaded = self.content_repository.load(organization_id=organization_id, document_id=document_id)
            job_id = job_id or _string(loaded["document"].get("job_id"))
            logger.info("CHUNKING_DOCUMENT_VALIDATED organization_id=%s document_id=%s job_id=%s", organization_id, document_id, job_id)
            rows = loaded["blocks"]
            pages = len({row["page_number"] for row in rows})
            logger.info("CHUNKING_CONTENT_BLOCKS_FETCHED organization_id=%s document_id=%s pages=%s source_block_count=%s", organization_id, document_id, pages, len(rows))
            units = self.assembler.assemble(rows)
            units, headers_removed, footers_removed = self.header_footer.detect(units)
            logger.info("HEADER_FOOTER_DETECTION_DONE organization_id=%s document_id=%s headers_removed=%s footers_removed=%s", organization_id, document_id, headers_removed, footers_removed)
            try:
                cleaned = self.cleaner.clean(units)
            except Exception as exc:
                raise TextCleaningError("Failed to conservatively clean canonical content") from exc
            logger.info("TEXT_CLEANING_DONE organization_id=%s document_id=%s semantic_unit_count=%s total_char_count=%s", organization_id, document_id, len(cleaned), sum(len(unit.text) for unit in cleaned))
            sectioned = self.sections.assign(cleaned)
            logger.info("SECTION_DETECTION_DONE organization_id=%s document_id=%s sections=%s", organization_id, document_id, len({unit.section_title for unit in sectioned if unit.section_title}))
            logger.info("SEMANTIC_UNITS_CREATED organization_id=%s document_id=%s semantic_unit_count=%s", organization_id, document_id, len(sectioned))
            chunks = self.chunker.create(sectioned)
            logger.info("CHUNK_ASSEMBLY_DONE organization_id=%s document_id=%s chunk_count=%s", organization_id, document_id, len(chunks))
            self.validator.validate(chunks, max_tokens=self.config.max_tokens)
            self.integrity.validate_chunk_sources(chunks, rows)
            logger.info("CHUNK_VALIDATION_DONE organization_id=%s document_id=%s chunk_count=%s", organization_id, document_id, len(chunks))
            summary = _summary(rows, sectioned, chunks, pages, headers_removed, footers_removed, self.counter.name, self.config, job_id)
            if not chunks:
                logger.warning("CHUNKING_NO_TEXT organization_id=%s document_id=%s source_block_count=%s", organization_id, document_id, len(rows))
                if not dry_run: self.persistence.persist_no_text(organization_id=organization_id, document_id=document_id, summary=summary)
            elif not dry_run:
                self.persistence.persist(organization_id=organization_id, document_id=document_id, chunks=chunks, summary=summary)
            logger.info("CHUNKING_DONE organization_id=%s document_id=%s job_id=%s chunk_count=%s total_token_count=%s total_char_count=%s duration_ms=%s dry_run=%s", organization_id, document_id, job_id, len(chunks), summary.total_chunk_tokens, sum(chunk.char_count for chunk in chunks), round((time.monotonic()-started)*1000), dry_run)
            return chunks, summary
        except (TextCleaningError, DocumentChunkingError):
            raise
        except Exception as exc:
            logger.exception("CHUNKING_FAILED organization_id=%s document_id=%s job_id=%s duration_ms=%s", organization_id, document_id, job_id, round((time.monotonic()-started)*1000))
            raise DocumentChunkingError("Structure-aware chunking failed") from exc


def _summary(rows: list[dict[str, Any]], units: list[Any], chunks: list[Any], pages: int, headers: int, footers: int, tokenizer: str, config: ChunkConfig, job_id: str | None) -> ChunkingSummary:
    return ChunkingSummary(
        source_blocks_loaded=len(rows), source_pages=pages, headers_removed=headers, footers_removed=footers,
        semantic_units_created=len(units), chunks_created=len(chunks),
        total_cleaned_characters=sum(len(unit.text) for unit in units), total_chunk_tokens=sum(chunk.token_count for chunk in chunks),
        table_chunks=sum("TABLE" in chunk.content_types for chunk in chunks), image_text_chunks=sum("IMAGE_TEXT" in chunk.content_types for chunk in chunks),
        ocr_chunks=sum(any(kind in chunk.content_types for kind in ("OCR_PARAGRAPH", "IMAGE_TEXT")) for chunk in chunks),
        low_confidence_sources=sum(unit.confidence_score is not None and unit.confidence_score < 70 for unit in units),
        tokenizer=tokenizer, target_tokens=config.target_tokens, max_tokens=config.max_tokens,
        overlap_tokens=config.overlap_tokens, job_id=job_id,
    )


def _string(value: Any) -> str | None:
    return str(value) if value is not None else None
