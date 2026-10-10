import { DomainError } from "@codemap/core";

/** Decode captured text without silently replacing invalid bytes. AST input and
 * the fingerprint still use the original bytes, including Python codec cookies. */
export function decodeSource(bytes: Buffer, path: string): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString("utf16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return Buffer.from(bytes).swap16().toString("utf16le");
  let encoding = "utf-8";
  if (path.endsWith(".py")) {
    const lines = bytes
      .subarray(0, 1024)
      .toString("latin1")
      .replace(/^\xef\xbb\xbf/, "")
      .split(/\r?\n/, 2);
    const cookie = /^[\t\f ]*#.*?coding[:=][\t ]*([-\w.]+)/;
    const eligible =
      lines[0] && !/^[\t\f ]*(?:#|$)/.test(lines[0])
        ? lines.slice(0, 1)
        : lines;
    for (const line of eligible) {
      const match = cookie.exec(line);
      if (match) {
        encoding = match[1]!.toLowerCase().replaceAll("_", "-");
        break;
      }
    }
  }
  const canonical = encoding.replace(/[-.]/g, "");
  if (["latin1", "iso88591", "cp819"].includes(canonical))
    return bytes.toString("latin1");
  if (canonical === "utf8sig") encoding = "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new DomainError(
      "INVALID_PATH",
      `Source encoding ${encoding} cannot be decoded. Use a supported text encoding.`,
    );
  }
}
