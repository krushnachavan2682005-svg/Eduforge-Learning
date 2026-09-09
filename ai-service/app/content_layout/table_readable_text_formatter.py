import json
import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)


class TableReadableTextFormatter:
    """Render JSON rows with `` | `` delimiters and backslash-escaped cell pipes."""

    def format_table(self, table_data: Any, metadata: dict[str, Any] | None = None) -> str:
        context = _log_context(metadata)
        started = time.monotonic()
        logger.info("TABLE_READABLE_FORMAT_START %s", context)

        rows = [_normalize_row(row) for row in table_data] if isinstance(table_data, list) else []
        rows = [row for row in rows if row is not None]
        if not rows:
            logger.info(
                "TABLE_READABLE_FORMAT_EMPTY %s formatted_text_length=0 duration_ms=%s",
                context,
                round((time.monotonic() - started) * 1000),
            )
            return ""

        width = max((len(row) for row in rows), default=0)
        if width == 0:
            logger.info(
                "TABLE_READABLE_FORMAT_EMPTY %s formatted_text_length=0 duration_ms=%s",
                context,
                round((time.monotonic() - started) * 1000),
            )
            return ""

        header = rows[0] + [f"column_{index + 1}" for index in range(len(rows[0]), width)]
        rendered_rows = [header]
        for row in rows[1:]:
            padded = row + [""] * (width - len(row))
            if padded == header:
                continue
            rendered_rows.append(padded)

        formatted = "\n".join(" | ".join(row) for row in rendered_rows)
        logger.info(
            "TABLE_READABLE_FORMAT_DONE %s formatted_text_length=%s duration_ms=%s",
            context,
            len(formatted),
            round((time.monotonic() - started) * 1000),
        )
        return formatted


def _normalize_row(row: Any) -> list[str] | None:
    if not isinstance(row, list):
        return None
    return [_normalize_cell(cell) for cell in row]


def _normalize_cell(cell: Any) -> str:
    if cell is None:
        return ""
    if isinstance(cell, str):
        value = cell
    elif isinstance(cell, bool):
        value = "true" if cell else "false"
    elif isinstance(cell, (int, float)):
        value = str(cell)
    else:
        try:
            value = json.dumps(cell, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError):
            value = str(cell)

    segments = [segment.strip() for segment in re.split(r"\r\n|\r|\n", value)]
    return " / ".join(segments).strip().replace("|", r"\|")


def _log_context(metadata: dict[str, Any] | None) -> str:
    values = metadata or {}
    names = (
        "organization_id", "document_id", "table_id", "page_number", "table_index",
        "row_count", "column_count", "block_order",
    )
    return " ".join(f"{name}={values.get(name)}" for name in names)
