import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scan } from "./scan.js";
import { capturePackages } from "./packageCapture.js";
import { captureConfigurations } from "./configCapture.js";
import { createMetadataReader } from "./metadataRead.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, open: vi.fn(actual.open) };
});
const nativeFs = await vi.importActual<typeof fs>("node:fs/promises");
const temps: string[] = [];
async function fixture(inputs: Record<string, string>, aliasedParent = false) {
  let parent = tmpdir();
  if (aliasedParent) {
    const container = await fs.mkdtemp(join(tmpdir(), "codemap-alias-"));
    temps.push(container);
    await fs.mkdir(join(container, "actual"));
    parent = join(container, "alias");
    await fs.symlink(join(container, "actual"), parent, "junction");
  }
  // Match production's canonical root (macOS /var and Windows short paths
  // can alias the temporary directory even without an explicit symlink).
  const root = await fs.realpath(
    await fs.mkdtemp(join(parent, "codemap-package-")),
  );
  if (!aliasedParent) temps.push(root);
  for (const [path, bytes] of Object.entries(inputs)) {
    await fs.mkdir(dirname(join(root, path)), { recursive: true });
    await fs.writeFile(join(root, path), bytes);
  }
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(fs.open).mockReset().mockImplementation(nativeFs.open);
  await Promise.all(
    temps.splice(0).map((p) => fs.rm(p, { recursive: true, force: true })),
  );
});
const padded = (size: number) => "{}" + " ".repeat(size - 2);

describe("captured package inputs", () => {
  it("preserves unreadable capture fault injection through an aliased temporary parent", async () => {
    const root = await fixture({ "package.json": "{}" }, true);
    vi.mocked(fs.open).mockImplementation(
      async (...args: Parameters<typeof fs.open>) => {
        if (args[0] === join(root, "package.json"))
          throw Object.assign(new Error("PRIVATE_SENTINEL"), {
            code: "EACCES",
          });
        return nativeFs.open(...args);
      },
    );
    const result = await scan(root);
    expect(result.manifests).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        filePath: "package.json",
        message: expect.stringMatching(/^PACKAGE_MANIFEST_UNAVAILABLE:/),
      }),
    );
    expect(JSON.stringify(result.diagnostics)).not.toContain(
      "PRIVATE_SENTINEL",
    );
  });

  it("captures deterministic package inputs separately and reuses configuration overlap bytes", async () => {
    const root = await fixture({
      "package.json": "{}",
      "sub/package.json": '{"type":"module"}',
      "tsconfig.json": '{"extends":"./package.json"}',
      "a.js": "function a() {}",
      "other.json": "PRIVATE_SENTINEL",
    });
    const result = await scan(root);
    expect(result).toHaveProperty("manifests");
    expect(result.manifests.map((f) => f.path)).toEqual([
      "package.json",
      "sub/package.json",
    ]);
    expect(result.files.map((f) => f.path)).toEqual(["a.js"]);
    expect(result.configurations.map((f) => f.path)).toEqual([
      "package.json",
      "tsconfig.json",
    ]);
    expect(result.manifests[0]?.bytes).toBe(result.configurations[0]?.bytes);
    expect(
      vi
        .mocked(fs.open)
        .mock.calls.filter(([p]) => p === join(root, "package.json")),
    ).toHaveLength(1);
    expect(vi.mocked(fs.open).mock.calls.map(([p]) => p)).not.toContain(
      join(root, "other.json"),
    );
  });
  it.each(["ignored", "symlink", "directory", "unreadable"])(
    "retains an opaque %s nearest seed without leaking bytes into source availability",
    async (kind) => {
      const root = await fixture({
        "package.json": "{}",
        "sub/a.js": "function a() {}",
        ...(kind === "ignored" ? { ".gitignore": "sub/package.json\n" } : {}),
      });
      const target = join(root, "sub/package.json");
      if (kind === "symlink") {
        const outside = await fixture({ "private.json": "PRIVATE_SENTINEL" });
        await fs.symlink(join(outside, "private.json"), target, "file");
      } else if (kind === "directory") await fs.mkdir(target);
      else await fs.writeFile(target, "PRIVATE_SENTINEL");
      if (kind === "unreadable")
        vi.mocked(fs.open).mockImplementation(
          async (...args: Parameters<typeof fs.open>) => {
            if (args[0] === target) throw new Error("PRIVATE_SENTINEL");
            return nativeFs.open(...args);
          },
        );
      const result = await scan(root);
      expect(result).toHaveProperty("manifests");
      expect(result.manifests.map((f) => f.path)).toEqual(["package.json"]);
      expect(result.diagnostics).toContainEqual({
        filePath: "sub/package.json",
        message: expect.stringMatching(/^PACKAGE_MANIFEST_UNAVAILABLE:/),
      });
      expect(result.availability.unavailablePaths).not.toContain(
        "sub/package.json",
      );
      expect(JSON.stringify(result.diagnostics)).not.toContain(
        "PRIVATE_SENTINEL",
      );
      if (kind !== "unreadable")
        expect(vi.mocked(fs.open).mock.calls.map(([p]) => p)).not.toContain(
          target,
        );
    },
  );
  it.each([262144, 262145])(
    "enforces single-file boundary %i",
    async (size) => {
      const root = await fixture({ "package.json": padded(size) });
      const result = await scan(root);
      expect(result).toHaveProperty("manifests");
      expect(result.manifests.map((f) => f.bytes.length)).toEqual(
        size === 262144 ? [262144] : [],
      );
      expect(result.diagnostics.length).toBe(size === 262144 ? 0 : 1);
    },
  );
  it.each([16, 17])(
    "enforces total byte boundary with %i files",
    async (count) => {
      const root = await fixture(
        Object.fromEntries(
          Array.from({ length: count }, (_, i) => [
            `${String(i).padStart(2, "0")}/package.json`,
            padded(262144),
          ]),
        ),
      );
      const result = await scan(root);
      expect(result).toHaveProperty("manifests");
      expect(result.manifests).toHaveLength(16);
      expect(result.manifests.reduce((sum, f) => sum + f.bytes.length, 0)).toBe(
        4194304,
      );
      expect(result.diagnostics.length).toBe(count === 16 ? 0 : 1);
    },
  );
  it.each([512, 513])(
    "enforces count boundary with %i files",
    async (count) => {
      const root = await fixture(
        Object.fromEntries(
          Array.from({ length: count }, (_, i) => [
            `${String(i).padStart(3, "0")}/package.json`,
            "{}",
          ]),
        ),
      );
      const result = await scan(root);
      expect(result).toHaveProperty("manifests");
      expect(result.manifests).toHaveLength(512);
      expect(result.diagnostics.length).toBe(count === 512 ? 0 : 1);
      if (count === 513)
        expect(result.diagnostics[0]?.filePath).toBe("512/package.json");
    },
  );
  it.each([
    '{"type":"commonjs",}',
    "{/* secret */}",
    "null",
    "[]",
    '{"type":null}',
    '{"type":"future"}',
  ])(
    "retains strict invalid manifest %s bytes and gives a redacted diagnostic",
    async (bytes) => {
      const root = await fixture({ "package.json": bytes });
      const result = await scan(root);
      expect(result).toHaveProperty("manifests");
      expect(result.manifests[0]?.bytes.toString()).toBe(bytes);
      expect(result.diagnostics).toContainEqual({
        filePath: "package.json",
        message: expect.stringMatching(/Invalid package/i),
      });
      expect(JSON.stringify(result.diagnostics)).not.toContain("secret");
    },
  );
  it("reuses overlap bytes but accounts them fully in each category", async () => {
    const inputs: Record<string, string> = {};
    for (let i = 0; i < 17; i++)
      inputs[`${String(i).padStart(2, "0")}/package.json`] = padded(262144);
    inputs["tsconfig.json"] = JSON.stringify({
      extends: Object.keys(inputs).map((p) => `./${p}`),
    });
    const root = await fixture(inputs);
    const result = await scan(root);
    expect(result.manifests).toHaveLength(16);
    expect(result.configurations).toHaveLength(16); // seed plus fifteen packages
    expect(result.manifests.map((f) => f.path)).toContain("15/package.json");
    expect(result.configurations.map((f) => f.path)).not.toContain(
      "15/package.json",
    );
    expect(result.diagnostics).toContainEqual({
      filePath: "16/package.json",
      message: expect.stringMatching(/^PACKAGE_MANIFEST_UNAVAILABLE:.*total/),
    });
    for (const f of result.configurations.filter((f) =>
      f.path.endsWith("package.json"),
    )) {
      expect(result.manifests.find((p) => p.path === f.path)?.bytes).toBe(
        f.bytes,
      );
      expect(
        vi.mocked(fs.open).mock.calls.filter(([p]) => p === join(root, f.path)),
      ).toHaveLength(1);
    }
  });
  it("keeps configuration acceptance independent when packages exhaust their budget first", async () => {
    const inputs: Record<string, string> = {
      "tsconfig.json": '{"extends":"./z/package.json"}',
      "z/package.json": "{}",
    };
    for (let i = 0; i < 16; i++)
      inputs[`${String(i).padStart(2, "0")}/package.json`] = padded(262144);
    const root = await fixture(inputs);
    const reader = await createMetadataReader(root, Object.keys(inputs));
    const packages = await capturePackages(
      Object.keys(inputs).filter((p) => p.endsWith("package.json")),
      new Map(),
      reader,
    );
    expect(packages.files).toHaveLength(16);
    const configurations = await captureConfigurations(
      root,
      Object.keys(inputs),
      reader,
    );
    expect(configurations.files.map((f) => f.path)).toEqual([
      "tsconfig.json",
      "z/package.json",
    ]);
    expect(configurations.diagnostics).toEqual([]);
  });
  it("rejects directory symlinks and outside-root paths without opening sentinel bytes", async () => {
    const outside = await fixture({ "package.json": "PRIVATE_SENTINEL" });
    const root = await fixture({});
    await fs.symlink(outside, join(root, "linked"), "dir");
    const reader = await createMetadataReader(root, ["linked/package.json"]);
    const result = await capturePackages(
      ["linked/package.json"],
      new Map(),
      reader,
    );
    expect(result.files).toEqual([]);
    expect(result.diagnostics[0]?.message).toMatch(/symlink/);
    await expect(
      createMetadataReader(root, ["../package.json"]),
    ).rejects.toThrow();
    expect(vi.mocked(fs.open).mock.calls).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
  });
  it("applies Git ignores and fixed exclusions without opening package bytes", async () => {
    const root = await fixture({
      ".gitignore": "ignored/\n",
      "ignored/package.json": "PRIVATE_SENTINEL",
      "node_modules/package.json": "PRIVATE_SENTINEL",
      "sub/.gitignore": "package.json\n",
      "sub/package.json": "PRIVATE_SENTINEL",
      "package.json": "{}",
    });
    const result = await scan(root);
    expect(result.manifests.map((f) => f.path)).toEqual(["package.json"]);
    expect(result.availability.excludedPaths).toContain("node_modules");
    expect(
      result.diagnostics
        .filter((d) => d.message.startsWith("PACKAGE_MANIFEST_UNAVAILABLE:"))
        .map((d) => d.filePath),
    ).toEqual(["ignored/package.json", "sub/package.json"]);
    for (const path of [
      "ignored/package.json",
      "sub/package.json",
      "node_modules/package.json",
    ])
      expect(vi.mocked(fs.open).mock.calls.map(([p]) => p)).not.toContain(
        join(root, path),
      );
  });
  it.each(["single-file", "total"])(
    "rejects package growth after stat against %s budget",
    async (budget) => {
      const inputs: Record<string, string> = { "z/package.json": "{}" };
      if (budget === "total")
        for (let i = 0; i < 16; i++)
          inputs[`${String(i).padStart(2, "0")}/package.json`] = padded(
            i === 15 ? 262142 : 262144,
          );
      const root = await fixture(inputs);
      vi.mocked(fs.open).mockImplementation(
        async (...args: Parameters<typeof fs.open>) => {
          const handle = await nativeFs.open(...args);
          if (args[0] === join(root, "z/package.json")) {
            const stat = handle.stat.bind(handle);
            vi.spyOn(handle, "stat").mockImplementation(async () => {
              const before = await stat();
              await fs.writeFile(
                join(root, "z/package.json"),
                padded(budget === "single-file" ? 262145 : 3),
              );
              return before;
            });
          }
          return handle;
        },
      );
      const result = await scan(root);
      expect(result.manifests.map((f) => f.path)).not.toContain(
        "z/package.json",
      );
      expect(result.diagnostics).toContainEqual({
        filePath: "z/package.json",
        message: expect.stringMatching(/budget after reading/),
      });
    },
  );
});
