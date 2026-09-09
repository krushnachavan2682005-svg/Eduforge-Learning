import logging
import os
import re
import time
from difflib import SequenceMatcher
from statistics import mean
from typing import Any

from app.config.settings import Settings, get_tesseract_status
from app.image_ocr.candidate_selector import EmbeddedImageOcrCandidateSelector
from app.image_ocr.image_loader import EmbeddedImageLoader
from app.image_ocr.image_preprocessor import ImagePreprocessor
from app.image_ocr.models import (
    EmbeddedImageOcrCandidate,
    EmbeddedImageOcrSummary,
    ImageOcrResult,
)
from app.image_ocr.ocr_engine import EmbeddedImageOcrEngine
from app.image_ocr.repository import ImageTextRepository
from app.provenance.fingerprints import ocr_configuration_fingerprint

logger = logging.getLogger(__name__)


class EmbeddedImageOcrPersistenceError(Exception):
    pass


class EmbeddedImageOcrService:
    NATIVE_OVERLAP_THRESHOLD = 0.70
    NATIVE_TEXT_SIMILARITY_THRESHOLD = 0.88

    def __init__(self, settings: Settings, repository: ImageTextRepository) -> None:
        self.settings = settings
        self.repository = repository
        self.selector = EmbeddedImageOcrCandidateSelector(settings)
        self.loader = EmbeddedImageLoader(
            temp_dir=settings.ai_service_temp_dir,
            render_scale=settings.image_ocr_render_scale,
        )
        self.preprocessor = ImagePreprocessor(settings.ai_service_temp_dir)
        self.engine = EmbeddedImageOcrEngine(settings)
        self.engine_version = get_tesseract_status(settings).get("version") or "unknown"

    def process(
        self, *, organization_id: str, document_id: str, pdf_path: str
    ) -> EmbeddedImageOcrSummary:
        started = time.monotonic()
        logger.info(
            "EMBEDDED_IMAGE_OCR_START organization_id=%s document_id=%s",
            organization_id, document_id,
        )
        try:
            context = self.repository.load_context(
                organization_id=organization_id, document_id=document_id,
            )
            candidates = [_candidate_from_row(row) for row in context["images"]]
            decisions = [self.selector.select(candidate) for candidate in candidates]
            logger.info(
                "EMBEDDED_IMAGE_CANDIDATES_FETCHED organization_id=%s document_id=%s images_detected=%s candidates_selected=%s",
                organization_id, document_id, len(candidates), sum(item.selected for item in decisions),
            )
            native_by_page = {
                row["page_number"]: row.get("layout_blocks") or []
                for row in context["native_texts"]
            }
            results: list[ImageOcrResult] = []
            already_eligible = 0
            for decision in decisions:
                candidate = decision.candidate
                if not decision.selected:
                    logger.info(
                        "EMBEDDED_IMAGE_OCR_SKIPPED organization_id=%s document_id=%s image_id=%s page_number=%s image_index=%s skip_reason=%s",
                        organization_id, document_id, candidate.image_id, candidate.page_number,
                        candidate.image_index, decision.skip_reason,
                    )
                    if decision.skip_reason == "ALREADY_PROCESSED":
                        if (
                            candidate.existing_status in {"COMPLETED", "REVIEW_REQUIRED"}
                            and not candidate.existing_duplicate_native_text
                        ):
                            already_eligible += 1
                        continue
                    results.append(ImageOcrResult(
                        image_id=candidate.image_id, page_number=candidate.page_number,
                        ocr_status="SKIPPED", ocr_language=self.settings.image_ocr_language,
                        skip_reason=decision.skip_reason,
                        ocr_config=self._base_config(),
                    ))
                    continue
                logger.info(
                    "EMBEDDED_IMAGE_OCR_CANDIDATE_SELECTED organization_id=%s document_id=%s image_id=%s page_number=%s image_index=%s xref=%s bbox=%s image_width=%s image_height=%s",
                    organization_id, document_id, candidate.image_id, candidate.page_number,
                    candidate.image_index, candidate.xref, candidate.bbox,
                    candidate.pixel_width, candidate.pixel_height,
                )
                results.append(self._process_candidate(
                    candidate=candidate, pdf_path=pdf_path,
                    native_blocks=native_by_page.get(candidate.page_number, []),
                    organization_id=organization_id, document_id=document_id,
                ))
            summary = _summarize(candidates, decisions, results, already_eligible)
            try:
                persisted = self.repository.persist_results(
                    organization_id=organization_id, document_id=document_id,
                    results=results, summary=summary,
                )
            except Exception as exc:
                raise EmbeddedImageOcrPersistenceError(
                    "Failed to persist embedded-image OCR results"
                ) from exc
            logger.info(
                "EMBEDDED_IMAGE_OCR_PERSISTED organization_id=%s document_id=%s rows_affected=%s",
                organization_id, document_id, persisted,
            )
            logger.info(
                "EMBEDDED_IMAGE_OCR_DONE organization_id=%s document_id=%s images_processed=%s images_completed=%s review_required=%s no_text_detected=%s failed=%s duration_ms=%s",
                organization_id, document_id, summary.images_processed, summary.images_completed,
                summary.review_required, summary.no_text_detected, summary.failed,
                round((time.monotonic() - started) * 1000),
            )
            return summary
        except Exception:
            logger.exception(
                "EMBEDDED_IMAGE_OCR_FAILED organization_id=%s document_id=%s duration_ms=%s",
                organization_id, document_id, round((time.monotonic() - started) * 1000),
            )
            raise

    def _process_candidate(
        self, *, candidate: EmbeddedImageOcrCandidate, pdf_path: str,
        native_blocks: list[dict[str, Any]], organization_id: str, document_id: str,
    ) -> ImageOcrResult:
        started = time.monotonic()
        acquired_path: str | None = None
        preprocessed_path: str | None = None
        source_fingerprint: str | None = None
        configuration_fingerprint: str | None = None
        try:
            acquired = self.loader.load(pdf_path=pdf_path, candidate=candidate)
            acquired_path = acquired.path
            source_fingerprint = acquired.source_image_fingerprint
            fingerprint_config = {
                **self._base_config(), "engine": "tesseract",
                "engine_version": self.engine_version,
                "psm_passes": [self.engine.PRIMARY_PSM, self.engine.FALLBACK_PSM]
                if self.settings.image_ocr_fallback_enabled else [self.engine.PRIMARY_PSM],
                "acquisition_strategy": acquired.strategy,
                "acquisition_strategy_version": "v1",
            }
            configuration_fingerprint = ocr_configuration_fingerprint(fingerprint_config)
            logger.info("IMAGE_SOURCE_FINGERPRINT_CALCULATED organization_id=%s document_id=%s page_number=%s image_id=%s source_image_fingerprint=%s ocr_configuration_fingerprint=%s", organization_id, document_id, candidate.page_number, candidate.image_id, source_fingerprint, configuration_fingerprint)
            logger.info("OCR_CACHE_LOOKUP organization_id=%s document_id=%s page_number=%s image_id=%s source_image_fingerprint=%s ocr_configuration_fingerprint=%s", organization_id, document_id, candidate.page_number, candidate.image_id, source_fingerprint, configuration_fingerprint)
            if (
                candidate.existing_status in {"COMPLETED", "REVIEW_REQUIRED", "NO_TEXT_DETECTED"}
                and candidate.existing_source_image_fingerprint == source_fingerprint
                and candidate.existing_ocr_configuration_fingerprint == configuration_fingerprint
            ):
                logger.info("OCR_CACHE_HIT_VALIDATED organization_id=%s document_id=%s page_number=%s image_id=%s source_image_fingerprint=%s ocr_configuration_fingerprint=%s", organization_id, document_id, candidate.page_number, candidate.image_id, source_fingerprint, configuration_fingerprint)
                return ImageOcrResult(
                    image_id=candidate.image_id, page_number=candidate.page_number,
                    raw_text=candidate.existing_raw_text,
                    text_length=candidate.existing_text_length,
                    confidence_score=candidate.existing_confidence_score,
                    ocr_status=candidate.existing_status,
                    ocr_language=self.settings.image_ocr_language,
                    ocr_config=candidate.existing_config,
                    ocr_metadata=candidate.existing_ocr_metadata,
                    duplicate_native_text=candidate.existing_duplicate_native_text,
                    source_image_fingerprint=source_fingerprint,
                    ocr_configuration_fingerprint=configuration_fingerprint,
                )
            if candidate.existing_status:
                logger.warning("OCR_CACHE_REJECTED organization_id=%s document_id=%s page_number=%s image_id=%s source_image_fingerprint=%s ocr_configuration_fingerprint=%s error_code=OCR_FINGERPRINT_MISMATCH", organization_id, document_id, candidate.page_number, candidate.image_id, source_fingerprint, configuration_fingerprint)
            preprocessed_path = self.preprocessor.preprocess(acquired.path)
            logger.info(
                "EMBEDDED_IMAGE_PREPROCESSING_DONE image_id=%s page_number=%s acquisition_strategy=%s image_width=%s image_height=%s",
                candidate.image_id, candidate.page_number, acquired.strategy,
                acquired.width, acquired.height,
            )
            extracted = self.engine.extract(preprocessed_path, log_context={
                "organization_id": organization_id, "document_id": document_id,
                "image_id": candidate.image_id, "page_number": candidate.page_number,
            })
            status = self.engine.classify_status(extracted)
            duplicate = status in {"COMPLETED", "REVIEW_REQUIRED"} and _duplicates_native_text(
                candidate.bbox, extracted["text"], native_blocks,
                overlap_threshold=self.NATIVE_OVERLAP_THRESHOLD,
                similarity_threshold=self.NATIVE_TEXT_SIMILARITY_THRESHOLD,
            )
            logger.info(
                "EMBEDDED_IMAGE_OCR_RESULT_SELECTED organization_id=%s document_id=%s image_id=%s page_number=%s ocr_status=%s confidence_score=%s text_length=%s selected_psm=%s acquisition_strategy=%s duration_ms=%s",
                organization_id, document_id, candidate.image_id, candidate.page_number, status,
                extracted["confidence_score"], extracted["text_length"],
                extracted["psm"], acquired.strategy, round((time.monotonic() - started) * 1000),
            )
            return ImageOcrResult(
                image_id=candidate.image_id, page_number=candidate.page_number,
                raw_text=extracted["text"], text_length=extracted["text_length"],
                confidence_score=extracted["confidence_score"], ocr_status=status,
                ocr_language=self.settings.image_ocr_language,
                ocr_config={
                    **self._base_config(),
                    "selected_psm": extracted["psm"],
                    "passes_executed": extracted["passes_executed"],
                    "acquisition_strategy": acquired.strategy,
                    "fingerprint_basis": fingerprint_config,
                },
                ocr_metadata={
                    "valid_token_count": extracted["valid_token_count"],
                    "junk_character_ratio": extracted["junk_character_ratio"],
                    "tokens": extracted["tokens"],
                    "source_pixel_width": acquired.width,
                    "source_pixel_height": acquired.height,
                },
                duplicate_native_text=duplicate,
                source_image_fingerprint=source_fingerprint,
                ocr_configuration_fingerprint=configuration_fingerprint,
            )
        except Exception as exc:
            return ImageOcrResult(
                image_id=candidate.image_id, page_number=candidate.page_number,
                ocr_status="FAILED", ocr_language=self.settings.image_ocr_language,
                ocr_config=self._base_config(),
                error_code="EMBEDDED_IMAGE_OCR_FAILED", error_message=str(exc),
                source_image_fingerprint=source_fingerprint,
                ocr_configuration_fingerprint=configuration_fingerprint,
            )
        finally:
            for path in (preprocessed_path, acquired_path):
                if path:
                    try:
                        os.remove(path)
                    except OSError:
                        pass

    def _base_config(self) -> dict[str, Any]:
        return {
            "strategy": "embedded_image_ocr_v1",
            "language": self.settings.image_ocr_language,
            "accept_confidence": self.settings.image_ocr_accept_confidence,
            "fallback_enabled": self.settings.image_ocr_fallback_enabled,
            "render_scale": self.settings.image_ocr_render_scale,
            "preprocessing": "grayscale_autocontrast_v1",
        }


def _candidate_from_row(row: dict[str, Any]) -> EmbeddedImageOcrCandidate:
    metadata = dict(row.get("image_metadata") or {})
    metadata["xref_occurrences"] = int(row.get("xref_occurrences") or 0)
    values = [row.get(name) for name in ("x0", "y0", "x1", "y1")]
    bbox = tuple(float(value) for value in values) if all(value is not None for value in values) else None
    return EmbeddedImageOcrCandidate(
        image_id=str(row["id"]), page_number=row["page_number"], image_index=row["image_index"],
        xref=int(metadata["xref"]) if metadata.get("xref") else None,
        pixel_width=int(metadata["width"]) if metadata.get("width") else None,
        pixel_height=int(metadata["height"]) if metadata.get("height") else None,
        bbox=bbox, page_width=float(row["page_width"]) if row.get("page_width") else None,
        page_height=float(row["page_height"]) if row.get("page_height") else None,
        is_decorative=bool(row.get("is_decorative")), image_metadata=metadata,
        page_has_ocr=bool(row.get("page_has_ocr")), existing_status=row.get("existing_status"),
        existing_config=row.get("existing_config") or {},
        existing_text_length=int(row.get("existing_text_length") or 0),
        existing_confidence_score=(
            float(row["existing_confidence_score"])
            if row.get("existing_confidence_score") is not None else None
        ),
        existing_duplicate_native_text=bool(row.get("existing_duplicate_native_text")),
        existing_source_image_fingerprint=row.get("existing_source_image_fingerprint"),
        existing_ocr_configuration_fingerprint=row.get("existing_ocr_configuration_fingerprint"),
        existing_raw_text=row.get("existing_raw_text") or "",
        existing_ocr_metadata=row.get("existing_ocr_metadata") or {},
    )


def _summarize(
    candidates: list[EmbeddedImageOcrCandidate], decisions: list[Any],
    results: list[ImageOcrResult], already_eligible: int,
) -> EmbeddedImageOcrSummary:
    processed = [result for result in results if result.ocr_status != "SKIPPED"]
    already = [item.candidate for item in decisions if item.skip_reason == "ALREADY_PROCESSED"]
    confidences = [result.confidence_score for result in processed if result.confidence_score is not None]
    confidences.extend(
        item.existing_confidence_score for item in already
        if item.existing_confidence_score is not None
    )
    eligible = [
        result for result in results
        if result.ocr_status in {"COMPLETED", "REVIEW_REQUIRED"} and not result.duplicate_native_text
    ]
    return EmbeddedImageOcrSummary(
        images_detected=len(candidates), candidates_selected=sum(item.selected for item in decisions),
        images_processed=len(processed),
        images_completed=(
            sum(r.ocr_status == "COMPLETED" for r in results)
            + sum(item.existing_status == "COMPLETED" for item in already)
        ),
        review_required=(
            sum(r.ocr_status == "REVIEW_REQUIRED" for r in results)
            + sum(item.existing_status == "REVIEW_REQUIRED" for item in already)
        ),
        no_text_detected=(
            sum(r.ocr_status == "NO_TEXT_DETECTED" for r in results)
            + sum(item.existing_status == "NO_TEXT_DETECTED" for item in already)
        ),
        images_skipped=sum(not item.selected for item in decisions),
        failed=sum(r.ocr_status == "FAILED" for r in results),
        total_text_length=(
            sum(r.text_length for r in processed)
            + sum(item.existing_text_length for item in already)
        ),
        average_confidence=round(mean(confidences), 2) if confidences else None,
        duplicate_native_text_suppressed=sum(r.duplicate_native_text for r in results),
        image_text_blocks_created=len(eligible) + already_eligible,
    )


def _duplicates_native_text(
    image_bbox: tuple[float, float, float, float] | None,
    ocr_text: str,
    native_blocks: list[dict[str, Any]],
    *, overlap_threshold: float, similarity_threshold: float,
) -> bool:
    if not image_bbox or not ocr_text:
        return False
    overlapping = []
    for block in native_blocks:
        bbox = block.get("bbox")
        if bbox and _overlap_fraction(tuple(float(v) for v in bbox), image_bbox) >= overlap_threshold:
            overlapping.append(block.get("text", ""))
    native = _normalize_text(" ".join(overlapping))
    image_text = _normalize_text(ocr_text)
    if not native or not image_text:
        return False
    return SequenceMatcher(None, native, image_text).ratio() >= similarity_threshold


def _normalize_text(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def _overlap_fraction(
    inner: tuple[float, float, float, float], outer: tuple[float, float, float, float]
) -> float:
    width = max(0.0, min(inner[2], outer[2]) - max(inner[0], outer[0]))
    height = max(0.0, min(inner[3], outer[3]) - max(inner[1], outer[1]))
    area = max(0.0, inner[2] - inner[0]) * max(0.0, inner[3] - inner[1])
    return width * height / area if area else 0.0
