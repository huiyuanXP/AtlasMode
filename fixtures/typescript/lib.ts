export function requestWithRetry() {
  return 1;
}
export const arrow = () => requestWithRetry();
export class Client {
  send() {
    return requestWithRetry();
  }
  run() {
    return this.send();
  }
}
