import argparse,asyncio,json
from app.config.settings import get_settings
from app.rag.factory import get_rag_components
async def run(a):
 v,s,_=get_rag_components(get_settings());r=await s.answer(v.validate(organization_id=a.organization_id,question=a.question,document_id=a.document_id));print(json.dumps(r,indent=2,ensure_ascii=False) if a.json else r["answer"])
def main():
 p=argparse.ArgumentParser();p.add_argument("--organization-id",required=True);p.add_argument("--document-id");p.add_argument("--question",required=True);p.add_argument("--json",action="store_true");asyncio.run(run(p.parse_args()))
if __name__=="__main__":main()
