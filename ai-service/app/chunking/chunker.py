import hashlib
import json
import re
from dataclasses import replace

from app.chunking.models import ChunkConfig, DocumentChunk, SemanticUnit, STRATEGY
from app.chunking.token_counter import TokenCounter

SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


class StructureAwarePageAwareChunker:
    def __init__(self, counter: TokenCounter, config: ChunkConfig) -> None:
        config.validate()
        self.counter = counter
        self.config = config

    def create(self, units: list[SemanticUnit]) -> list[DocumentChunk]:
        atomic = [part for unit in units for part in self._split_oversized(unit)]
        groups: list[list[SemanticUnit]] = []
        current: list[SemanticUnit] = []
        for unit in atomic:
            if current and unit.page_number > max(item.page_number for item in current) + 1:
                groups.append(current); current = []
            if current and unit.is_heading and self._tokens(current) >= self.config.min_tokens:
                groups.append(current); current = []
            candidate = current + [unit]
            if current and self._tokens(candidate) > self.config.max_tokens:
                groups.append(current)
                current = self._overlap(current, unit) + [unit]
                while len(current) > 1 and self._tokens(current) > self.config.max_tokens:
                    current.pop(0)
            elif current and self._tokens(current) >= self.config.target_tokens and not unit.is_heading:
                groups.append(current)
                current = self._overlap(current, unit) + [unit]
            else:
                current.append(unit)
        if current: groups.append(current)
        return [self._make_chunk(index, group) for index, group in enumerate(groups)]

    def _split_oversized(self, unit: SemanticUnit) -> list[SemanticUnit]:
        if self.counter.count(unit.text) <= self.config.max_tokens:
            return [unit]
        if unit.content_type == "TABLE":
            return self._split_table(unit)
        paragraphs = [part.strip() for part in unit.text.split("\n\n") if part.strip()]
        pieces: list[str] = []
        for paragraph in paragraphs or [unit.text]:
            if self.counter.count(paragraph) <= self.config.max_tokens:
                pieces.append(paragraph); continue
            sentences = [part.strip() for part in SENTENCE_BOUNDARY.split(paragraph) if part.strip()]
            buffer: list[str] = []
            for sentence in sentences:
                if self.counter.count(sentence) > self.config.max_tokens:
                    if buffer: pieces.append(" ".join(buffer)); buffer = []
                    pieces.extend(self.counter.split(sentence, self.config.max_tokens)); continue
                candidate = " ".join(buffer + [sentence])
                if buffer and self.counter.count(candidate) > self.config.max_tokens:
                    pieces.append(" ".join(buffer)); buffer = [sentence]
                else: buffer.append(sentence)
            if buffer: pieces.append(" ".join(buffer))
        return [unit.evolve(text=text, metadata={**unit.metadata, "split_part": index}) for index, text in enumerate(pieces)]

    def _split_table(self, unit: SemanticUnit) -> list[SemanticUnit]:
        rows = [row for row in unit.text.splitlines() if row.strip()]
        if len(rows) <= 1:
            return [unit.evolve(text=part, metadata={**unit.metadata, "table_row_start": 1, "table_row_end": 1}) for part in self.counter.split(unit.text, self.config.max_tokens)]
        header, data = rows[0], rows[1:]
        parts: list[SemanticUnit] = []
        group: list[str] = []
        start = 1
        for row_index, row in enumerate(data, start=1):
            candidate = "\n".join([header, *group, row])
            if group and self.counter.count(candidate) > self.config.max_tokens:
                parts.append(unit.evolve(text="\n".join([header, *group]), metadata={**unit.metadata, "table_row_start": start, "table_row_end": row_index - 1, "table_header_repeated": bool(parts)}))
                group, start = [row], row_index
            elif self.counter.count(candidate) > self.config.max_tokens:
                row_parts = self.counter.split(row, max(1, self.config.max_tokens - self.counter.count(header)))
                for row_part in row_parts:
                    parts.append(unit.evolve(text=f"{header}\n{row_part}", metadata={**unit.metadata, "table_row_start": row_index, "table_row_end": row_index, "table_header_repeated": bool(parts), "oversized_row_split": True}))
                group, start = [], row_index + 1
            else: group.append(row)
        if group:
            parts.append(unit.evolve(text="\n".join([header, *group]), metadata={**unit.metadata, "table_row_start": start, "table_row_end": len(data), "table_header_repeated": bool(parts)}))
        return parts

    def _overlap(self, previous: list[SemanticUnit], incoming: SemanticUnit) -> list[SemanticUnit]:
        selected: list[SemanticUnit] = []
        budget = self.config.overlap_tokens
        for unit in reversed(previous):
            if unit.content_type in {"TABLE", "HEADING"}: continue
            count = self.counter.count(unit.text)
            if count > budget or self._tokens(list(reversed(selected)) + [incoming]) + count > self.config.max_tokens: continue
            selected.append(unit.evolve(metadata={**unit.metadata, "is_overlap": True}))
            budget -= count
            if budget <= 0: break
        return list(reversed(selected))

    def _tokens(self, units: list[SemanticUnit]) -> int:
        return self.counter.count("\n\n".join(unit.text for unit in units))

    def _make_chunk(self, index: int, units: list[SemanticUnit]) -> DocumentChunk:
        content = "\n\n".join(unit.text for unit in units).strip()
        pages = list(dict.fromkeys(unit.page_number for unit in units))
        source_ids = list(dict.fromkeys(unit.content_block_id for unit in units))
        types = list(dict.fromkeys(unit.content_type for unit in units))
        source_blocks = [_source_metadata(unit) for unit in units]
        fingerprint_input = {"content": content, "pages": pages, "source_block_ids": source_ids, "strategy": STRATEGY, "tokenizer": self.counter.name}
        fingerprint = hashlib.sha256(json.dumps(fingerprint_input, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        return DocumentChunk(
            chunk_index=index, content=content, page_start=min(pages), page_end=max(pages),
            source_pages=pages, section_title=next((unit.section_title for unit in reversed(units) if unit.section_title), None),
            content_types=types, source_block_ids=source_ids, token_count=self.counter.count(content),
            char_count=len(content), tokenizer_name=self.counter.name, chunking_strategy=STRATEGY,
            content_fingerprint=fingerprint,
            metadata={"source_blocks": source_blocks, "overlap_source_block_ids": list(dict.fromkeys(unit.content_block_id for unit in units if unit.metadata.get("is_overlap"))), "cleaning_version": "conservative_nfkc_v1"},
        )


def _source_metadata(unit: SemanticUnit) -> dict:
    value = {"content_block_id": unit.content_block_id, "page_number": unit.page_number, "block_order": unit.block_order, "block_type": unit.block_type, "source_type": unit.source_type, "source_record_id": unit.source_record_id}
    for name in ("table_id", "image_id", "image_text_id", "confidence_score", "review_status"):
        item = getattr(unit, name)
        if item is not None: value[name] = item
    for name in ("table_row_start", "table_row_end", "table_header_repeated", "oversized_row_split", "is_overlap"):
        if name in unit.metadata: value[name] = unit.metadata[name]
    for name in ("parent_image_id", "source_image_fingerprint", "ocr_configuration_fingerprint"):
        if unit.metadata.get(name) is not None: value[name] = unit.metadata[name]
    return value
