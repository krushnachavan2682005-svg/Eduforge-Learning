from app.schemas.extraction_result import TablePageResult


def extract_tables_by_page(pdf_path: str) -> list[TablePageResult]:
    try:
        import pdfplumber
    except ImportError:
        page_count = _get_page_count(pdf_path)
        return [
            TablePageResult(
                page_number=page_number,
                table_count=0,
                tables=[],
                unavailable=True,
                error="pdfplumber is not installed",
            )
            for page_number in range(1, page_count + 1)
        ]

    results: list[TablePageResult] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                try:
                    found_tables = page.find_tables() or []
                    tables = [table.extract() for table in found_tables]
                    table_bboxes = [tuple(float(value) for value in table.bbox) for table in found_tables]
                    results.append(
                        TablePageResult(
                            page_number=index,
                            table_count=len(tables),
                            tables=tables,
                            extraction_method="pdfplumber",
                            table_bboxes=table_bboxes,
                            page_width=float(page.width),
                            page_height=float(page.height),
                        )
                    )
                except Exception as exc:
                    results.append(
                        TablePageResult(
                            page_number=index,
                            table_count=0,
                            tables=[],
                            extraction_method="pdfplumber",
                            error=str(exc),
                        )
                    )
    except Exception as exc:
        return [TablePageResult(page_number=1, table_count=0, tables=[], extraction_method="pdfplumber", error=str(exc))]

    return results


def _get_page_count(pdf_path: str) -> int:
    try:
        import fitz

        document = fitz.open(pdf_path)
        try:
            return document.page_count
        finally:
            document.close()
    except Exception:
        return 1
