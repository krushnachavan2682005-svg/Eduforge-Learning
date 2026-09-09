import threading
import time
from collections import OrderedDict


class QueryEmbeddingCache:
    def __init__(self, *, enabled: bool, max_entries: int, ttl_seconds: int):
        self.enabled=enabled; self.max_entries=max(1,max_entries); self.ttl_seconds=max(1,ttl_seconds)
        self._values: OrderedDict[str,tuple[float,list[float]]] = OrderedDict()
        self._lock=threading.Lock(); self.hits=0; self.misses=0
    def get(self,key: str) -> list[float] | None:
        if not self.enabled: self.misses+=1; return None
        with self._lock:
            item=self._values.get(key)
            if not item or item[0] <= time.monotonic():
                if item: self._values.pop(key,None)
                self.misses+=1; return None
            self._values.move_to_end(key); self.hits+=1; return list(item[1])
    def put(self,key: str,vector: list[float]) -> None:
        if not self.enabled: return
        with self._lock:
            self._values[key]=(time.monotonic()+self.ttl_seconds,list(vector)); self._values.move_to_end(key)
            while len(self._values)>self.max_entries: self._values.popitem(last=False)
    def stats(self):
        with self._lock: return {"cache_enabled":self.enabled,"cache_size":len(self._values),
            "cache_hits":self.hits,"cache_misses":self.misses,"cache_max_entries":self.max_entries,
            "cache_ttl_seconds":self.ttl_seconds}
