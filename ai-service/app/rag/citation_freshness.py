from enum import StrEnum

class CitationFreshnessState(StrEnum):
    CURRENT="CURRENT"; STALE_FINGERPRINT="STALE_FINGERPRINT"; SOURCE_MISSING="SOURCE_MISSING"; DOCUMENT_DELETED="DOCUMENT_DELETED"; DOCUMENT_NOT_READY="DOCUMENT_NOT_READY"; OUTSIDE_SCOPE="OUTSIDE_SCOPE"; WRONG_TENANT="WRONG_TENANT"; UNKNOWN_EVIDENCE="UNKNOWN_EVIDENCE"

def current_trusted_citations(citations:list[dict])->tuple[list[dict],dict[str,int]]:
    current=[]; states={}
    for citation in citations:
        state=str(citation.get("freshness_state") or CitationFreshnessState.UNKNOWN_EVIDENCE);states[state]=states.get(state,0)+1
        if state==CitationFreshnessState.CURRENT and not citation.get("stale"):current.append(citation)
    return current,states
