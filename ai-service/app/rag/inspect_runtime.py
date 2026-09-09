import json
from app.rag.factory import get_rag_components
if __name__=="__main__": print(json.dumps(get_rag_components()[1].runtime_info(),indent=2,sort_keys=True))
