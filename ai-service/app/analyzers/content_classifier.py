from app.schemas.processing import DocumentRouteResult, DocumentType, ExtractionSummary, NextStage, PageAnalysis


DIGITAL_TEXT_MIN_LENGTH = 50
SCANNED_PAGE_RATIO_THRESHOLD = 0.6
DIGITAL_PAGE_RATIO_THRESHOLD = 0.7


def page_has_digital_text(text_length: int) -> bool:
    return text_length >= DIGITAL_TEXT_MIN_LENGTH


def page_needs_ocr(text_length: int, image_count: int, visual_content_detected: bool = False) -> bool:
    return text_length < DIGITAL_TEXT_MIN_LENGTH and (image_count > 0 or visual_content_detected)


def classify_document(pages: list[PageAnalysis]) -> DocumentRouteResult:
    page_count = len(pages)
    if page_count == 0:
        return DocumentRouteResult(
            document_type="UNKNOWN",
            next_stage="OCR_REQUIRED",
            ocr_required=True,
            pages_requiring_ocr=[],
            extraction_summary=ExtractionSummary(),
        )

    text_pages = sum(1 for page in pages if page.has_text)
    table_pages = sum(1 for page in pages if page.has_tables)
    image_pages = sum(1 for page in pages if page.has_images)
    scanned_pages = sum(1 for page in pages if page.needs_ocr)

    scanned_ratio = scanned_pages / page_count
    digital_ratio = text_pages / page_count

    document_type: DocumentType
    if scanned_ratio >= SCANNED_PAGE_RATIO_THRESHOLD:
        document_type = "SCANNED_PDF"
    elif digital_ratio >= DIGITAL_PAGE_RATIO_THRESHOLD and scanned_pages <= 1:
        document_type = "DIGITAL_PDF"
    elif text_pages > 0 and scanned_pages > 0:
        document_type = "MIXED_PDF"
    else:
        document_type = "UNKNOWN"

    next_stage: NextStage
    if scanned_pages > 0:
        next_stage = "OCR_REQUIRED"
    elif table_pages > 0:
        next_stage = "TABLE_EXTRACTION_READY"
    elif image_pages > 0:
        next_stage = "IMAGE_EXTRACTION_READY"
    elif text_pages > 0:
        next_stage = "CHUNKING_READY"
    else:
        next_stage = "TEXT_EXTRACTION_READY"

    return DocumentRouteResult(
        document_type=document_type,
        next_stage=next_stage,
        ocr_required=scanned_pages > 0,
        pages_requiring_ocr=[page.page_number for page in pages if page.needs_ocr],
        extraction_summary=ExtractionSummary(
            text_pages=text_pages,
            table_pages=table_pages,
            image_pages=image_pages,
            scanned_pages=scanned_pages,
        ),
    )

