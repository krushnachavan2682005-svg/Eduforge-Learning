import asyncio,hashlib,json,random,time,uuid,logging
from abc import ABC,abstractmethod
from datetime import datetime,timezone
from typing import Any
from groq import AsyncGroq,APIConnectionError,APIStatusError,APITimeoutError,AuthenticationError,RateLimitError
from app.rag.models import RagError
from app.rag.prompt import VERSION

logger = logging.getLogger(__name__)

ANSWER_SCHEMA={"type":"object","additionalProperties":False,"required":["answer","answer_status","claims","used_citation_labels","insufficient_evidence_reason"],"properties":{
 "answer":{"type":"string"},"answer_status":{"type":"string","enum":["ANSWERED","PARTIALLY_ANSWERED","INSUFFICIENT_EVIDENCE","CONFLICTING_EVIDENCE","REFUSED_UNSAFE"]},
 "claims":{"type":"array","items":{"type":"object","additionalProperties":False,"required":["claim_text","citation_labels"],"properties":{"claim_text":{"type":"string"},"citation_labels":{"type":"array","items":{"type":"string"}}}}},
 "used_citation_labels":{"type":"array","items":{"type":"string"}},"insufficient_evidence_reason":{"type":["string","null"]}}}

class LLMProvider(ABC):
 @abstractmethod
 async def generate(self,system_prompt,user_prompt): ...
 @abstractmethod
 async def health_check(self): ...
 @abstractmethod
 async def close(self): ...

class GroqLLMProvider(LLMProvider):
 provider_name="groq";supports_json_output=True
 def __init__(self,settings,client_factory=AsyncGroq):
  self.s=settings;self.model_name=settings.rag_llm_model;self.context_window=settings.rag_llm_context_window
  self.model_revision_or_digest="unresolved";self.client_instance_id=str(uuid.uuid4());self.provider_instance_id=self.client_instance_id
  self._factory=client_factory;self._client=None;self._init_lock=asyncio.Lock();self._model_verified=False;self.provider_reachable=False
  self.generation_count=0;self.failed_generation_count=0;self.rate_limit_count=0;self.retry_count=0;self.last_generation_latency_ms=None;self.last_successful_generation_at=None;self.last_usage={};self.last_finish_reason=None
 @property
 def configuration_fingerprint(self):
  raw=json.dumps({"provider":"groq","model":self.model_name,"identity":self.model_revision_or_digest,"temperature":self.s.rag_llm_temperature,"top_p":self.s.rag_llm_top_p,"max_output":self.s.rag_llm_max_output_tokens,"window":self.context_window,"prompt":VERSION,"structured_output":self.s.rag_llm_structured_output_mode,"implementation":"groq_async_sdk_v1"},sort_keys=True)
  return hashlib.sha256(raw.encode()).hexdigest()
 async def initialize_client(self):
  if self._client:return self._client
  async with self._init_lock:
   if self._client:return self._client
   if not self.s.groq_api_key:raise RagError("RAG_GROQ_API_KEY_MISSING","Groq API key is not configured",503)
   self._client=self._factory(api_key=self.s.groq_api_key,timeout=self.s.rag_llm_timeout_seconds,max_retries=0)
  return self._client
 async def resolve_model_identity(self):
  client=await self.initialize_client()
  try: models=await client.models.list()
  except Exception as e:raise self._map_error(e)
  match=next((m for m in models.data if getattr(m,"id",None)==self.model_name),None)
  if match is None:raise RagError("RAG_LLM_MODEL_NOT_FOUND","Configured Groq model is unavailable",503)
  if getattr(match,"active",True) is False:raise RagError("RAG_LLM_MODEL_NOT_FOUND","Configured Groq model is inactive",503)
  provider_window=getattr(match,"context_window",None)
  if provider_window and self.context_window>int(provider_window):raise RagError("RAG_CONTEXT_WINDOW_MISMATCH","Configured context window exceeds provider model limit",503)
  self.model_revision_or_digest=f"{self.model_name}:{getattr(match,'owned_by','groq')}";self._model_verified=True;self.provider_reachable=True
  return {"model":self.model_name,"identity":self.model_revision_or_digest,"provider_context_window":provider_window,"active":True}
 async def health_check(self):return await self.resolve_model_identity()
 def _response_format(self,schema=None,schema_name="citation_grounded_rag_answer"):
  return {"type":"json_object"}
 async def generate(self,system_prompt,user_prompt,*,schema=None,schema_name="citation_grounded_rag_answer",max_output_tokens=None):
  if "json" not in system_prompt.lower(): system_prompt += " You must return your response in valid JSON format."
  client=await self.initialize_client();started=time.monotonic();attempt=0
  while True:
   try:
    remaining=self.s.rag_total_timeout_seconds-(time.monotonic()-started)
    if remaining<=0:raise asyncio.TimeoutError()
    response=await client.chat.completions.create(model=self.model_name,messages=[{"role":"system","content":system_prompt},{"role":"user","content":user_prompt}],temperature=self.s.rag_llm_temperature,top_p=self.s.rag_llm_top_p,max_completion_tokens=max_output_tokens or self.s.rag_llm_max_output_tokens,response_format=self._response_format(schema,schema_name),timeout=min(self.s.rag_llm_timeout_seconds,remaining))
    content=response.choices[0].message.content or ""
    content = content.strip()
    if content.startswith("```"):
     import re
     content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
     content = re.sub(r"\s*```$", "", content)
    self.last_finish_reason=getattr(response.choices[0],"finish_reason",None);self.generation_count+=1;self.provider_reachable=True
    self.last_generation_latency_ms=round((time.monotonic()-started)*1000);self.last_successful_generation_at=datetime.now(timezone.utc).isoformat()
    usage=getattr(response,"usage",None);self.last_usage={"prompt_tokens":getattr(usage,"prompt_tokens",None),"completion_tokens":getattr(usage,"completion_tokens",None),"total_tokens":getattr(usage,"total_tokens",None)}
    logger.info(f"Groq LLM Generation completed in {self.last_generation_latency_ms}ms", extra={"latency_ms": self.last_generation_latency_ms})
    return content
   except Exception as e:
    mapped=self._map_error(e);retryable=mapped.error_code in {"RAG_PROVIDER_RATE_LIMITED","RAG_LLM_PROVIDER_UNAVAILABLE","RAG_GENERATION_FAILED"}
    if not retryable or attempt>=self.s.rag_llm_max_retries:self.failed_generation_count+=1;raise mapped
    attempt+=1;self.retry_count+=1
    delay=min(self.s.rag_llm_retry_max_delay_ms,self.s.rag_llm_retry_base_delay_ms*(2**(attempt-1)))/1000
    retry_after=getattr(getattr(e,"response",None),"headers",{}).get("retry-after") if getattr(e,"response",None) else None
    if retry_after:
     try:delay=min(float(retry_after),self.s.rag_llm_retry_max_delay_ms/1000)
     except ValueError:pass
    await asyncio.sleep(delay+random.uniform(0,min(.1,delay/4)))
 def _map_error(self,e):
  if isinstance(e,AuthenticationError) or getattr(e,"status_code",None)==401:return RagError("RAG_GROQ_API_KEY_INVALID","Groq credentials were rejected",503)
  if isinstance(e,RateLimitError) or getattr(e,"status_code",None)==429:self.rate_limit_count+=1;return RagError("RAG_PROVIDER_RATE_LIMITED","Generation provider rate limit reached",429,True)
  if isinstance(e,APITimeoutError) or isinstance(e,asyncio.TimeoutError):return RagError("RAG_GENERATION_TIMEOUT","Generation timed out",504,True)
  status=getattr(e,"status_code",None)
  if status==400:return RagError("RAG_STRUCTURED_OUTPUT_UNAVAILABLE","Configured model rejected strict structured output",503)
  if status==404:return RagError("RAG_LLM_MODEL_NOT_FOUND","Configured Groq model is unavailable",503)
  if isinstance(e,APIConnectionError) or (status and status>=500):return RagError("RAG_LLM_PROVIDER_UNAVAILABLE","Groq provider is unavailable",503,True)
  return RagError("RAG_GENERATION_FAILED","Groq generation failed",503,True)
 async def close(self):
  if self._client:await self._client.close();self._client=None
 def get_runtime_diagnostics(self):return {"provider":"groq","client_initialized":self._client is not None,"client_instance_id":self.client_instance_id,"api_key_configured":bool(self.s.groq_api_key),"configured_model":self.model_name,"resolved_model_identity":self.model_revision_or_digest,"model_active":self._model_verified,"provider_reachable":self.provider_reachable,"operational_context_window":self.context_window,"structured_output_mode":self.s.rag_llm_structured_output_mode,"generation_count":self.generation_count,"failed_generation_count":self.failed_generation_count,"retry_count":self.retry_count,"rate_limit_count":self.rate_limit_count,"last_generation_latency_ms":self.last_generation_latency_ms,"last_successful_generation_at":self.last_successful_generation_at,"last_finish_reason":self.last_finish_reason,"last_usage":self.last_usage,"configuration_fingerprint":self.configuration_fingerprint}
