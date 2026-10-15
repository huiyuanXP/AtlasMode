import { A, requestWithRetry } from "./requests";
export function caller() { return A(); }
export function dynamic(fn: () => void) { return fn(); }
