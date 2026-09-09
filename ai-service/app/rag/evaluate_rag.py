import argparse,json
from app.rag.evaluation.runner import run_ci

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--fixture",required=True);parser.add_argument("--responses",required=True);parser.add_argument("--output")
    args=parser.parse_args();report=run_ci(args.fixture,args.responses);rendered=json.dumps(report,indent=2,sort_keys=True)
    if args.output: open(args.output,"w",encoding="utf-8").write(rendered+"\n")
    print(rendered);raise SystemExit(0 if report["gate"]["passed"] else 1)
if __name__=="__main__":main()
