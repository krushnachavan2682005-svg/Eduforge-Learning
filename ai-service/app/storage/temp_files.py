import os
import tempfile


def write_temp_pdf(pdf_bytes: bytes, temp_dir: str = "") -> str:
    if temp_dir:
        os.makedirs(temp_dir, exist_ok=True)
    fd, path = tempfile.mkstemp(suffix=".pdf", dir=temp_dir or None)
    with os.fdopen(fd, "wb") as handle:
        handle.write(pdf_bytes)
    return path


def cleanup_temp_file(path: str | None) -> None:
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
