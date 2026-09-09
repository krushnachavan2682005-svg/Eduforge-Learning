from app.chunkers.page_aware_chunker import create_page_aware_chunks
from app.cleaners.header_footer_remover import remove_repeated_headers_footers
from app.cleaners.text_normalizer import normalize_text
from app.database.repositories import DocumentProcessingRepository
from app.schemas.chunking import ChunkingSummary, PageTextForChunking


class TextCleaningError(Exception):
    pass


class DocumentChunkingError(Exception):
    pass


class ChunkingPipeline:
    def __init__(self, repository: DocumentProcessingRepository) -> None:
        self.repository = repository

    def build_chunks(self, *, organization_id: str, document_id: str) -> list:
        try:
            page_texts = self.repository.get_page_texts_for_document(
                organization_id=organization_id,
                document_id=document_id,
            )
            page_metadata = self.repository.get_page_metadata_for_document(
                organization_id=organization_id,
                document_id=document_id,
            )
        except Exception as exc:
            raise DocumentChunkingError("Failed to load extracted page text for chunking") from exc

        if not page_texts:
            return []

        try:
            cleaned_pages = remove_repeated_headers_footers(
                [
                    {
                        "page_number": page["page_number"],
                        "text": normalize_text(page["text"]),
                    }
                    for page in page_texts
                ]
            )
        except Exception as exc:
            raise TextCleaningError("Failed to clean extracted page text") from exc

        try:
            metadata_by_page = {page["page_number"]: page for page in page_metadata}
            pages_for_chunking = [
                PageTextForChunking(
                    page_number=page["page_number"],
                    text=page["text"],
                    text_length=len(page["text"]),
                    has_tables=metadata_by_page.get(page["page_number"], {}).get("has_tables", False),
                    has_images=metadata_by_page.get(page["page_number"], {}).get("has_images", False),
                    table_count=metadata_by_page.get(page["page_number"], {}).get("table_count", 0),
                    image_count=metadata_by_page.get(page["page_number"], {}).get("image_count", 0),
                )
                for page in cleaned_pages
                if page["text"].strip()
            ]
            return create_page_aware_chunks(pages_for_chunking)
        except Exception as exc:
            raise DocumentChunkingError("Failed to create page-aware chunks") from exc


def summarize_chunks(chunks: list) -> ChunkingSummary:
    return ChunkingSummary(
        chunks_saved=len(chunks),
        total_token_count=sum(chunk.token_count for chunk in chunks),
        total_char_count=sum(chunk.char_count for chunk in chunks),
    )
