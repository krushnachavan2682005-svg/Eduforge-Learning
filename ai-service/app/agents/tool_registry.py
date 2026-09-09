from typing import Callable

from app.extractors.image_extractor import detect_page_images
from app.extractors.table_extractor import extract_page_tables
from app.extractors.text_extractor import extract_text_pages


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable] = {
            "pymupdf_text_extractor": extract_text_pages,
            "pymupdf_image_detector": detect_page_images,
            "pdfplumber_table_extractor": extract_page_tables,
            "ocr_placeholder": self._ocr_placeholder,
        }

    def get(self, tool_name: str) -> Callable:
        return self._tools[tool_name]

    def _ocr_placeholder(self, *_args, **_kwargs) -> dict[str, str]:
        return {
            "required_future_tool": "OCR_ENGINE",
            "status": "NOT_IMPLEMENTED",
        }

