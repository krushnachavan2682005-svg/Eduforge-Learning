import re
from dataclasses import dataclass

TOKEN_PATTERN = re.compile(r"\w+|[^\w\s]", re.UNICODE)


@dataclass(frozen=True)
class TokenSpan:
    text: str
    start: int
    end: int


class TokenCounter:
    name = "unicode_regex_v1"

    def count(self, text: str) -> int:
        return len(TOKEN_PATTERN.findall(text))

    def spans(self, text: str) -> list[TokenSpan]:
        return [TokenSpan(match.group(0), match.start(), match.end()) for match in TOKEN_PATTERN.finditer(text)]

    def split(self, text: str, max_tokens: int) -> list[str]:
        spans = self.spans(text)
        if not spans:
            return []
        parts: list[str] = []
        for start in range(0, len(spans), max_tokens):
            group = spans[start : start + max_tokens]
            parts.append(text[group[0].start : group[-1].end].strip())
        return [part for part in parts if part]
