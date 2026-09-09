import re

from app.chunking.models import SemanticUnit

NUMBERED = re.compile(r"^(?:section|chapter)\s+\d+\b|^\d+(?:\.\d+)*[.)]?\s+\S", re.IGNORECASE)


class SectionDetector:
    def assign(self, units: list[SemanticUnit]) -> list[SemanticUnit]:
        result: list[SemanticUnit] = []
        current: str | None = None
        for unit in units:
            heading = _is_heading(unit)
            if heading:
                current = unit.text.strip().rstrip(":")
            result.append(unit.evolve(
                section_title=current,
                is_heading=heading,
                content_type="HEADING" if heading else unit.content_type,
            ))
        return result


def _is_heading(unit: SemanticUnit) -> bool:
    text = unit.text.strip()
    words = text.split()
    if unit.block_type == "HEADING" or unit.metadata.get("is_heading"):
        return True
    if not text or "\n" in text or len(words) > 12 or len(text) > 140:
        return False
    if text.endswith((".", "?", "!", ",", ";")):
        return False
    if NUMBERED.match(text):
        return True
    letters = [char for char in text if char.isalpha()]
    if letters and sum(char.isupper() for char in letters) / len(letters) >= 0.85 and len(words) >= 2:
        return True
    return 2 <= len(words) <= 8 and all(not word[:1].isalpha() or word[:1].isupper() for word in words)
