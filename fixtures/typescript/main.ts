import { retry as renamed } from "./barrel.js";
import { Client, arrow } from "./lib.js";
import { readFile } from "node:fs/promises";
export function fetchNotes() {
  renamed();
  arrow();
  new Client().run();
  readFile("notes");
}
export function dynamic(callback: () => void) {
  callback();
}
export function shadow(requestWithRetry: () => void) {
  requestWithRetry();
}
