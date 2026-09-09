from app.analyzers.content_classifier import classify_document
from app.analyzers.page_analyzer import analyze_page
from app.schemas.extraction_result import ImagePageResult, NormalizedExtractionResult, TablePageResult, TextPageResult


class DocumentRouter:
    def route(
        self,
        *,
        document_id: str,
        job_id: str,
        text_pages: list[TextPageResult],
        table_pages: list[TablePageResult],
        image_pages: list[ImagePageResult],
    ) -> NormalizedExtractionResult:
        table_by_page = {page.page_number: page for page in table_pages}
        image_by_page = {page.page_number: page for page in image_pages}
        routes = []
        page_analyses = []

        for text_result in text_pages:
            table_result = table_by_page.get(text_result.page_number, TablePageResult(page_number=text_result.page_number))
            image_result = image_by_page.get(text_result.page_number, ImagePageResult(page_number=text_result.page_number))
            analysis = analyze_page(text_result=text_result, table_result=table_result, image_result=image_result)
            page_analyses.append(analysis)
            route = {
                "page_number": analysis.page_number,
                "route": analysis.route,
                "has_text": analysis.has_text,
                "text_length": analysis.text_length,
                "has_tables": analysis.has_tables,
                "table_count": analysis.table_count,
                "has_images": analysis.has_images,
                "image_count": analysis.image_count,
                "needs_ocr": analysis.needs_ocr,
                "tools_called": analysis.extraction_tools_required,
            }
            if analysis.needs_ocr:
                route["required_future_tool"] = "OCR_ENGINE"
            if analysis.errors:
                route["errors"] = analysis.errors
            routes.append(route)

        document_route = classify_document(page_analyses)

        return NormalizedExtractionResult(
            document_id=document_id,
            job_id=job_id,
            document_type=document_route.document_type,
            page_count=len(text_pages),
            total_text_length=sum(page.text_length for page in text_pages),
            total_table_count=sum(page.table_count for page in table_pages),
            total_image_count=sum(page.image_count for page in page_analyses),
            ocr_required=document_route.ocr_required,
            pages_requiring_ocr=document_route.pages_requiring_ocr,
            next_stage=document_route.next_stage,
            routes=routes,
            extraction_summary=document_route.extraction_summary.model_dump(),
        )

