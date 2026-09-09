from app.chunking.models import DocumentChunk


class ChunkValidationError(ValueError):
    pass


class ChunkValidator:
    def validate(self, chunks: list[DocumentChunk], *, max_tokens: int) -> None:
        for expected, chunk in enumerate(chunks):
            if chunk.chunk_index != expected: raise ChunkValidationError("Chunk indexes are not contiguous from zero")
            if not chunk.content.strip(): raise ChunkValidationError("Empty chunk content")
            if chunk.token_count <= 0 or chunk.token_count > max_tokens: raise ChunkValidationError("Chunk token count violates hard limit")
            if chunk.page_start <= 0 or chunk.page_end < chunk.page_start: raise ChunkValidationError("Invalid page range")
            if not chunk.source_pages or sorted(set(chunk.source_pages)) != chunk.source_pages: raise ChunkValidationError("Invalid source page ordering")
            if any(right != left + 1 for left, right in zip(chunk.source_pages, chunk.source_pages[1:])): raise ChunkValidationError("Non-adjacent pages merged")
            if not chunk.source_block_ids: raise ChunkValidationError("Missing source block traceability")
            if len(chunk.content_fingerprint) != 64: raise ChunkValidationError("Invalid chunk fingerprint")
