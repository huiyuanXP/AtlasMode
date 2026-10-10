import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { captureConfigurations } from "./configCapture.js";
import { scan } from "./scan.js";

const temps: string[] = [];
async function fixture(inputs: Record<string, unknown>) {
  const root = await mkdtemp(join(tmpdir(), "codemap-idx03-"));
  temps.push(root);
  for (const [path, value] of Object.entries(inputs)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(
      join(root, path),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  }
  return root;
}
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const paths = (capture: Awaited<ReturnType<typeof captureConfigurations>>) =>
  capture.files.map((f) => f.path);

describe("IDX03 captured reference discovery", () => {
  it("captures directory and arbitrary named targets plus their extends from JSONC once", async () => {
    const inputs = {
      "tsconfig.json":
        '{ // solution\n "files": [], "references": [{"path":"./lib"},{"path":"configs/client.json"},{"path":"configs\\\\client.json"}], }',
      "lib/tsconfig.json": {
        compilerOptions: { composite: true },
        references: [{ path: "../configs/client.json" }],
      },
      "configs/client.json": {
        extends: "../base.json",
        compilerOptions: { composite: true },
      },
      "base.json": {},
      "unrelated.json": { sentinel: "never a configuration input" },
    };
    const root = await fixture(inputs);
    const result = await captureConfigurations(
      root,
      Object.keys(inputs).reverse(),
    );
    expect(paths(result)).toEqual([
      "base.json",
      "configs/client.json",
      "lib/tsconfig.json",
      "tsconfig.json",
    ]);
    expect(result.diagnostics).toEqual([]);
  });
  it("does not inherit a base configuration's references", async () => {
    const inputs = {
      "tsconfig.json": { extends: "./base.json" },
      "base.json": { references: [{ path: "./hidden.json" }] },
      "hidden.json": {},
    };
    const root = await fixture(inputs);
    expect(
      paths(await captureConfigurations(root, Object.keys(inputs))),
    ).toEqual(["base.json", "tsconfig.json"]);
  });
  it.each([
    ["./missing", /missing|unavailable/i],
    ["../../outside.json", /escape|outside/i],
    ["/configs/client.json", /absolute|relative/i],
    ["C:configs/client.json", /drive|relative/i],
    ["C:\\configs\\client.json", /drive|relative/i],
    ["\\\\host\\client.json", /UNC|relative/i],
    ["//host/client.json", /UNC|relative/i],
    ["https://host/client.json", /URL|scheme|relative/i],
    ["./client\0.json", /NUL|relative/i],
    ["./client.ts", /suffix|\.json|directory/i],
  ])(
    "rejects reference path %s before mapping to an allowed input",
    async (path, reason) => {
      const inputs = {
        "tsconfig.json": { references: [{ path }] },
        "configs/client.json": {},
      };
      const root = await fixture(inputs);
      const result = await captureConfigurations(root, Object.keys(inputs));
      expect(paths(result)).toEqual(["tsconfig.json"]);
      expect(
        result.diagnostics.some(
          (d) => d.filePath === "tsconfig.json" && reason.test(d.message),
        ),
      ).toBe(true);
    },
  );
  it.each([42, "dynamic", {}, [null], [{ path: 2 }], [{ path: "" }]])(
    "reports malformed reference structure %j",
    async (references) => {
      const root = await fixture({ "tsconfig.json": { references } });
      const result = await captureConfigurations(root, ["tsconfig.json"]);
      expect(result.diagnostics.some((d) => /reference/i.test(d.message))).toBe(
        true,
      );
    },
  );
  it("keeps valid named branch captured when another branch is missing", async () => {
    const inputs = {
      "tsconfig.json": {
        files: [],
        references: [{ path: "./configs/client.json" }, { path: "./missing" }],
      },
      "configs/client.json": {
        compilerOptions: { composite: true },
        include: ["../src/client"],
      },
    };
    const root = await fixture(inputs);
    const result = await captureConfigurations(root, Object.keys(inputs));
    expect(paths(result)).toEqual(["configs/client.json", "tsconfig.json"]);
    expect(
      result.diagnostics.some((d) => /missing|unavailable/i.test(d.message)),
    ).toBe(true);
  });
  it("reports reference cycles even with shared captured inputs", async () => {
    const inputs = {
      "tsconfig.json": { references: [{ path: "./client.json" }] },
      "client.json": { references: [{ path: "./tsconfig.json" }] },
    };
    const root = await fixture(inputs);
    const result = await captureConfigurations(root, Object.keys(inputs));
    expect(paths(result)).toEqual(["client.json", "tsconfig.json"]);
    expect(
      result.diagnostics.some((d) => /reference.*cycle/i.test(d.message)),
    ).toBe(true);
  });
  it.each([16, 17])("bounds reference depth at %i", async (count) => {
    const inputs: Record<string, unknown> = {};
    for (let i = 1; i <= count; i++)
      inputs[i === 1 ? "tsconfig.json" : `level${i}.json`] =
        i === count ? {} : { references: [{ path: `./level${i + 1}.json` }] };
    const root = await fixture(inputs);
    const result = await captureConfigurations(root, Object.keys(inputs));
    expect(result.files).toHaveLength(16);
    expect(
      result.diagnostics.some((d) => /reference.*depth/i.test(d.message)),
    ).toBe(count === 17);
  });
  it("bounds reference entry traversal at 2048 without reading the extra target", async () => {
    const inputs = {
      "tsconfig.json": {
        references: [
          ...Array.from({ length: 2048 }, () => ({ path: "./shared.json" })),
          { path: "./extra.json" },
        ],
      },
      "shared.json": {},
      "extra.json": {},
    };
    const root = await fixture(inputs);
    const result = await captureConfigurations(root, Object.keys(inputs));
    expect(paths(result)).toEqual(["shared.json", "tsconfig.json"]);
    expect(
      result.diagnostics.some((d) =>
        /reference.*2048|reference.*budget/i.test(d.message),
      ),
    ).toBe(true);
  });
  it("does not capture ignored, excluded or symlinked reference bytes", async () => {
    const sentinel = "PRIVATE_IDX03_SENTINEL";
    const outside = await fixture({ "config.json": sentinel });
    const root = await fixture({
      "tsconfig.json": {
        references: [
          { path: "./ignored.json" },
          { path: "./node_modules/pkg" },
          { path: "./link.json" },
        ],
      },
      ".gitignore": "ignored.json\n",
      "ignored.json": sentinel,
      "node_modules/pkg/tsconfig.json": sentinel,
      "entry.ts": "export function entry() {}",
    });
    await symlink(join(outside, "config.json"), join(root, "link.json"));
    const result = await scan(root);
    expect(result.configurations.map((f) => f.path)).toEqual(["tsconfig.json"]);
    expect(
      result.diagnostics.filter((d) => d.filePath === "tsconfig.json"),
    ).toHaveLength(3);
    expect(JSON.stringify(result.diagnostics)).not.toContain(sentinel);
  });
});
