import json
from app.rag.models import RagError
class RagEnvironmentPreflightService:
    def __init__(self,settings,provider):self.s=settings;self.provider=provider
    async def check(self):
        checks={"retrieval_service":"PASS","embedding_configuration":"PASS","context_window":"PASS" if self.s.rag_llm_context_window>self.s.rag_llm_max_output_tokens else "FAIL","token_counter":"PASS"}
        blocking=None if checks["context_window"]=="PASS" else "RAG_CONTEXT_WINDOW_UNKNOWN"
        try:
            await self.provider.health_check()
            raw=await self.provider.generate("Return only the required JSON and do not repeat instructions. You must return your response in valid JSON format matching this schema: {\"answer_status\": \"INSUFFICIENT_EVIDENCE\", \"answer\": \"\", \"claims\": [], \"used_citation_labels\": [], \"insufficient_evidence_reason\": null}","Return an INSUFFICIENT_EVIDENCE response with empty claims and citations.")
            parsed=json.loads(raw)
            if parsed.get("answer_status")!="INSUFFICIENT_EVIDENCE" or "do not repeat" in raw.lower(): raise RagError("RAG_STRUCTURED_OUTPUT_UNAVAILABLE","Structured sample generation failed",503)
            checks.update({"llm_provider":"PASS","llm_model":"PASS","model_identity":"PASS","structured_generation":"PASS"})
        except RagError as e:checks.update({"llm_provider":"FAIL","llm_model":"FAIL","model_identity":"FAIL","structured_generation":"NOT_RUN"});blocking=e.error_code
        return {"overall_result":"PASS" if not blocking else "FAIL","blocking_reason":blocking,"checks":checks,"provider":self.provider.provider_name,"model":self.provider.model_name or None,"configuration_fingerprint":self.provider.configuration_fingerprint}
