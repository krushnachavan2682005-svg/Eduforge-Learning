import re, uuid
from app.chunking.token_counter import TokenCounter
from app.rag.models import RagError, RagRequest

class RagRequestValidator:
    def __init__(self, settings): self.s=settings; self.counter=TokenCounter()
    def validate(self, *, organization_id, question, document_id=None, document_ids=None,
                 top_k=None, minimum_similarity=None, include_evidence=True):
        q=(question or "").strip()
        if not q: raise RagError("RAG_QUESTION_EMPTY","Question is required")
        if len(q)>self.s.rag_question_max_characters or self.counter.count(q)>self.s.rag_question_max_tokens:
            raise RagError("RAG_QUESTION_TOO_LONG","Question exceeds the configured limit")
        ids=list(document_ids or [])
        if document_id and ids: raise RagError("RAG_REQUEST_INVALID","Use one document filter form")
        if document_id: ids=[document_id]
        if len(ids)>self.s.rag_max_documents_per_request: raise RagError("RAG_REQUEST_INVALID","Too many documents")
        try: [uuid.UUID(str(x)) for x in ids]; uuid.UUID(str(organization_id))
        except ValueError as e: raise RagError("RAG_REQUEST_INVALID","Invalid UUID") from e
        k=self.s.rag_retrieval_top_k if top_k is None else int(top_k)
        threshold=self.s.rag_minimum_similarity if minimum_similarity is None else float(minimum_similarity)
        if not 1<=k<=self.s.rag_max_retrieval_top_k: raise RagError("RAG_TOP_K_INVALID","Invalid top_k")
        if not -1<=threshold<=1: raise RagError("RAG_THRESHOLD_INVALID","Invalid similarity threshold")
        return RagRequest(str(organization_id),q,[str(x) for x in ids],k,threshold,bool(include_evidence))
