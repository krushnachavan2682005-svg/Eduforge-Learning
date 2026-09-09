import hashlib
import json
from typing import Any


def ocr_configuration_fingerprint(config: dict[str, Any]) -> str:
    payload = json.dumps(config, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def cache_identity(*, organization_id: str, document_id: str, image_id: str,
                   source_image_fingerprint: str, ocr_configuration_fingerprint: str) -> tuple[str, ...]:
    return (organization_id, document_id, image_id, source_image_fingerprint, ocr_configuration_fingerprint)
