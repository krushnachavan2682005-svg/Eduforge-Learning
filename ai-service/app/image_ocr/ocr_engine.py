import logging

from app.config.settings import Settings
from app.ocr.tesseract_engine import run_tesseract_data

logger = logging.getLogger(__name__)


class EmbeddedImageOcrEngine:
    PRIMARY_PSM = 6
    FALLBACK_PSM = 11

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def extract(self, image_path: str, *, log_context: dict | None = None) -> dict:
        primary = self._run_pass(image_path, self.PRIMARY_PSM, log_context or {})
        passes = [primary]
        if self.settings.image_ocr_fallback_enabled and self._needs_fallback(primary):
            passes.append(self._run_pass(image_path, self.FALLBACK_PSM, log_context or {}))
        selected = max(passes, key=_result_score)
        selected["passes_executed"] = [result["psm"] for result in passes]
        selected["junk_character_ratio"] = _junk_character_ratio(selected["text"])
        logger.info(
            "EMBEDDED_IMAGE_OCR_RESULT_SELECTED organization_id=%s document_id=%s image_id=%s page_number=%s ocr_status=%s confidence_score=%s text_length=%s selected_psm=%s",
            (log_context or {}).get("organization_id"), (log_context or {}).get("document_id"),
            (log_context or {}).get("image_id"), (log_context or {}).get("page_number"),
            _status(selected, self.settings.image_ocr_accept_confidence),
            selected["confidence_score"], selected["text_length"], selected["psm"],
        )
        return selected

    def classify_status(self, result: dict) -> str:
        return _status(result, self.settings.image_ocr_accept_confidence)

    def _run_pass(self, image_path: str, psm: int, log_context: dict) -> dict:
        result = run_tesseract_data(
            image_path, self.settings, language=self.settings.image_ocr_language, psm=psm,
        )
        result["junk_character_ratio"] = _junk_character_ratio(result["text"])
        logger.info(
            "EMBEDDED_IMAGE_OCR_PASS_DONE organization_id=%s document_id=%s image_id=%s page_number=%s text_length=%s confidence_score=%s selected_psm=%s valid_token_count=%s",
            log_context.get("organization_id"), log_context.get("document_id"),
            log_context.get("image_id"), log_context.get("page_number"),
            result["text_length"], result["confidence_score"], psm, result["valid_token_count"],
        )
        return result

    def _needs_fallback(self, result: dict) -> bool:
        confidence = result.get("confidence_score")
        return (
            result.get("text_length", 0) < 4
            or confidence is None
            or confidence < self.settings.image_ocr_accept_confidence
        )


def _status(result: dict, threshold: float) -> str:
    if result.get("text_length", 0) <= 0 or result.get("valid_token_count", 0) <= 0:
        return "NO_TEXT_DETECTED"
    confidence = result.get("confidence_score")
    if confidence is not None and confidence >= threshold:
        return "COMPLETED"
    return "REVIEW_REQUIRED"


def _result_score(result: dict) -> tuple[int, float, int, int, int]:
    text_length = result.get("text_length", 0)
    confidence = result.get("confidence_score") or 0.0
    quality = confidence * (1.0 - result.get("junk_character_ratio", 1.0))
    return (
        int(text_length > 0), round(quality, 4), text_length,
        result.get("valid_token_count", 0), int(result.get("psm") == 6),
    )


def _junk_character_ratio(text: str) -> float:
    characters = [char for char in text if not char.isspace()]
    if not characters:
        return 1.0
    acceptable_punctuation = set(".,:;/%-()[]+#&'")
    junk = sum(not char.isalnum() and char not in acceptable_punctuation for char in characters)
    return round(junk / len(characters), 4)
