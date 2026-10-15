import { A, requestWithRetry } from "./requests";
export function caller() { return requestWithRetry(); }
export function dynamic(fn: () => void) { return fn(); }
