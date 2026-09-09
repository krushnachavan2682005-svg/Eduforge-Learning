import threading
from app.config.settings import get_settings
from app.rag.llm import GroqLLMProvider
from app.rag.service import RagAnswerGenerationService
from app.rag.validator import RagRequestValidator
from app.retrieval.factory import get_retrieval_components
_lock=threading.Lock();_components=None
def get_rag_components(settings=None):
    global _components
    if _components is None:
        with _lock:
            if _components is None:
                s=settings or get_settings();_,retrieval,_,_=get_retrieval_components(s)
                if s.rag_llm_provider != "groq": raise RuntimeError("RAG_LLM_PROVIDER must be groq")
                provider=GroqLLMProvider(s);_components=(RagRequestValidator(s),RagAnswerGenerationService(s,retrieval,provider),provider)
    return _components
