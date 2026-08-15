import { AsyncLocalStorage } from "async_hooks";
export type QueryStore = {
  queryCount: number;
  organizationId?: string;
};
export const asyncLocalStorage = new AsyncLocalStorage<QueryStore>();