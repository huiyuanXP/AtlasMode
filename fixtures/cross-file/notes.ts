import { retry as request } from './barrel.js';
import { lowLevelRequest } from '@http/request';
export const fetchNotes = () => request('/notes');
export function dynamicCall(target: () => string) {
  return target();
}
export class NotesService {
  fetch() {
    return lowLevelRequest('/direct');
  }
}
export function recursive(n: number): number {
  return n > 0 ? recursive(n - 1) : 0;
}
export function callbackOwner() {
  return [1].map((value) => value + 1);
}

export function dynamicTyped(target: typeof request) {
  return target('/typed');
}
export const directAlias = request;
export function aliasCaller() {
  return directAlias('/alias');
}
export class WithConstructor {
  constructor() {
    request('/construct');
  }
  handler = () => request('/field');
}
export function constructorCaller() {
  const instance = new WithConstructor();
  return instance.handler();
}
