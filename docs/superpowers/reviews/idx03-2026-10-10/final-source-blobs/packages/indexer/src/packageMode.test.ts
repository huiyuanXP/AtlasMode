import { describe, expect, it } from "vitest";
import { createPackageModeProvider } from "./packageMode.js";
const manifest = (path: string, text: string) => ({
  path,
  bytes: Buffer.from(text),
});

describe("captured nearest package mode", () => {
  it.each([
    ["{}", "commonjs"],
    ['{"type":"commonjs"}', "commonjs"],
    ['{"type":"module"}', "esm"],
    ['{"type":"unknown"}', "unknown"],
    ['{"type":false}', "unknown"],
    ['{"type":null}', "unknown"],
    ["null", "unknown"],
    ["[]", "unknown"],
    ['{"type":"commonjs",}', "unknown"],
    ["{/*comment*/}", "unknown"],
  ])(
    "uses nearest strict manifest %s without ancestor fallback",
    (text, expected) => {
      const mode = createPackageModeProvider([
        manifest("package.json", "{}"),
        manifest("sub/package.json", text),
      ]);
      expect(mode("sub/lib.js")).toBe(expected);
      expect(mode("sub/deep/lib.js")).toBe(expected);
      expect(mode("submarine/lib.js")).toBe("commonjs");
    },
  );
  it("has no implicit or outside-root package scope", () => {
    const mode = createPackageModeProvider([
      manifest("../package.json", "{}"),
      manifest("sub/package.json", "{}"),
    ]);
    expect(mode("entry.js")).toBe("unknown");
    expect(mode("../entry.js")).toBe("unknown");
    expect(mode("sub/lib.js")).toBe("commonjs");
  });
  it("honors opaque nearest package markers and explicit extensions only", () => {
    const mode = createPackageModeProvider(
      [manifest("package.json", "{}")],
      [
        {
          filePath: "sub/package.json",
          message: "PACKAGE_MANIFEST_UNAVAILABLE: excluded",
        },
        { filePath: "else/package.json", message: "unrelated diagnostic" },
      ],
    );
    expect(mode("sub/lib.js")).toBe("unknown");
    expect(mode("sub/lib.cjs")).toBe("commonjs");
    expect(mode("sub/lib.mjs")).toBe("esm");
    expect(mode("else/lib.js")).toBe("commonjs");
    for (const path of ["lib.ts", "lib.jsx", "lib.cts", "lib.mts"])
      expect(mode(path)).toBe("unknown");
  });
  it("does not confuse config unavailable markers with package evidence", () => {
    const mode = createPackageModeProvider(
      [manifest("package.json", "{}")],
      [
        {
          filePath: "sub/package.json",
          message: "CONFIGURATION_UNAVAILABLE: budget",
        },
      ],
    );
    expect(mode("sub/lib.js")).toBe("commonjs");
  });
});
