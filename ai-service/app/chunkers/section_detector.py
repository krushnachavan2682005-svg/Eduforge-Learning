KNOWN_SECTION_HEADINGS = {
    "PROFILE",
    "EDUCATION",
    "EXPERIENCE",
    "PROJECTS",
    "SELECTED PROJECTS",
    "TECHNICAL SKILLS",
    "SKILLS",
    "SUMMARY",
    "INTRODUCTION",
    "CONCLUSION",
    "REFERENCES",
    "ABSTRACT",
}


def detect_section_title(line: str) -> str | None:
    normalized = " ".join(line.strip().replace(":", "").split())
    if not normalized:
        return None

    upper = normalized.upper()
    if upper in KNOWN_SECTION_HEADINGS:
        return upper

    words = normalized.split()
    if len(words) <= 8 and normalized.endswith(":"):
        return normalized.rstrip(":")

    if len(words) <= 8 and _is_mostly_upper(normalized):
        return normalized

    if 1 <= len(words) <= 6 and all(word[:1].isupper() for word in words if word[:1].isalpha()):
        return normalized

    return None


def _is_mostly_upper(text: str) -> bool:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return False
    return sum(char.isupper() for char in letters) / len(letters) >= 0.8
