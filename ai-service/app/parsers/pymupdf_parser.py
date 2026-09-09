import fitz

from app.parsers.scanned_detector import is_scanned_pdf


class InvalidPdfFileError(Exception):
    pass


class PdfPreprocessingError(Exception):
    pass


def preprocess_pdf(pdf_path: str) -> dict[str, int | bool | str]:
    try:
        document = fitz.open(pdf_path)
    except Exception as exc:
        raise InvalidPdfFileError("Invalid PDF file") from exc

    try:
        page_count = document.page_count
        extracted_text_parts: list[str] = []

        for page in document:
            extracted_text_parts.append(page.get_text("text") or "")

        text = "".join(extracted_text_parts)
        text_length = len(text.strip())

        return {
            "page_count": page_count,
            "text_length": text_length,
            "is_scanned": is_scanned_pdf(page_count, text_length),
            "extraction_method": "pymupdf",
        }
    except Exception as exc:
        raise PdfPreprocessingError("Failed to preprocess PDF") from exc
    finally:
        document.close()
