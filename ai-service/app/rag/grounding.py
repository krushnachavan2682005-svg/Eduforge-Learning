import json,re
from app.rag.models import RagError

STATUSES={"ANSWERED","PARTIALLY_ANSWERED","INSUFFICIENT_EVIDENCE","CONFLICTING_EVIDENCE","REFUSED_UNSAFE"}
FIELDS={"answer","answer_status","claims","used_citation_labels","insufficient_evidence_reason"}
VALUE=re.compile(r"(?:₹|\$)?\(?-?\d[\d,.]*(?:\s*(?:mg|kg|%|L|O₂/L))?\)?|[A-Z]{2,}[A-Z0-9/-]*")

class GroundedAnswerValidator:
    def parse(self,raw):
        try: data=json.loads(raw)
        except Exception as e: raise RagError("RAG_GENERATED_OUTPUT_INVALID","Model returned malformed JSON",422) from e
        if set(data)!=FIELDS or data.get("answer_status") not in STATUSES or not isinstance(data.get("claims"),list) or not isinstance(data.get("used_citation_labels"),list):
            raise RagError("RAG_GENERATED_OUTPUT_INVALID","Model output violates the response schema",422)
        reason=data.get("insufficient_evidence_reason")
        if data["answer_status"]=="INSUFFICIENT_EVIDENCE":
            if not isinstance(reason,str) or not reason.strip() or len(reason)>400 or data["used_citation_labels"] or data["claims"]:raise RagError("RAG_GENERATED_OUTPUT_INVALID","Insufficient-evidence response violates the response schema",422)
        elif reason is not None:raise RagError("RAG_GENERATED_OUTPUT_INVALID","Answered response must use a null insufficient-evidence reason",422)
        return data
    def validate(self,data,items,organization_id=None):
        label_map={x.label:x for x in items}; unknown=set(); unsupported=[]
        for claim in data["claims"]:
            labels=claim.get("citation_labels") or []
            if data["answer_status"] in {"ANSWERED","PARTIALLY_ANSWERED","CONFLICTING_EVIDENCE"} and not labels:
                unsupported.append(claim.get("claim_text",""));continue
            unknown.update(x for x in labels if x not in label_map)
            evidence=" ".join(label_map[x].text for x in labels if x in label_map)
            ev_values={self._norm(x) for x in VALUE.findall(evidence)}
            if any(self._norm(x) not in ev_values for x in VALUE.findall(claim.get("claim_text",""))): unsupported.append(claim.get("claim_text",""))
        if unknown or unsupported: raise RagError("RAG_GENERATED_OUTPUT_INVALID","Generated claims are not fully grounded",422)
        used=[]
        for label in data["used_citation_labels"]:
            if label not in label_map: unknown.add(label)
            elif label not in used: used.append(label)
        claim_labels={label for claim in data["claims"] for label in claim.get("citation_labels",[])}
        if data["answer_status"] in {"ANSWERED","PARTIALLY_ANSWERED","CONFLICTING_EVIDENCE"} and (not used or not claim_labels.issubset(set(used))):
            raise RagError("RAG_GENERATED_OUTPUT_INVALID","Used citation labels are incomplete",422)
        if unknown: raise RagError("RAG_GENERATED_OUTPUT_INVALID","Unknown citation label",422)
        return used,{"grounded":True,"unsupported_claim_count":0,"unknown_citation_count":0}
    @staticmethod
    def _norm(value): return re.sub(r"[^a-z0-9]","",value.lower())
