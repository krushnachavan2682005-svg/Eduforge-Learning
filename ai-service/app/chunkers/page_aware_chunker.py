from app.chunkers.section_detector import detect_section_title
from app.schemas.chunking import DocumentChunk, PageTextForChunking, approximate_token_count


TARGET_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 150
MIN_CHUNK_CHARS = 200


def create_page_aware_chunks(pages: list[PageTextForChunking]) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    current_text_parts: list[str] = []
    current_pages: list[int] = []
    current_section: str | None = None
    current_metadata = _empty_metadata()

    for page in pages:
        if not page.text.strip():
            continue

        for block in _split_page_into_blocks(page.text):
            section = detect_section_title(block)
            if section:
                current_section = section

            candidate_text = "\n\n".join(current_text_parts + [block]).strip()
            if current_text_parts and len(candidate_text) > TARGET_CHUNK_CHARS:
                chunk = _make_chunk(
                    index=len(chunks) + 1,
                    text="\n\n".join(current_text_parts).strip(),
                    pages=current_pages,
                    section_title=current_section,
                    metadata=current_metadata,
                )
                if chunk:
                    chunks.append(chunk)
                overlap = _overlap_text(chunk.chunk_text if chunk else "")
                current_text_parts = [overlap, block] if overlap else [block]
                current_pages = list(dict.fromkeys(current_pages[-1:] + [page.page_number]))
                current_metadata = _merge_metadata(_empty_metadata(), page)
            else:
                current_text_parts.append(block)
                if page.page_number not in current_pages:
                    current_pages.append(page.page_number)
                current_metadata = _merge_metadata(current_metadata, page)

    final_chunk = _make_chunk(
        index=len(chunks) + 1,
        text="\n\n".join(current_text_parts).strip(),
        pages=current_pages,
        section_title=current_section,
        metadata=current_metadata,
    )
    if final_chunk:
        chunks.append(final_chunk)

    if len(chunks) > 1:
        chunks = [chunk for chunk in chunks if chunk.char_count >= MIN_CHUNK_CHARS or len(chunks) <= 2]
        for index, chunk in enumerate(chunks, start=1):
            chunk.chunk_index = index

    return chunks


def _split_page_into_blocks(text: str) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]
    if paragraphs:
        return paragraphs
    return [text.strip()] if text.strip() else []


def _make_chunk(
    *,
    index: int,
    text: str,
    pages: list[int],
    section_title: str | None,
    metadata: dict,
) -> DocumentChunk | None:
    cleaned = text.strip()
    if not cleaned:
        return None

    page_start = min(pages) if pages else 1
    page_end = max(pages) if pages else page_start
    chunk_metadata = {
        "source": "document_page_texts",
        "pages": sorted(set(pages)),
        "section_title": section_title,
        "has_tables_nearby": metadata["has_tables_nearby"],
        "has_images_nearby": metadata["has_images_nearby"],
        "table_count": metadata["table_count"],
        "image_count": metadata["image_count"],
        "cleaning_version": "v1",
        "chunking_version": "page_aware_v1",
    }
    return DocumentChunk(
        chunk_index=index,
        chunk_text=cleaned,
        cleaned_text=cleaned,
        page_start=page_start,
        page_end=page_end,
        section_title=section_title,
        token_count=approximate_token_count(cleaned),
        char_count=len(cleaned),
        metadata=chunk_metadata,
    )


def _overlap_text(text: str) -> str:
    if len(text) <= CHUNK_OVERLAP_CHARS:
        return text
    overlap = text[-CHUNK_OVERLAP_CHARS:]
    sentence_boundary = max(overlap.rfind(". "), overlap.rfind("\n"))
    return overlap[sentence_boundary + 1 :].strip() if sentence_boundary > 0 else overlap.strip()


def _empty_metadata() -> dict:
    return {
        "has_tables_nearby": False,
        "has_images_nearby": False,
        "table_count": 0,
        "image_count": 0,
    }


def _merge_metadata(metadata: dict, page: PageTextForChunking) -> dict:
    return {
        "has_tables_nearby": metadata["has_tables_nearby"] or page.has_tables,
        "has_images_nearby": metadata["has_images_nearby"] or page.has_images,
        "table_count": metadata["table_count"] + page.table_count,
        "image_count": metadata["image_count"] + page.image_count,
    }
