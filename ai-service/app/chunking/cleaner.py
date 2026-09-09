import re
import unicodedata

from app.chunking.models import SemanticUnit

CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
LIST_PREFIX = re.compile(r"^\s*(?:[-*•▪◦]|\d+[.)]|[A-Za-z][.)])\s+")
FIELD_VALUE = re.compile(r"^[^:\n]{1,40}:\s+\S")


class ContentTypeAwareTextCleaner:
    normalization_form = "NFC"

    def clean(self, units: list[SemanticUnit]) -> list[SemanticUnit]:
        cleaned: list[SemanticUnit] = []
        for unit in units:
            if unit.excluded_reason or unit.block_type == "IMAGE":
                continue
            text = _base_normalize(unit.text)
            if unit.block_type == "TABLE":
                text = _clean_table(text)
            elif _looks_like_code_or_json(text):
                text = _clean_code(text)
            else:
                text = _clean_prose(text, ocr=unit.block_type in {"OCR_TEXT", "IMAGE_TEXT"})
            if text:
                content_type = _refine_content_type(unit, text)
                cleaned.append(unit.evolve(text=text, content_type=content_type))
        return cleaned


def _base_normalize(text: str) -> str:
    value = unicodedata.normalize("NFC", text or "")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = CONTROL.sub("", value)
    value = value.replace("\u00a0", " ")
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def _clean_table(text: str) -> str:
    rows = []
    for line in text.splitlines():
        if "|" in line:
            rows.append(" | ".join(cell.strip() for cell in re.split(r"(?<!\\)\|", line)))
        elif line.strip():
            rows.append(re.sub(r"[ \t]+", " ", line.strip()))
    return "\n".join(rows).strip()


def _clean_code(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _clean_prose(text: str, *, ocr: bool) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    if ocr:
        lines = [re.sub(r"^[▪◦·]\s*", "• ", line) for line in lines]
    output: list[str] = []
    for line in lines:
        if not line:
            if output and output[-1] != "": output.append("")
            continue
        if output and output[-1] and _safe_to_join(output[-1], line):
            if re.search(r"[a-z]{4,}-$", output[-1]) and re.match(r"^[a-z]", line):
                output[-1] = output[-1][:-1] + line
            else:
                output[-1] += " " + line
        else:
            output.append(line)
    return "\n".join(output).strip()


def _safe_to_join(previous: str, current: str) -> bool:
    if previous.endswith((".", "!", "?", ":", ";", "|", "{", "[", ",")):
        return False
    if LIST_PREFIX.match(previous) or LIST_PREFIX.match(current):
        return False
    if FIELD_VALUE.match(previous) or FIELD_VALUE.match(current):
        return False
    if _looks_like_heading(previous) or _looks_like_code_or_json(previous + "\n" + current):
        return False
    return bool(re.search(r"[a-z0-9,)]$", previous) and re.match(r"^[a-z(]", current))


def _looks_like_code_or_json(text: str) -> bool:
    stripped = text.lstrip()
    return stripped.startswith(("{", "[")) or ("\n" in text and ("{" in text or "}" in text) and ":" in text)


def _looks_like_heading(text: str) -> bool:
    words = text.split()
    letters = [char for char in text if char.isalpha()]
    return len(words) <= 10 and bool(letters) and sum(c.isupper() for c in letters) / len(letters) >= 0.8


def _refine_content_type(unit: SemanticUnit, text: str) -> str:
    if unit.block_type == "TABLE": return "TABLE"
    if unit.block_type == "IMAGE_TEXT": return "IMAGE_TEXT"
    if unit.block_type == "OCR_TEXT": return "OCR_PARAGRAPH"
    if _looks_like_code_or_json(text): return "JSON" if text.lstrip().startswith(("{", "[")) else "CODE"
    if LIST_PREFIX.match(text): return "LIST_ITEM"
    return unit.content_type
