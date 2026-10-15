import { describe, expect, it } from "vitest";
import { decodeFrames, encodeLaunch, encodeFrame, quoteWindowsArgument, validateManifest } from "./windows-job-protocol.js";

const input = { command: "C:\\node.exe", cwd: "C:\\work", args: ["", "中文", 'a"b', "end\\"], env: { Path: "C:\\bin", EMPTY: "", OMIT: undefined } };

describe("Windows owned Job private wire codec", () => {
  it("preserves literal argv and omits undefined environment entries", () => {
    const frame = encodeLaunch(input);
    expect(frame.readUInt32LE(0)).toBe(frame.length - 4);
    expect(frame[4]).toBe(2);
    expect(frame.includes(Buffer.from("OMIT"))).toBe(false);
    expect(frame.includes(Buffer.from("中文"))).toBe(true);
    expect(frame.subarray(5, 20).toString("hex")).toBe("0b000000433a5c6e6f64652e657865");
  });
  it.each([
    { ...input, command: "node.exe" },
    { ...input, command: "C:\\node.cmd" },
    { ...input, cwd: "relative" },
    { ...input, args: ["bad\0value"] },
    { ...input, args: ["\ud800"] },
    { ...input, args: Array<string>(257).fill("") },
    { ...input, env: { Path: "a", PATH: "b" } },
    { ...input, env: { "": "a" } },
    { ...input, env: { "A=B": "a" } },
    { ...input, args: ["x".repeat(32767)] },
  ])("refuses a launch outside the executable/text/count/command-line contract", (value) => {
    expect(() => encodeLaunch(value)).toThrow();
  });
  it.each([["", '""'], ["plain", '"plain"'], ['a"b', '"a\\"b"'], ["end\\", '"end\\\\"']])("quotes %j without a shell", (arg, expected) => {
    expect(quoteWindowsArgument(arg!)).toBe(expected);
  });
  it("decodes arbitrarily split and contiguous frames with an explicit remainder", () => {
    const bytes = Buffer.from([1, 0, 0, 0, 5, 1, 0, 0, 0, 6]);
    const first = decodeFrames(bytes.subarray(0, 3));
    expect(first.frames).toEqual([]);
    const rest = decodeFrames(Buffer.concat([first.remainder, bytes.subarray(3)]));
    expect(rest.frames.map((frame) => frame.type)).toEqual([5, 6]);
    expect(rest.remainder.length).toBe(0);
  });
  it.each([
    Buffer.from([0, 0, 0, 0]), Buffer.from([0xff, 0xff, 0xff, 0x7f]),
    Buffer.from([1, 0, 0, 0, 8]), Buffer.from([2, 0, 0, 0, 5, 1]),
    Buffer.from([1, 0, 0, 0, 3]),
  ])("refuses malformed bounded status frames", (bytes) => {
    expect(() => decodeFrames(bytes)).toThrow();
  });
  it("bounds a status frame before producing bytes", () => {
    expect(() => encodeFrame(7, Buffer.alloc(257))).toThrow();
  });
  it("validates strict binary provenance without accepting extra or future fields", () => {
    const value = { protocol: 1, platform: "win32", arch: "x64", sourceDigest: "a".repeat(64), binarySha256: "b".repeat(64), compiler: "MSVC 19.44", sdk: "10.0.26100.0" };
    expect(validateManifest(value)).toEqual(value);
    for (const invalid of [{ ...value, arch: "arm64" }, { ...value, protocol: 2 }, { ...value, extra: true }, { ...value, binarySha256: "B".repeat(64) }, { ...value, compiler: "" }]) {
      expect(() => validateManifest(invalid)).toThrow();
    }
  });
});
