import argparse,asyncio,json
from app.config.settings import get_settings
from app.rag.factory import get_rag_components
from app.rag.preflight import RagEnvironmentPreflightService
async def run(args):
    s=get_settings();provider=get_rag_components(s)[2];result=await RagEnvironmentPreflightService(s,provider).check();print(json.dumps(result,indent=2) if args.json else result);return 0 if result["overall_result"]=="PASS" else 1
def main():
    p=argparse.ArgumentParser();p.add_argument("--json",action="store_true");raise SystemExit(asyncio.run(run(p.parse_args())))
if __name__=="__main__":main()
