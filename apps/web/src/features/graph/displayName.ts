import { dictionaries, type Locale } from "../../i18n/index.js";

/** Human-readable form of the indexer's internal identity strings.
 *
 * The indexer names an anonymous callback after the call that receives it:
 * `<callback:[[80,"describe"]]:1>` (JSON of AST [SyntaxKind, text] tokens, then
 * the argument index). That string is part of the function's stable identity
 * and must never change, so it is only translated for display here. */
export type CallbackLabels = { callback: string; anonymous: string };

const CALLBACK = /^<callback:(\[[\s\S]*\]):(\d+)>$/;

export const labelsFor = (locale: Locale): CallbackLabels => ({
  callback: dictionaries[locale].callbackLabel,
  anonymous: dictionaries[locale].anonymousLabel,
});

function callee(tokens: unknown): string | undefined {
  if (!Array.isArray(tokens) || !tokens.length) return undefined;
  let text = "";
  for (const token of tokens) {
    if (!Array.isArray(token) || typeof token[1] !== "string") return undefined;
    text += token[1];
  }
  return text;
}

/** Display text for one name segment; non-callback names are returned as is. */
export function displaySegment(segment: string, labels: CallbackLabels) {
  if (segment === "<anonymous>") return labels.anonymous;
  const match = CALLBACK.exec(segment);
  if (!match) return segment;
  let tokens: unknown;
  try {
    tokens = JSON.parse(match[1]!);
  } catch {
    return segment;
  }
  const name = callee(tokens);
  if (!name) return segment;
  const shortened = name.length > 40 ? `${name.slice(0, 39)}…` : name;
  return `${shortened}(…) ${labels.callback}`;
}

/** Split a qualified name on the dots that separate segments. Dots inside a
 * `<callback:…>` or `<anonymous>` segment (e.g. `server.close`) must not split. */
export function splitQualified(name: string): string[] {
  const parts: string[] = [];
  let depth = 0,
    inString = false,
    start = 0;
  for (let i = 0; i < name.length; i++) {
    const c = name[i]!;
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"' && depth > 0) inString = true;
    else if (c === "<") depth++;
    else if (c === ">" && depth > 0) depth--;
    else if (c === "." && depth === 0) {
      parts.push(name.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(name.slice(start));
  return parts;
}

export function displayName(name: string, labels: CallbackLabels) {
  if (!name.includes("<")) return name;
  return splitQualified(name)
    .map((segment) => displaySegment(segment, labels))
    .join(" › ");
}

/** Convenience for call sites that only know the UI locale. */
export const displayNameFor = (name: string, locale: Locale) =>
  displayName(name, labelsFor(locale));
