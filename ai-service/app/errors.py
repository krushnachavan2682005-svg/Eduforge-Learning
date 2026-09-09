from datetime import datetime, timezone
from typing import Any


def error_body(
    *,
    error_code: str,
    message: str,
    request_id: str,
    retryable: bool = False,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "error_code": error_code,
        "message": message,
        "details": details or {},
        "requestId": request_id,
        "retryable": retryable,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
