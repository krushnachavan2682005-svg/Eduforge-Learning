from app.analyzers.content_classifier import page_has_digital_text, page_needs_ocr
from app.schemas.extraction_result import ImagePageResult, TablePageResult, TextPageResult
from app.schemas.processing import PageAnalysis, PageRoute


def analyze_page(
    *,
    text_result: TextPageResult,
    table_result: TablePageResult,
    image_result: ImagePageResult,
) -> PageAnalysis:
    has_text = page_has_digital_text(text_result.text_length)
    has_tables = table_result.table_count > 0
    visual_content_detected = image_result.image_count > 0 or image_result.visual_content_detected
    needs_ocr = page_needs_ocr(
        text_result.text_length,
        image_result.image_count,
        image_result.visual_content_detected,
    )
    has_images = image_result.image_count > 0 or needs_ocr
    effective_image_count = image_result.image_count if image_result.image_count > 0 else int(visual_content_detected)
    tools_required = ["pymupdf_text_extractor"]
    errors: list[dict[str, str]] = []

    if has_tables or not table_result.unavailable:
        tools_required.append("pdfplumber_table_extractor")
    if has_images:
        tools_required.append("pymupdf_image_detector")
    if needs_ocr:
        tools_required.append("ocr_placeholder")

    if table_result.error:
        errors.append({"tool": "pdfplumber_table_extractor", "message": table_result.error})
    if image_result.error:
        errors.append({"tool": "pymupdf_image_detector", "message": image_result.error})

    return PageAnalysis(
        page_number=text_result.page_number,
        text_length=text_result.text_length,
        has_text=has_text,
        has_tables=has_tables,
        table_count=table_result.table_count,
        has_images=has_images,
        image_count=effective_image_count,
        needs_ocr=needs_ocr,
        extraction_tools_required=tools_required,
        route=_decide_page_route(has_text=has_text, has_tables=has_tables, has_images=has_images, needs_ocr=needs_ocr),
        errors=errors,
    )


def _decide_page_route(*, has_text: bool, has_tables: bool, has_images: bool, needs_ocr: bool) -> PageRoute:
    if needs_ocr:
        return "PAGE_SCANNED_IMAGE"
    if has_text and has_tables and has_images:
        return "PAGE_TEXT_TABLE_IMAGE"
    if has_text and has_tables:
        return "PAGE_TEXT_TABLE"
    if has_text and has_images:
        return "PAGE_TEXT_IMAGE"
    if has_tables and has_images:
        return "PAGE_TABLE_IMAGE"
    if has_text:
        return "PAGE_TEXT_ONLY"
    if has_tables:
        return "PAGE_TABLE_ONLY"
    if has_images:
        return "PAGE_IMAGE_ONLY"
    return "PAGE_EMPTY_OR_UNREADABLE"

