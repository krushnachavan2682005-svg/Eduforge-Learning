import json
from app.retrieval.factory import get_retrieval_components

def main():
    _,service,_,_=get_retrieval_components()
    print(json.dumps(service.runtime_info(),indent=2,sort_keys=True))

if __name__ == "__main__": main()
