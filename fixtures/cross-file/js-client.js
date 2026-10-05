import { requestWithRetry } from './http/request.js';
export function jsFetch() {
  return requestWithRetry('/js');
}
