import logging
import hashlib
import os
import tempfile
from pathlib import Path

import fitz

from app.image_ocr.models import AcquiredImage, EmbeddedImageOcrCandidate

logger = logging.getLogger(__name__)


class EmbeddedImageLoadError(Exception):
    pass


class EmbeddedImageLoader:
    def __init__(self, *, temp_dir: str, render_scale: float) -> None:
        self.temp_dir = temp_dir
        self.render_scale = render_scale

    def load(self, *, pdf_path: str, candidate: EmbeddedImageOcrCandidate) -> AcquiredImage:
        Path(self.temp_dir).mkdir(parents=True, exist_ok=True)
        logger.info(
            "EMBEDDED_IMAGE_LOAD_START image_id=%s page_number=%s image_index=%s xref=%s bbox=%s",
            candidate.image_id, candidate.page_number, candidate.image_index, candidate.xref, candidate.bbox,
        )
        try:
            document = fitz.open(pdf_path)
        except Exception as exc:
            raise EmbeddedImageLoadError("Failed to open source PDF") from exc
        try:
            if candidate.xref and not candidate.image_metadata.get("smask"):
                acquired = self._extract_xref(document, candidate)
                if acquired:
                    logger.info(
                        "EMBEDDED_IMAGE_XREF_EXTRACTED image_id=%s page_number=%s xref=%s image_width=%s image_height=%s",
                        candidate.image_id, candidate.page_number, candidate.xref, acquired.width, acquired.height,
                    )
                    return acquired
            acquired = self._render_bbox(document, candidate)
            logger.info(
                "EMBEDDED_IMAGE_BBOX_RENDERED image_id=%s page_number=%s bbox=%s image_width=%s image_height=%s",
                candidate.image_id, candidate.page_number, candidate.bbox, acquired.width, acquired.height,
            )
            return acquired
        finally:
            document.close()

    def _extract_xref(
        self, document: fitz.Document, candidate: EmbeddedImageOcrCandidate
    ) -> AcquiredImage | None:
        try:
            extracted = document.extract_image(candidate.xref)
            data = extracted.get("image")
            if not data:
                return None
            extension = extracted.get("ext") or "png"
            path = self._write_bytes(data, f".{extension}")
            dimensions = _image_dimensions(path)
            if not dimensions or _is_blank(path):
                _cleanup(path)
                return None
            return AcquiredImage(path, "XREF", dimensions[0], dimensions[1], _sha256_file(path))
        except Exception:
            return None

    def _render_bbox(
        self, document: fitz.Document, candidate: EmbeddedImageOcrCandidate
    ) -> AcquiredImage:
        if candidate.bbox is None:
            raise EmbeddedImageLoadError("Image xref failed and no bounding box is available")
        if candidate.page_number < 1 or candidate.page_number > document.page_count:
            raise EmbeddedImageLoadError("Image page is outside the PDF page range")
        page = document.load_page(candidate.page_number - 1)
        clip = fitz.Rect(*candidate.bbox) & page.rect
        if clip.is_empty or clip.width <= 0 or clip.height <= 0:
            raise EmbeddedImageLoadError("Image bounding box is invalid after page clipping")
        pixmap = page.get_pixmap(
            matrix=fitz.Matrix(self.render_scale, self.render_scale), clip=clip, alpha=False,
        )
        path = self._write_bytes(pixmap.tobytes("png"), ".png")
        if _is_blank(path):
            _cleanup(path)
            raise EmbeddedImageLoadError("Rendered image crop is blank")
        return AcquiredImage(path, "BBOX_RENDER", pixmap.width, pixmap.height, _sha256_file(path))

    def _write_bytes(self, data: bytes, suffix: str) -> str:
        fd, path = tempfile.mkstemp(suffix=suffix, prefix="embedded-image-", dir=self.temp_dir)
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        return path


def _image_dimensions(path: str) -> tuple[int, int] | None:
    try:
        from PIL import Image
        with Image.open(path) as image:
            return image.size
    except Exception:
        return None


def _is_blank(path: str) -> bool:
    try:
        from PIL import Image, ImageStat
        with Image.open(path) as image:
            grayscale = image.convert("L")
            return ImageStat.Stat(grayscale).var[0] < 0.5
    except Exception:
        return True


def _cleanup(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
