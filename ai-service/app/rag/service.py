import asyncio,hashlib,json,logging,time,uuid
from app.rag.context import RagContextAssembler,RagTokenBudgetPlanner
from app.rag.grounding import GroundedAnswerValidator
from app.rag.models import RagError
from app.rag.prompt import SYSTEM_PROMPT,build_prompt
from app.retrieval.models import RetrievalRequest,RetrievalError
logger=logging.getLogger(__name__)

ABSTENTION="I could not find sufficient evidence in the selected documents to answer this question."
class RagAnswerGenerationService:
    def __init__(self,settings,retrieval_service,provider):
        self.s=settings;self.retrieval=retrieval_service;self.provider=provider
        self.assembler=RagContextAssembler(settings.rag_max_evidence_items);self.planner=RagTokenBudgetPlanner();self.grounder=GroundedAnswerValidator()
        self.capacity=asyncio.BoundedSemaphore(settings.rag_max_concurrent_generations)
        self.active_generations=0
    async def answer(self,request,correlation_id="missing-request-id"):
        started=time.monotonic();fingerprint=hashlib.sha256(request.question.encode()).hexdigest()
        try:
            rs=time.monotonic();retrieved=await asyncio.to_thread(self.retrieval.search,RetrievalRequest(request.organization_id,request.question,request.top_k,request.minimum_similarity,request.document_ids,True),correlation_id=correlation_id);retrieval_ms=round((time.monotonic()-rs)*1000)
            cs=time.monotonic();items,dedup_excluded=self.assembler.assemble(retrieved["results"])
            selected,plan=self.planner.plan(items,context_window=self.s.rag_llm_context_window,system_prompt=SYSTEM_PROMPT,question=request.question,reserved_output=self.s.rag_llm_max_output_tokens,max_context_tokens=self.s.rag_max_context_tokens);context_ms=round((time.monotonic()-cs)*1000)
            if not selected:return self._abstain(correlation_id,fingerprint,retrieved,plan,retrieval_ms,context_ms,started)
            prompt=build_prompt(request.question,selected)
            try:await asyncio.wait_for(self.capacity.acquire(),timeout=self.s.rag_busy_timeout_ms/1000)
            except asyncio.TimeoutError as e:raise RagError("RAG_SERVICE_BUSY","Generation capacity is exhausted",503,True) from e
            self.active_generations+=1
            gs=time.monotonic()
            try:
                raw=await self.provider.generate(SYSTEM_PROMPT,prompt)
                try:data=self.grounder.parse(raw)
                except RagError: data=self.grounder.parse(await self.provider.generate(SYSTEM_PROMPT,prompt+"\nRepair the prior response: return valid JSON only."))
            finally:self.active_generations-=1;self.capacity.release()
            generation_ms=round((time.monotonic()-gs)*1000);vs=time.monotonic();used,validation=self.grounder.validate(data,selected,request.organization_id);validation_ms=round((time.monotonic()-vs)*1000)
            citations=[self._citation(x) for x in selected if x.label in used]
            return self._response(correlation_id,fingerprint,data,retrieved,plan,citations,validation,
                {"retrieval":retrieval_ms,"context_assembly":context_ms,"generation":generation_ms,"validation":validation_ms,"total":round((time.monotonic()-started)*1000)},dedup_excluded)
        except RetrievalError as e: raise RagError("RAG_RETRIEVAL_UNAVAILABLE",e.message,e.status_code,e.retryable,e.diagnostics) from e
    def _citation(self,x):return {"citation_id":x.citation_id,"evidence_id":x.evidence_id,"label":x.label,"document_id":x.document_id,"document_title":x.document_title,"page_number":x.page_number,"block_type":x.block_type,"evidence_role":x.evidence_role,"citation_precision":x.citation_precision,"content_fingerprint":x.content_fingerprint,"content_block_id":x.content_block_id,"chunk_id":x.chunk_id,"evidence_preview":x.text[:240]}
    def _response(self,rid,qf,data,retrieved,plan,citations,validation,latency,dedup):
        return {"request_id":rid,"answer":data["answer"],"answer_status":data["answer_status"],"question_fingerprint":qf,
            "provider":self.provider.provider_name,"model":self.provider.model_name,"model_revision_or_digest":self.provider.model_revision_or_digest,
            "llm_configuration_fingerprint":self.provider.configuration_fingerprint,"retrieval":{"top_k":retrieved["top_k"],"minimum_similarity":retrieved["minimum_similarity"],"retrieved_count":retrieved["result_count"],"selected_evidence_count":len(citations),"diagnostics":retrieved["retrieval_diagnostics"]},
            "context":{**plan,"deduplicated_items":dedup},"claims":data["claims"],"citations":citations,"validation":validation,"latency_ms":latency,"usage":dict(getattr(self.provider,"last_usage",{}) or {})}
    def _abstain(self,rid,qf,retrieved,plan,rm,cm,started):
        data={"answer":ABSTENTION,"answer_status":"INSUFFICIENT_EVIDENCE","claims":[]};return self._response(rid,qf,data,retrieved,plan,[],{"grounded":True,"unsupported_claim_count":0,"unknown_citation_count":0},{"retrieval":rm,"context_assembly":cm,"generation":0,"validation":0,"total":round((time.monotonic()-started)*1000)},0)
    def runtime_info(self):return {**self.provider.get_runtime_diagnostics(),"active_generations":self.active_generations,"maximum_concurrent_generations":self.s.rag_max_concurrent_generations}
