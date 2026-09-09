import math
import re
from collections import defaultdict
from difflib import SequenceMatcher

from app.chunking.models import HeaderFooterConfig, SemanticUnit


class RepeatedHeaderFooterDetector:
    def __init__(self, config: HeaderFooterConfig) -> None:
        self.config = config

    def detect(self, units: list[SemanticUnit]) -> tuple[list[SemanticUnit], int, int]:
        pages = sorted({unit.page_number for unit in units})
        if len(pages) < self.config.min_pages:
            return units, 0, 0
        required = math.ceil(len(pages) * self.config.occurrence_ratio)
        candidates: dict[str, list[tuple[int, SemanticUnit]]] = {"header": [], "footer": []}
        by_page: dict[int, list[SemanticUnit]] = defaultdict(list)
        for unit in units:
            by_page[unit.page_number].append(unit)
        for page_units in by_page.values():
            textual = [unit for unit in page_units if unit.text.strip()]
            for index, unit in enumerate(textual):
                band = self._band(unit, index, len(textual))
                if band:
                    candidates[band].append((unit.page_number, unit))

        excluded: dict[str, str] = {}
        headers_removed = footers_removed = 0
        for band, values in candidates.items():
            groups: list[list[tuple[int, SemanticUnit]]] = []
            for item in values:
                normalized = _normalize(item[1].text)
                if not normalized or len(normalized) > 180:
                    continue
                match = next((group for group in groups if _similar(normalized, _normalize(group[0][1].text)) >= self.config.similarity), None)
                if match is None:
                    groups.append([item])
                else:
                    match.append(item)
            for group in groups:
                page_count = len({page for page, _ in group})
                if page_count < required:
                    continue
                ordered = sorted(group, key=lambda item: (item[0], item[1].block_order))
                for offset, (_, unit) in enumerate(ordered):
                    if band == "header" and offset == 0:
                        continue
                    excluded[unit.content_block_id] = f"REPEATED_{band.upper()}"
                    if band == "header": headers_removed += 1
                    else: footers_removed += 1
        return [unit.evolve(excluded_reason=excluded.get(unit.content_block_id)) for unit in units], headers_removed, footers_removed

    def _band(self, unit: SemanticUnit, index: int, count: int) -> str | None:
        if unit.bbox and unit.page_height:
            if unit.bbox[1] <= unit.page_height * self.config.header_band_ratio:
                return "header"
            if unit.bbox[3] >= unit.page_height * (1 - self.config.footer_band_ratio):
                return "footer"
            return None
        if index < 2: return "header"
        if index >= max(0, count - 2): return "footer"
        return None


def _normalize(text: str) -> str:
    value = re.sub(r"\b(page\s*)?\d+\s*(of|/)\s*\d+\b", "page #", text.lower())
    return re.sub(r"\s+", " ", value).strip()


def _similar(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right, autojunk=False).ratio()
