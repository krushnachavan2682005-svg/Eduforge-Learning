import hashlib
import json
import re
import unicodedata
from typing import Any

from app.retrieval.models import RetrievalEvidence

_STOP = {"a","an","and","are","did","do","does","in","is","of","on","the","to","was","what","which"}
_IDENTIFIER = re.compile(r"(?i)(?:[A-Z]{1,5}-\d[\w-]*|\d[\d,.]*|₹\s*\d[\d,.]*)")


class EvidenceMapper:
    def map_result(self, *, organization_id: str, query: str, row: dict[str, Any],
                   blocks: dict[str, dict[str, Any]], seen: set[str]) -> dict[str, Any]:
        candidates = []
        overlap_ids = {str(value) for value in (row.get("metadata") or {}).get("overlap_source_block_ids", [])}
        for block_id in row.get("source_block_ids") or []:
            block = blocks.get(str(block_id))
            if not block or str(block["organization_id"]) != organization_id or str(block["document_id"]) != str(row["document_id"]):
                continue
            score = self._score(query, block["block_text"], block["block_type"])
            start, end, matched = self._span(query, block["block_text"])
            role = "VALIDATION_CHECKLIST" if block["reference_page"] else "OVERLAP_COPY" if str(block_id) in overlap_ids else "SUPPORTING_SOURCE"
            evidence_id = self._id(organization_id, row, block, start, end)
            if evidence_id in seen:
                continue
            candidates.append((score, int(block["page_number"]), int(block["block_order"]), evidence_id,
                RetrievalEvidence(evidence_id, str(block["id"]), block["source_type"], self._source_id(block),
                    int(block["page_number"]), block["block_type"], row.get("section_title"),
                    self._string(block.get("table_id")), self._string(block.get("image_id")),
                    self._string(block.get("image_text_id")), start, end, matched, role, round(score, 6),
                    1.0 if start is not None else 0.7, self._safe_metadata(block.get("metadata") or {}))))
        candidates.sort(key=lambda item: (-item[0], item[1], item[2], item[3]))
        primary_candidate = next((item for item in candidates if item[4].evidence_role not in {"VALIDATION_CHECKLIST","REFERENCE_ONLY","OVERLAP_COPY"}), None)
        selected = candidates[:8]
        if primary_candidate and primary_candidate not in selected:
            selected = selected[:7] + [primary_candidate]
        evidence = []
        for item in selected:
            value = item[4]
            if primary_candidate and value.evidence_id == primary_candidate[4].evidence_id:
                value = RetrievalEvidence(**{**value.__dict__, "evidence_role": "PRIMARY_SOURCE"})
            elif value.evidence_role == "SUPPORTING_SOURCE":
                value = RetrievalEvidence(**{**value.__dict__, "evidence_role": "SECONDARY_MENTION"})
            seen.add(value.evidence_id)
            evidence.append(value.to_dict())
        primary = next((item for item in evidence if item["evidence_role"] == "PRIMARY_SOURCE"), None)
        evidence_pages = sorted({item["page_number"] for item in evidence if item["evidence_role"] in {"PRIMARY_SOURCE","SUPPORTING_SOURCE","SECONDARY_MENTION"}})
        references = sorted({item["page_number"] for item in evidence if item["evidence_role"] in {"VALIDATION_CHECKLIST","REFERENCE_ONLY"}})
        return {"primary_evidence_page": primary["page_number"] if primary else None,
                "evidence_pages": evidence_pages, "secondary_reference_pages": references,
                "citation_precision": "EXACT_SPAN" if primary and primary["text_start"] is not None else "BLOCK_LEVEL" if evidence else "CHUNK_LEVEL",
                "evidence": evidence}

    def _score(self, query: str, text: str, block_type: str) -> float:
        q = self._tokens(query); t = self._tokens(text)
        overlap = q.intersection(t)
        score = len(overlap) / max(1, len(q))
        query_ids = set(_IDENTIFIER.findall(query)); text_fold = unicodedata.normalize("NFKC", text).casefold()
        score += sum(1.5 for value in query_ids if value.casefold() in text_fold)
        if self._normalize(query) in self._normalize(text): score += 2.0
        if block_type in {"TABLE","IMAGE_TEXT"}: score += 0.05
        return score

    def _span(self, query: str, text: str):
        if not text: return None, None, None
        lines = [(match.start(), match.end(), match.group()) for match in re.finditer(r"[^\r\n]+", text)]
        if not lines: return None, None, None
        best = max(lines, key=lambda line: (self._score(query, line[2], "TEXT"), -line[0]))
        if self._score(query, best[2], "TEXT") <= 0: return None, None, None
        start=max(0,best[0]-120); end=min(len(text),best[1]+240)
        return start,end,text[start:end].strip()

    @staticmethod
    def _normalize(value: str) -> str: return " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", value).casefold()))
    def _tokens(self, value: str) -> set[str]: return {x for x in self._normalize(value).split() if x not in _STOP and len(x)>1}
    @staticmethod
    def _source_id(block):
        for key in ("image_text_id","table_id","image_id","page_text_id"):
            if block.get(key): return str(block[key])
        return None
    @staticmethod
    def _string(value): return str(value) if value else None
    @staticmethod
    def _safe_metadata(metadata):
        return {key:value for key,value in metadata.items() if key in {"confidence_score","ocr_status","review_status","table_index","image_index"}}
    @staticmethod
    def _id(organization_id, row, block, start, end):
        payload=[organization_id,str(row["document_id"]),str(row["chunk_id"]),str(block["id"]),
                 EvidenceMapper._source_id(block),int(block["page_number"]),start,end,row["content_fingerprint"].strip()]
        return hashlib.sha256(json.dumps(payload,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
