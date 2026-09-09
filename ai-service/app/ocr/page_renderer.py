from pathlib import Path
from tempfile import mkstemp
import logging
import os

import fitz

logger = logging.getLogger(__name__)


class OCRPageRenderError(Exception):
    pass


def render_pdf_page_to_png(pdf_path: str, page_number: int, render_scale: float, temp_dir: str) -> str:
    try:
        document = fitz.open(pdf_path)
    except Exception as exc:
        raise OCRPageRenderError("Failed to open PDF for OCR rendering") from exc

    try:
        page_index = page_number - 1
        if page_index < 0 or page_index >= document.page_count:
            raise OCRPageRenderError(f"Page {page_number} is outside PDF page range")

        logger.warning("OCR_RENDER_PAGE page_number=%s page_index=%s", page_number, page_index)
        Path(temp_dir).mkdir(parents=True, exist_ok=True)
        page = document.load_page(page_index)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(render_scale, render_scale), alpha=False)

        fd, path = mkstemp(suffix=f"-page-{page_number}.png", dir=temp_dir)
        os.close(fd)
        pixmap.save(path)
        logger.warning(
            "OCR_IMAGE_READY page_number=%s size=%sx%s image_path_exists=%s",
            page_number,
            pixmap.width,
            pixmap.height,
            Path(path).exists(),
        )
        return path
    except OCRPageRenderError:
        raise
    except Exception as exc:
        raise OCRPageRenderError(f"Failed to render page {page_number} for OCR: {exc}") from exc
    finally:
        document.close()
