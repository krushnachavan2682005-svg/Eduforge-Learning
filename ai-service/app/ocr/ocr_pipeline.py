import os
import logging
from typing import Any

from app.config.settings import Settings
from app.ocr.image_preprocessor import OCRImagePreprocessingError, preprocess_ocr_image
from app.ocr.page_renderer import OCRPageRenderError, render_pdf_page_to_png
from app.ocr.tesseract_engine import OCREngineNotAvailableError, OCRTextExtractionError, run_tesseract_ocr
from app.schemas.ocr import OCRPageResult, OCRSummary


class OCRPipelineError(Exception):
    pass

logger = logging.getLogger(__name__)


class OCRPipeline:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def run(
        self,
        *,
        organization_id: str,
        document_id: str,
        pdf_path: str,
        pages: list[int] | None = None,
        ocr_pages: list[int] | None = None,
        request_id: str,
    ) -> OCRSummary:
        requested_pages = pages if pages is not None else (ocr_pages or [])
        results: list[OCRPageResult] = []
        logger.info(
            "Starting OCR pipeline request_id=%s document_id=%s pages_requested=%s",
            request_id,
            document_id,
            len(requested_pages),
        )

        for page_number in requested_pages:
            rendered_path: str | None = None
            try:
                rendered_path = render_pdf_page_to_png(
                    pdf_path=pdf_path,
                    page_number=page_number,
                    render_scale=self.settings.ocr_render_scale,
                    temp_dir=self.settings.ai_service_temp_dir,
                )
                preprocessed_path = preprocess_ocr_image(rendered_path)
                ocr_result = run_tesseract_ocr(preprocessed_path, self.settings)
                status = "COMPLETED" if ocr_result["text_length"] > 0 else "NO_TEXT_EXTRACTED"
                logger.warning(
                    "OCR_TEXT_RESULT page_number=%s text_length=%s confidence=%s status=%s",
                    page_number,
                    ocr_result["text_length"],
                    ocr_result["confidence_score"],
                    status,
                )
                results.append(
                    OCRPageResult(
                        page_number=page_number,
                        text=ocr_result["text"],
                        text_length=ocr_result["text_length"],
                        confidence_score=ocr_result["confidence_score"],
                        status=status,
                    )
                )
            except OCREngineNotAvailableError:
                raise
            except (OCRPageRenderError, OCRImagePreprocessingError, OCRTextExtractionError) as exc:
                logger.warning(
                    "OCR page failed request_id=%s document_id=%s page_number=%s error=%s",
                    request_id,
                    document_id,
                    page_number,
                    exc,
                )
                results.append(OCRPageResult(page_number=page_number, status="FAILED", error=str(exc)))
            except Exception as exc:
                logger.warning(
                    "OCR page failed request_id=%s document_id=%s page_number=%s error=%s",
                    request_id,
                    document_id,
                    page_number,
                    exc,
                )
                results.append(OCRPageResult(page_number=page_number, status="FAILED", error=str(exc)))
            finally:
                if rendered_path:
                    _cleanup_file(rendered_path)

        summary = _build_summary(results=results, language=self.settings.ocr_language, pages_requested=len(requested_pages))
        if summary.pages_processed > 0 and summary.pages_failed == summary.pages_processed:
            raise OCRPipelineError("OCR failed for all requested pages")
        logger.info(
            "OCR pipeline finished request_id=%s document_id=%s pages_processed=%s pages_succeeded=%s pages_failed=%s total_text_length=%s",
            request_id,
            document_id,
            summary.pages_processed,
            summary.pages_succeeded,
            summary.pages_failed,
            summary.total_ocr_text_length,
        )
        return summary


def _build_summary(*, results: list[OCRPageResult], language: str, pages_requested: int) -> OCRSummary:
    succeeded = [result for result in results if result.status == "COMPLETED"]
    failed = [result for result in results if result.status == "FAILED"]
    low_confidence = [result for result in results if result.status == "NO_TEXT_EXTRACTED"]
    confidence_values = [result.confidence_score for result in results if result.confidence_score is not None]

    return OCRSummary(
        ocr_engine="tesseract",
        language=language,
        tesseract_available=True,
        pages_requested=pages_requested,
        pages_processed=len(results),
        pages_succeeded=len(succeeded),
        pages_failed=len(failed),
        total_ocr_text_length=sum(result.text_length for result in results),
        average_confidence=round(sum(confidence_values) / len(confidence_values), 2) if confidence_values else None,
        low_confidence_pages=[result.page_number for result in low_confidence],
        failed_pages=[
            {"page_number": result.page_number, "error": result.error}
            for result in failed
        ],
        results=results,
    )


def _cleanup_file(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
