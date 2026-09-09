from decimal import Decimal
from typing import Any

from app.chunking.models import SemanticUnit


class CanonicalContentAssembler:
    def assemble(self, rows: list[dict[str, Any]]) -> list[SemanticUnit]:
        units: list[SemanticUnit] = []
        for row in rows:
            source_record_id = next(
                str(row[name]) for name in ("page_text_id", "table_id", "image_id", "image_text_id")
                if row.get(name) is not None
            )
            text = row.get("content_text") or row.get("readable_text") or ""
            bbox_values = [row.get(name) for name in ("x0", "y0", "x1", "y1")]
            bbox = tuple(float(value) for value in bbox_values) if all(value is not None for value in bbox_values) else None
            image_id = row.get("image_id") or row.get("parent_image_id")
            units.append(SemanticUnit(
                content_block_id=str(row["id"]), page_number=row["page_number"],
                block_order=row["block_order"], block_type=row["block_type"],
                source_type=row["source_type"], source_record_id=source_record_id,
                text=text, bbox=bbox,
                page_height=_float(row.get("page_height")), table_id=_string(row.get("table_id")),
                image_id=_string(image_id), image_text_id=_string(row.get("image_text_id")),
                confidence_score=_float(row.get("confidence_score")),
                review_status=row.get("image_text_status"), metadata=dict(row.get("metadata") or {}),
                content_type=_content_type(row["block_type"]),
            ))
        return units


def _content_type(block_type: str) -> str:
    return {"TEXT": "PARAGRAPH", "OCR_TEXT": "OCR_PARAGRAPH", "TABLE": "TABLE", "IMAGE_TEXT": "IMAGE_TEXT", "IMAGE": "IMAGE"}.get(block_type, block_type)


def _float(value: Decimal | float | int | None) -> float | None:
    return float(value) if value is not None else None


def _string(value: Any) -> str | None:
    return str(value) if value is not None else None
