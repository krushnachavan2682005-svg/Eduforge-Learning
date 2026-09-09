import re
from collections import Counter


def remove_repeated_headers_footers(page_texts: list[dict]) -> list[dict]:
    first_last_lines = Counter()
    for page in page_texts:
        lines = _content_lines(page["text"])
        candidates = lines[:2] + lines[-2:]
        first_last_lines.update(_normalize_line(line) for line in candidates if _normalize_line(line))

    repeated = {
        line
        for line, count in first_last_lines.items()
        if count >= 3 and len(line) <= 120
    }

    cleaned_pages = []
    for page in page_texts:
        kept_lines = []
        for line in page["text"].splitlines():
            normalized = _normalize_line(line)
            if normalized in repeated:
                continue
            if _is_standalone_page_number(normalized):
                continue
            kept_lines.append(line)
        cleaned_pages.append({**page, "text": "\n".join(kept_lines).strip()})

    return cleaned_pages


def _content_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _normalize_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip()).lower()


def _is_standalone_page_number(line: str) -> bool:
    return bool(re.fullmatch(r"(page\s*)?\d{1,4}", line, flags=re.IGNORECASE))
