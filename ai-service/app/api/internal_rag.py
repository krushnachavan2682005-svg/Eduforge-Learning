from fastapi import APIRouter,Header,HTTPException,Request
from pydantic import BaseModel,ConfigDict
from app.config.settings import get_settings
from app.errors import error_body
from app.rag.factory import get_rag_components
from app.rag.models import RagError
from app.rag.conversation import BoundedConversationContext,ConversationQueryResolver,validate_summary
from app.rag.citation_freshness import current_trusted_citations
from app.rag.summary import ConversationSummaryService
import logging
logger=logging.getLogger(__name__)
router=APIRouter(prefix="/internal/rag",tags=["internal-rag"])
class RagBody(BaseModel):
    model_config=ConfigDict(extra="forbid")
    organization_id:str;question:str;document_id:str|None=None;document_ids:list[str]|None=None
    top_k:int|None=None;minimum_similarity:float|None=None;include_evidence:bool=True
class ConversationRagBody(BaseModel):
    model_config=ConfigDict(extra="forbid")
    organization_id:str;user_id:str;conversation_id:str;question:str;document_ids:list[str];previous_turns:list[dict]=[];conversation_summary:dict|None=None
    summary_version:int=0;summary_covered_through_sequence:int=0;messages_to_summarize:list[dict]=[];trusted_citations:list[dict]=[]
def authorize(key,rid):
    if key!=get_settings().ai_service_internal_key:raise HTTPException(401,detail=error_body(error_code="INTERNAL_SERVICE_UNAUTHORIZED",message="Invalid internal service key",request_id=rid))
@router.post("/answer")
async def answer(payload:RagBody,request:Request,x_internal_service_key:str=Header(default="",alias="X-Internal-Service-Key"),x_request_id:str|None=Header(default=None,alias="X-Request-Id")):
    rid=x_request_id or request.headers.get("x-request-id") or "missing-request-id";authorize(x_internal_service_key,rid)
    validator,service,_=get_rag_components()
    try:return await service.answer(validator.validate(**payload.model_dump()),rid)
    except RagError as e:raise HTTPException(e.status_code,detail=error_body(error_code=e.error_code,message=e.message,request_id=rid,retryable=e.retryable,details={"retrievalDiagnostics":e.retrieval_diagnostics} if e.retrieval_diagnostics else None)) from e
@router.post("/conversation/answer")
async def conversation_answer(payload:ConversationRagBody,request:Request,x_internal_service_key:str=Header(default="",alias="X-Internal-Service-Key"),x_request_id:str|None=Header(default=None,alias="X-Request-Id")):
    rid=x_request_id or request.headers.get("x-request-id") or "missing-request-id";authorize(x_internal_service_key,rid)
    _validated_summary=validate_summary(payload.conversation_summary,set(payload.document_ids))
    bounded=BoundedConversationContext().select(payload.previous_turns)
    resolution_turns=bounded
    if not resolution_turns and _validated_summary and _validated_summary.get("topics"):
        resolution_turns=[{"role":"USER","content":"; ".join(_validated_summary["topics"])}]
    resolved=ConversationQueryResolver().resolve(payload.question,resolution_turns)
    validator,service,provider=get_rag_components()
    try:
        response=await service.answer(validator.validate(organization_id=payload.organization_id,question=resolved.question,document_ids=payload.document_ids),rid)
        response["conversation"]={"resolved_question":resolved.question,"was_follow_up":resolved.was_follow_up,"resolution_strategy":resolved.strategy,"history_messages_used":len(bounded),"summary_validated":_validated_summary is not None}
        try:
            current_citations,freshness_counts=current_trusted_citations(payload.trusted_citations)
            logger.info("CITATION_FRESHNESS_CHECKED",extra={"request_id":rid,"organization_id":payload.organization_id,"conversation_id":payload.conversation_id,"citation_states":freshness_counts})
            state={"previous_summary":{"summary_version":payload.summary_version,"covered_through_sequence":payload.summary_covered_through_sequence,"summary":_validated_summary},"messages_to_summarize":payload.messages_to_summarize,"trusted_citations":current_citations,"conversation_document_ids":payload.document_ids}
            response["memory"]=await ConversationSummaryService(get_settings(),provider).propose(state)
        except Exception as summary_error:
            logger.warning("CONVERSATION_SUMMARY_PREVIOUS_RETAINED",extra={"request_id":rid,"organization_id":payload.organization_id,"conversation_id":payload.conversation_id,"error_code":getattr(summary_error,"error_code","SUMMARY_GENERATION_FAILED")})
            response["memory"]={"summary_updated":False,"reason":"SUMMARY_FAILED","metrics":{"summary_triggered":True}}
        return response
    except RagError as e:raise HTTPException(e.status_code,detail=error_body(error_code=e.error_code,message=e.message,request_id=rid,retryable=e.retryable,details={"retrievalDiagnostics":e.retrieval_diagnostics} if e.retrieval_diagnostics else None)) from e
@router.get("/runtime")
def runtime(request:Request,x_internal_service_key:str=Header(default="",alias="X-Internal-Service-Key")):
    authorize(x_internal_service_key,request.headers.get("x-request-id","missing-request-id"));return get_rag_components()[1].runtime_info()
