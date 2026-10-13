// Private codec; no native capability or existing runner is enabled by this file.
export const JOB_TYPES = { hello: 1, launch: 2, ready: 3, rootExit: 4, stop: 5, jobEmpty: 6, error: 7 } as const;
export const MAX_JOB_FRAME = 1024 * 1024; // Includes the four-byte prefix.
export interface JobLaunch { command: string; cwd: string; args: string[]; env: Record<string, string | undefined> }
export interface JobManifest { protocol: 1; platform: "win32"; arch: "x64"; sourceDigest: string; binarySha256: string; compiler: string; sdk: string }
export interface JobFrame { type: number; payload: Buffer }
function text(value: string): void {
  if (typeof value !== "string" || value.includes("\0")) throw new Error("Invalid Job text");
  for (let index = 0; index < value.length; index++) {
    const scalar = value.charCodeAt(index);
    if (scalar >= 0xd800 && scalar <= 0xdbff) {
      const low = value.charCodeAt(++index);
      if (!(low >= 0xdc00 && low <= 0xdfff)) throw new Error("Invalid Job UTF16");
    } else if (scalar >= 0xdc00 && scalar <= 0xdfff) throw new Error("Invalid Job UTF16");
  }
}
function absolute(value: string): boolean { return /^[A-Za-z]:[\\/]/u.test(value) || /^\\\\[^\\]+\\[^\\]+\\/u.test(value); }
function u32(value: number): Buffer { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; }
function stringBytes(value: string): Buffer { text(value); const bytes = Buffer.from(value, "utf8"); return Buffer.concat([u32(bytes.length), bytes]); }
export function quoteWindowsArgument(value: string): string {
  text(value); let result = '"'; let slashes = 0;
  for (const character of value) {
    if (character === "\\") { slashes++; continue; }
    result += "\\".repeat(character === '"' ? slashes * 2 + 1 : slashes) + character;
    slashes = 0;
  }
  return result + "\\".repeat(slashes * 2) + '"';
}
export function encodeLaunch(value: JobLaunch): Buffer {
  text(value.command); text(value.cwd);
  if (!absolute(value.command) || !/\.exe$/iu.test(value.command) || !absolute(value.cwd)) throw new Error("Job requires absolute exe and cwd");
  if (value.args.length > 256) throw new Error("Job argument budget");
  let lineLength = 0;
  for (const argument of [value.command, ...value.args]) {
    text(argument);
    if (argument.length > 32766) throw new Error("Job command line budget");
    lineLength += quoteWindowsArgument(argument).length + (lineLength ? 1 : 0);
    if (lineLength + 1 > 32767) throw new Error("Job command line budget");
  }
  const entries = Object.entries(value.env).filter((entry): entry is [string, string] => entry[1] !== undefined);
  if (entries.length > 512) throw new Error("Job environment budget");
  const keys = new Set<string>(); const environment: Buffer[] = [];
  let byteBudget = 5 + 8 + Buffer.byteLength(value.command) + Buffer.byteLength(value.cwd) + 8 + value.args.reduce((sum, item) => sum + 4 + Buffer.byteLength(item), 0);
  if (byteBudget > MAX_JOB_FRAME) throw new Error("Job frame budget");
  for (const [key, item] of entries) {
    text(key); text(item);
    if (!key || key.includes("=") || keys.has(key.toUpperCase())) throw new Error("Invalid Job environment key");
    byteBudget += 8 + Buffer.byteLength(key) + Buffer.byteLength(item);
    if (byteBudget > MAX_JOB_FRAME) throw new Error("Job frame budget");
    keys.add(key.toUpperCase()); environment.push(stringBytes(key), stringBytes(item));
  }
  return encodeFrame(2, Buffer.concat([stringBytes(value.command), stringBytes(value.cwd), u32(value.args.length), ...value.args.map(stringBytes), u32(entries.length), ...environment]));
}
function validFrame(type: number, payload: Buffer): void {
  const expected = new Map([[1, 36], [3, 4], [4, 4], [5, 0], [6, 0], [7, 8]]);
  if (type === 2) {
    if (payload.length + 5 > MAX_JOB_FRAME) throw new Error("Job frame budget");
  } else if (!expected.has(type) || expected.get(type) !== payload.length || payload.length + 5 > 256) throw new Error("Invalid Job status frame");
}
export function encodeFrame(type: number, payload: Buffer): Buffer {
  validFrame(type, payload); return Buffer.concat([u32(payload.length + 1), Buffer.from([type]), payload]);
}
export function decodeFrames(bytes: Buffer): { frames: JobFrame[]; remainder: Buffer } {
  const frames: JobFrame[] = []; let offset = 0;
  while (bytes.length - offset >= 4) {
    const length = bytes.readUInt32LE(offset);
    if (length < 1 || length + 4 > MAX_JOB_FRAME) throw new Error("Invalid Job frame length");
    if (bytes.length - offset < length + 4) break;
    const type = bytes[offset + 4]!; const payload = bytes.subarray(offset + 5, offset + 4 + length);
    validFrame(type, payload); frames.push({ type, payload }); offset += length + 4;
  }
  return { frames, remainder: Buffer.from(bytes.subarray(offset)) };
}
export function validateManifest(value: unknown): JobManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Job manifest");
  const manifest = value as Record<string, unknown>;
  const allowed = ["protocol", "platform", "arch", "sourceDigest", "binarySha256", "compiler", "sdk"];
  if (Object.keys(manifest).length !== allowed.length || Object.keys(manifest).some((key) => !allowed.includes(key)) || manifest.protocol !== 1 || manifest.platform !== "win32" || manifest.arch !== "x64") throw new Error("Unsupported Job manifest");
  for (const key of ["sourceDigest", "binarySha256"]) if (typeof manifest[key] !== "string" || !/^[a-f0-9]{64}$/u.test(manifest[key])) throw new Error("Invalid Job digest");
  for (const key of ["compiler", "sdk"]) if (typeof manifest[key] !== "string" || !manifest[key].trim() || manifest[key].length > 128) throw new Error("Invalid Job toolchain identity");
  return manifest as unknown as JobManifest;
}
