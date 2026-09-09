import fitz

from app.parsers.pymupdf_parser import InvalidPdfFileError
from app.schemas.extraction_result import ImagePageResult

VISUAL_SAMPLE_MAX_PIXELS = 200_000
NON_WHITE_PIXEL_THRESHOLD = 25


def detect_page_images(pdf_path: str) -> list[ImagePageResult]:
    try:
        document = fitz.open(pdf_path)
    except Exception as exc:
        raise InvalidPdfFileError("Invalid PDF file") from exc

    results: list[ImagePageResult] = []
    try:
        for index, page in enumerate(document, start=1):
            try:
                refs = []
                seen_placements: set[tuple[int, float, float, float, float] | tuple[int, None, None, None, None]] = set()
                for image in page.get_images(full=True):
                    xref = image[0]
                    smask = image[1] if len(image) > 1 else 0
                    width = image[2] if len(image) > 2 else None
                    height = image[3] if len(image) > 3 else None
                    rects = page.get_image_rects(xref) or []
                    # page.get_images(full=True) may include inherited/shared XObjects
                    # that are not painted on this page. Without a placement rectangle
                    # there is no page ownership, so persisting the xref contaminates
                    # every page that inherits the resource dictionary.
                    if not rects:
                        continue
                    for rect in rects:
                        key = (xref, float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1))
                        if key in seen_placements:
                            continue
                        seen_placements.add(key)
                        area_ratio = (rect.width * rect.height) / max(1.0, page.rect.width * page.rect.height)
                        refs.append({
                            "xref": xref,
                            "smask": smask,
                            "width": width,
                            "height": height,
                            "bbox": [float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)],
                            "coordinate_system": "pdf_top_left",
                            "is_decorative": rect.width < 32 or rect.height < 32 or area_ratio < 0.0005,
                        })
                visual_content_detected = _page_has_renderable_content(page)
                results.append(
                    ImagePageResult(
                        page_number=index,
                        image_count=len(refs),
                        image_refs=refs,
                        visual_content_detected=visual_content_detected,
                        page_width=float(page.rect.width),
                        page_height=float(page.rect.height),
                    )
                )
            except Exception as exc:
                results.append(ImagePageResult(page_number=index, image_count=0, image_refs=[], error=str(exc)))
        return results
    finally:
        document.close()


def _page_has_renderable_content(page: fitz.Page) -> bool:
    try:
        rect = page.rect
        if rect.width <= 0 or rect.height <= 0:
            return False

        scale = min(1.0, (VISUAL_SAMPLE_MAX_PIXELS / (rect.width * rect.height)) ** 0.5)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        samples = pixmap.samples
        channels = pixmap.n
        if channels < 3:
            return bool(samples)

        non_white_pixels = 0
        step = channels
        for offset in range(0, len(samples), step):
            red = samples[offset]
            green = samples[offset + 1]
            blue = samples[offset + 2]
            if red < 245 or green < 245 or blue < 245:
                non_white_pixels += 1
                if non_white_pixels >= NON_WHITE_PIXEL_THRESHOLD:
                    return True
        return False
    except Exception:
        return False

