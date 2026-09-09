import re


_BULLET_PREFIXES = ("-", "*", "•", "·", "▪", "◦")


def repair_broken_lines(text: str) -> str:
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    lines = [line.rstrip() for line in text.splitlines()]
    repaired: list[str] = []
    buffer = ""

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            if buffer:
                repaired.append(buffer.strip())
                buffer = ""
            repaired.append("")
            continue

        if _should_preserve_line(line):
            if buffer:
                repaired.append(buffer.strip())
                buffer = ""
            repaired.append(line)
            continue

        if not buffer:
            buffer = line
            continue

        if _should_join(buffer, line):
            buffer = f"{buffer} {line}"
        else:
            repaired.append(buffer.strip())
            buffer = line

    if buffer:
        repaired.append(buffer.strip())

    return "\n".join(repaired)


def _should_preserve_line(line: str) -> bool:
    return line.startswith(_BULLET_PREFIXES) or _looks_like_heading(line)


def _should_join(previous: str, current: str) -> bool:
    if previous.endswith((".", "!", "?", ":", ";")):
        return False
    if _looks_like_heading(current):
        return False
    if current.startswith(_BULLET_PREFIXES):
        return False
    return True


def _looks_like_heading(line: str) -> bool:
    words = line.split()
    if len(words) > 10:
        return False
    letters = [char for char in line if char.isalpha()]
    if letters and sum(char.isupper() for char in letters) / len(letters) > 0.8:
        return True
    return line.endswith(":")
