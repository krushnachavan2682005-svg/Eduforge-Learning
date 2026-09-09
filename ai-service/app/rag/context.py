import hashlib, html, re
from app.chunking.token_counter import TokenCounter
from app.rag.models import RagContextItem

ROLE_WEIGHT={"PRIMARY_SOURCE":4,"SECONDARY_MENTION":2,"REFERENCE_ONLY":1,"VALIDATION_CHECKLIST":0}

class RagContextAssembler:
    def __init__(self, max_items=12): self.max_items=max_items; self.counter=TokenCounter()
    def assemble(self, results):
        candidates=[]; seen=set()
        for result in results:
            for e in result.get("evidence",[]):
                text=(e.get("matched_text") or result.get("content") or "").strip()
                if not text: continue
                fingerprint=hashlib.sha256((e["content_block_id"]+":"+re.sub(r"\s+"," ",text).lower()).encode()).hexdigest()
                if fingerprint in seen: continue
                seen.add(fingerprint)
                priority=ROLE_WEIGHT.get(e.get("evidence_role"),0)*10+float(e.get("evidence_score",0))+float(result["similarity_score"])
                candidates.append((priority,result,e,text))
        candidates.sort(key=lambda x:(-x[0],x[1]["rank"],x[2]["evidence_id"]))
        items=[]
        for i,(priority,r,e,text) in enumerate(candidates[:self.max_items],1):
            safe=re.sub(r"\[C\d+\]", "[untrusted-citation-label]", html.escape(text,quote=False), flags=re.I)
            items.append(RagContextItem(f"C{i}",e["evidence_id"],e["evidence_id"],r["document_id"],r["document_title"],
                r["chunk_id"],r["chunk_index"],e["page_number"],r["source_pages"],e["block_type"],e["evidence_role"],
                r["citation_precision"],e["provenance_confidence"],e["source_record_type"],e.get("source_record_id"),
                e["content_block_id"],r["content_fingerprint"].strip(),e.get("section_title"),safe,self.counter.count(safe),r["similarity_score"],priority,e.get("metadata") or {}))
        return items, max(0,len(candidates)-len(items))

class RagTokenBudgetPlanner:
    def __init__(self,counter=None): self.counter=counter or TokenCounter()
    def plan(self,items,*,context_window,system_prompt,question,reserved_output,max_context_tokens):
        fixed=self.counter.count(system_prompt)+self.counter.count(question)+128+reserved_output
        available=max(0,min(max_context_tokens,context_window-fixed)); selected=[]; used=0
        for item in items:
            cost=item.token_count+8
            if used+cost<=available: selected.append(item); used+=cost
        return selected,{"context_window":context_window,"system_tokens":self.counter.count(system_prompt),
            "question_tokens":self.counter.count(question),"reserved_output_tokens":reserved_output,
            "available_evidence_tokens":available,"selected_evidence_tokens":used,
            "selected_items":len(selected),"excluded_items":len(items)-len(selected),"truncated":len(selected)<len(items)}
