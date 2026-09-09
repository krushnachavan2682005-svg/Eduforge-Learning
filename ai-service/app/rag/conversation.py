import re
from dataclasses import dataclass
from app.chunking.token_counter import TokenCounter

FOLLOW_UP=re.compile(r"^(how|why|which one|what about|and |was that|is that|were they|did it|how was that)\b",re.I)

@dataclass(frozen=True)
class ResolvedQuestion:
    question:str
    was_follow_up:bool
    strategy:str

class ConversationQueryResolver:
    """Conservatively resolves references; history supplies language context, never facts."""
    def resolve(self,question:str,previous_turns:list[dict])->ResolvedQuestion:
        q=question.strip()
        if not FOLLOW_UP.search(q): return ResolvedQuestion(q,False,"STANDALONE")
        prior=next((str(t.get("content","")).strip() for t in reversed(previous_turns) if t.get("role")=="USER" and str(t.get("content","")).strip()),"")
        if not prior:return ResolvedQuestion(q,False,"SAFE_FALLBACK")
        return ResolvedQuestion(f"Regarding the document topic in the prior question ({prior}): {q}",True,"HEURISTIC")

class BoundedConversationContext:
    def __init__(self,max_messages=12,max_tokens=1200):self.max_messages=max_messages;self.max_tokens=max_tokens;self.counter=TokenCounter()
    def select(self,turns:list[dict])->list[dict]:
        selected=[];used=0
        for turn in reversed(turns[-self.max_messages:]):
            content=str(turn.get("content", ""));cost=self.counter.count(content)
            if used+cost>self.max_tokens:continue
            selected.append({"sequence_number":int(turn.get("sequence_number",0)),"role":turn.get("role"),"content":content[:4000],"citations":turn.get("citations") or []});used+=cost
        return list(reversed(selected))

def validate_summary(summary,document_ids:set[str]):
    if summary is None:return None
    required={"summary_version","covered_through_sequence","topics","confirmed_facts","open_questions","active_references","document_ids"}
    if not isinstance(summary,dict) or set(summary)!=required or not set(summary.get("document_ids",[])).issubset(document_ids):return None
    for fact in summary.get("confirmed_facts",[]):
        if not fact.get("citation_ids") or not set(fact.get("document_ids",[])).issubset(document_ids):return None
    return summary
