from app.database.repositories import DocumentProcessingRepository
from app.schemas.extraction_result import ImagePageResult, NormalizedExtractionResult, TablePageResult, TextPageResult
from app.schemas.persistence import (
    DocumentImageRow,
    DocumentPageRow,
    DocumentPageTextRow,
    DocumentTableRow,
    ExtractionPersistenceRows,
    ExtractionPersistenceSummary,
)


class ExtractionPersistenceError(Exception):
    pass


class ExtractionPersistenceService:
    def __init__(self, repository: DocumentProcessingRepository) -> None:
        self.repository = repository

    def persist(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        extraction_result: NormalizedExtractionResult,
        text_pages: list[TextPageResult],
        table_pages: list[TablePageResult],
        image_pages: list[ImagePageResult],
    ) -> ExtractionPersistenceSummary:
        rows = self._build_rows(
            organization_id=organization_id,
            document_id=document_id,
            extraction_result=extraction_result,
            text_pages=text_pages,
            table_pages=table_pages,
            image_pages=image_pages,
        )

        existing = self.repository.get_existing_extraction_summary(
            organization_id=organization_id, document_id=document_id,
        )
        expected = {
            "pages": len(rows.pages), "texts": len(rows.page_texts),
            "text_length": sum(row.text_length for row in rows.page_texts),
            "tables": len(rows.tables), "images": len(rows.images),
        }
        if existing == expected and expected["pages"] > 0:
            return ExtractionPersistenceSummary(
                document_pages_saved=expected["pages"], page_texts_saved=expected["texts"],
                tables_saved=expected["tables"], images_saved=expected["images"],
            )

        try:
            return self.repository.persist_extraction_result(
                job_id=job_id,
                organization_id=organization_id,
                document_id=document_id,
                rows=rows,
            )
        except Exception as exc:
            raise ExtractionPersistenceError("Failed to persist extracted document content") from exc

    def _build_rows(
        self,
        *,
        organization_id: str,
        document_id: str,
        extraction_result: NormalizedExtractionResult,
        text_pages: list[TextPageResult],
        table_pages: list[TablePageResult],
        image_pages: list[ImagePageResult],
    ) -> ExtractionPersistenceRows:
        page_texts_by_page = {page.page_number: page for page in text_pages}
        table_pages_by_page = {page.page_number: page for page in table_pages}
        image_pages_by_page = {page.page_number: page for page in image_pages}

        page_rows = [
            DocumentPageRow(
                organization_id=organization_id,
                document_id=document_id,
                page_number=route["page_number"],
                route=route["route"],
                has_text=route["has_text"],
                has_tables=route["has_tables"],
                has_images=route["has_images"],
                needs_ocr=route["needs_ocr"],
                text_length=route["text_length"],
                table_count=route["table_count"],
                image_count=route["image_count"],
                page_width=(
                    page_texts_by_page[route["page_number"]].page_width
                    if route["page_number"] in page_texts_by_page
                    else None
                ),
                page_height=(
                    page_texts_by_page[route["page_number"]].page_height
                    if route["page_number"] in page_texts_by_page
                    else None
                ),
            )
            for route in extraction_result.routes
        ]

        text_rows = [
            DocumentPageTextRow(
                organization_id=organization_id,
                document_id=document_id,
                page_number=page.page_number,
                text=page.text,
                text_length=page.text_length,
                layout_blocks=page.layout_blocks,
                page_width=page.page_width,
                page_height=page.page_height,
            )
            for page in page_texts_by_page.values()
            if page.text_length > 0
        ]

        table_rows: list[DocumentTableRow] = []
        for page in table_pages_by_page.values():
            if page.unavailable:
                continue
            for table_index, table in enumerate(page.tables, start=1):
                table_rows.append(
                    DocumentTableRow(
                        organization_id=organization_id,
                        document_id=document_id,
                        page_number=page.page_number,
                        table_index=table_index,
                        table_data=table,
                        row_count=_row_count(table),
                        column_count=_column_count(table),
                        extraction_method=page.extraction_method,
                        extraction_error=page.error,
                        bbox=page.table_bboxes[table_index - 1] if table_index <= len(page.table_bboxes) else None,
                        page_width=page.page_width,
                        page_height=page.page_height,
                    )
                )

        image_rows: list[DocumentImageRow] = []
        for page in image_pages_by_page.values():
            if page.visual_content_detected and not page.image_refs:
                image_rows.append(
                    DocumentImageRow(
                        organization_id=organization_id,
                        document_id=document_id,
                        page_number=page.page_number,
                        image_index=1,
                        image_metadata={
                            "type": "rendered_page_visual_content",
                            "description": "Page rendered as non-empty but no embedded image xref was exposed by PyMuPDF",
                            "is_synthetic_page_visual": True,
                        },
                        page_width=page.page_width,
                        page_height=page.page_height,
                        is_decorative=True,
                    )
                )
                continue
            for image_index, image_metadata in enumerate(page.image_refs, start=1):
                image_rows.append(
                    DocumentImageRow(
                        organization_id=organization_id,
                        document_id=document_id,
                        page_number=page.page_number,
                        image_index=image_index,
                        image_metadata=image_metadata,
                        extraction_error=page.error,
                        bbox=tuple(image_metadata["bbox"]) if image_metadata.get("bbox") else None,
                        page_width=page.page_width,
                        page_height=page.page_height,
                        is_decorative=bool(image_metadata.get("is_decorative", False)),
                    )
                )

        return ExtractionPersistenceRows(
            pages=page_rows,
            page_texts=text_rows,
            tables=table_rows,
            images=image_rows,
        )


def _row_count(table: list) -> int:
    return len(table)


def _column_count(table: list) -> int:
    if not table:
        return 0
    first_row = table[0]
    return len(first_row) if isinstance(first_row, list) else 0

