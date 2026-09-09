from app.parsers.pdfplumber_table_parser import extract_tables_by_page
from app.schemas.extraction_result import TablePageResult


def extract_page_tables(pdf_path: str) -> list[TablePageResult]:
    return extract_tables_by_page(pdf_path)

