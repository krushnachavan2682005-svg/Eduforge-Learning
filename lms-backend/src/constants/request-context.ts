import { AsyncLocalStorage } from "async_hooks";
     type QueryStore = {
    queryCount: number;};
export const asyncLocalStorage = new AsyncLocalStorage<QueryStore>();