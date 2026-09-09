import fitz

from app.parsers.pymupdf_parser import InvalidPdfFileError
from app.schemas.extraction_result import TextPageResult


class PdfTextExtractionError(Exception):
    pass


def extract_text_pages(pdf_path: str) -> list[TextPageResult]:
    try:
        document = fitz.open(pdf_path)
    except Exception as exc:
        raise InvalidPdfFileError("Invalid PDF file") from exc

    try:
        results: list[TextPageResult] = []
        for index, page in enumerate(document, start=1):
            text = page.get_text("text") or ""
            layout_blocks = []
            for block_index, block in enumerate((page.get_text("dict", sort=False) or {}).get("blocks", [])):
                if block.get("type") != 0:
                    continue
                block_text = "\n".join(
                    "".join(span.get("text", "") for span in line.get("spans", []))
                    for line in block.get("lines", [])
                ).strip()
                bbox = block.get("bbox")
                if not block_text or not bbox or len(bbox) != 4:
                    continue
                layout_blocks.append({
                    "block_index": block_index,
                    "text": block_text,
                    "bbox": [float(value) for value in bbox],
                    "coordinate_system": "pdf_top_left",
                })
            results.append(TextPageResult(
                page_number=index,
                text=text,
                text_length=len(text.strip()),
                layout_blocks=layout_blocks,
                page_width=float(page.rect.width),
                page_height=float(page.rect.height),
            ))
        return results
    except Exception as exc:
        raise PdfTextExtractionError("PDF text extraction failed") from exc
    finally:
        document.close()

