from app.config.settings import Settings
from app.image_ocr.models import CandidateDecision, EmbeddedImageOcrCandidate


class EmbeddedImageOcrCandidateSelector:
    FULL_PAGE_AREA_RATIO = 0.90

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def select(self, candidate: EmbeddedImageOcrCandidate) -> CandidateDecision:
        metadata = candidate.image_metadata
        if not self.settings.image_ocr_enabled:
            return CandidateDecision(candidate, False, "IMAGE_OCR_DISABLED")
        if candidate.is_decorative or metadata.get("is_decorative"):
            return CandidateDecision(candidate, False, "DECORATIVE_IMAGE")
        if metadata.get("is_synthetic_page_visual") or metadata.get("type") == "rendered_page_visual_content":
            return CandidateDecision(candidate, False, "SYNTHETIC_SCANNED_PAGE")
        semantic_type = str(metadata.get("semantic_type") or metadata.get("classification") or "").lower()
        if metadata.get("is_non_semantic") or semantic_type in {
            "logo", "icon", "border", "separator", "background",
        }:
            return CandidateDecision(candidate, False, "NON_SEMANTIC_IMAGE")
        if (
            int(metadata.get("xref_occurrences") or 0) >= 3
            and candidate.pixel_width is not None
            and candidate.pixel_height is not None
            and candidate.pixel_width < self.settings.image_ocr_min_width * 4
            and candidate.pixel_height < self.settings.image_ocr_min_height * 4
        ):
            return CandidateDecision(candidate, False, "REPEATED_SMALL_ASSET")
        if candidate.page_has_ocr and self._is_full_page(candidate):
            return CandidateDecision(candidate, False, "SYNTHETIC_SCANNED_PAGE")
        if candidate.page_number <= 0:
            return CandidateDecision(candidate, False, "INVALID_PAGE_NUMBER")
        if (
            candidate.pixel_width is not None
            and candidate.pixel_height is not None
            and (
                candidate.pixel_width < self.settings.image_ocr_min_width
                or candidate.pixel_height < self.settings.image_ocr_min_height
            )
        ):
            return CandidateDecision(candidate, False, "TOO_SMALL")
        valid_bbox = candidate.bbox is not None and _valid_bbox(candidate.bbox)
        if not candidate.xref and not valid_bbox:
            return CandidateDecision(candidate, False, "INVALID_IMAGE_REFERENCE")
        return CandidateDecision(candidate, True)

    def _is_full_page(self, candidate: EmbeddedImageOcrCandidate) -> bool:
        if not candidate.bbox or not candidate.page_width or not candidate.page_height:
            return False
        x0, y0, x1, y1 = candidate.bbox
        image_area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
        return image_area / (candidate.page_width * candidate.page_height) >= self.FULL_PAGE_AREA_RATIO


def _valid_bbox(bbox: tuple[float, float, float, float]) -> bool:
    return bbox[2] > bbox[0] and bbox[3] > bbox[1]
