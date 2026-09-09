import shutil
from statistics import mean

from app.config.settings import Settings


class OCREngineNotAvailableError(Exception):
    pass


class OCRTextExtractionError(Exception):
    pass


def run_tesseract_ocr(image_path: str, settings: Settings) -> dict:
    pytesseract = _load_pytesseract(settings)
    try:
        text = pytesseract.image_to_string(image_path, lang=settings.ocr_language) or ""
        confidence_score = _extract_confidence(pytesseract, image_path, settings.ocr_language)
        return {
            "text": text.strip(),
            "text_length": len(text.strip()),
            "confidence_score": confidence_score,
            "engine": "tesseract",
            "language": settings.ocr_language,
        }
    except Exception as exc:
        raise OCRTextExtractionError("Failed to extract OCR text with Tesseract") from exc


def run_tesseract_data(
    image_path: str,
    settings: Settings,
    *,
    language: str,
    psm: int,
) -> dict:
    """Run one deterministic layout-aware pass with length-weighted confidence."""
    pytesseract = _load_pytesseract(settings)
    try:
        data = pytesseract.image_to_data(
            image_path,
            lang=language,
            config=f"--psm {psm}",
            output_type=pytesseract.Output.DICT,
        )
        tokens: list[dict] = []
        lines: dict[tuple[int, int, int, int], list[str]] = {}
        weighted_total = 0.0
        weight = 0
        for index, raw_text in enumerate(data.get("text", [])):
            text = str(raw_text or "").strip()
            if not text:
                continue
            raw_confidence = str(data.get("conf", [])[index])
            confidence = float(raw_confidence) if raw_confidence not in {"", "-1"} else None
            line_key = tuple(
                int(data.get(name, [0])[index])
                for name in ("block_num", "par_num", "line_num", "page_num")
            )
            lines.setdefault(line_key, []).append(text)
            token = {
                "text": text,
                "confidence": confidence,
                "left": int(data.get("left", [0])[index]),
                "top": int(data.get("top", [0])[index]),
                "width": int(data.get("width", [0])[index]),
                "height": int(data.get("height", [0])[index]),
            }
            tokens.append(token)
            if confidence is not None and confidence >= 0:
                token_weight = len(text)
                weighted_total += confidence * token_weight
                weight += token_weight
        text = "\n".join(" ".join(parts) for parts in lines.values()).strip()
        confidence_score = round(weighted_total / weight, 2) if weight else None
        return {
            "text": text,
            "text_length": len(text),
            "confidence_score": confidence_score,
            "valid_token_count": len(tokens),
            "tokens": tokens,
            "psm": psm,
            "engine": "tesseract",
            "language": language,
        }
    except Exception as exc:
        raise OCRTextExtractionError(f"Failed Tesseract image OCR pass with PSM {psm}") from exc


def _load_pytesseract(settings: Settings):
    try:
        import pytesseract
    except ImportError as exc:
        raise OCREngineNotAvailableError("pytesseract is not installed") from exc

    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        if not shutil.which(settings.tesseract_cmd) and not _path_exists(settings.tesseract_cmd):
            raise OCREngineNotAvailableError("Configured TESSERACT_CMD does not exist")
        _verify_tesseract_available(pytesseract)
        return pytesseract

    if not shutil.which("tesseract"):
        raise OCREngineNotAvailableError(
            "Tesseract OCR engine is not installed or not configured. Install Tesseract or set TESSERACT_CMD."
        )
    _verify_tesseract_available(pytesseract)
    return pytesseract


def _extract_confidence(pytesseract, image_path: str, language: str) -> float | None:
    try:
        data = pytesseract.image_to_data(image_path, lang=language, output_type=pytesseract.Output.DICT)
        confidences = [float(value) for value in data.get("conf", []) if str(value) not in {"-1", ""}]
        if not confidences:
            return None
        return round(mean(confidences), 2)
    except Exception:
        return None


def _path_exists(path: str) -> bool:
    from pathlib import Path

    return Path(path).exists()


def _verify_tesseract_available(pytesseract) -> None:
    try:
        pytesseract.get_tesseract_version()
    except Exception as exc:
        raise OCREngineNotAvailableError(
            "Tesseract OCR engine is not installed or not configured."
        ) from exc
