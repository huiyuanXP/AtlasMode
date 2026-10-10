import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { captureConfigurations } from "./configCapture.js";
import { scan } from "./scan.js";

// Wrap only open, preserving actual filesystem operations while observing the
// no-read boundary and shared-input reuse. Native ESM exports cannot be spied on.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, open: vi.fn(actual.open) };
});
const nativeFs = await vi.importActual<typeof fs>("node:fs/promises");

const temps: string[] = [];
const fixtureOperations: Promise<string>[] = [];
function fixture(
  inputs: Record<string, string | Buffer>,
  aliasedParent = false,
) {
  const operation = createFixture(inputs, aliasedParent);
  fixtureOperations.push(operation);
  return operation;
}
async function createFixture(
  inputs: Record<string, string | Buffer>,
  aliasedParent = false,
) {
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
    await fs.mkdtemp(join(parent, "codemap-config-")),
  );
  if (!aliasedParent) temps.push(root);
  const entries = Object.entries(inputs);
  for (const directory of new Set(entries.map(([path]) => dirname(join(root, path)))))
    await fs.mkdir(directory, { recursive: true });
  let next = 0;
  const writes = await Promise.all(
    Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (next < entries.length) {
        const [path, bytes] = entries[next++]!;
        await fs.writeFile(join(root, path), bytes);
      }
    }),
  );
  // A failed worker must not leave other owned writes racing directory removal.
  for (const write of writes)
    if (write.status === "rejected") throw write.reason;
  return root;
}
async function cleanupFixtures() {
  // Vitest timeouts do not cancel an async fixture. Drain owned setup before
  // deleting roots, including a setup that exceeded its hook deadline.
  await Promise.allSettled(fixtureOperations.splice(0));
  await Promise.all(
    temps.splice(0).map((p) => fs.rm(p, { recursive: true, force: true })),
  );
}
afterEach(async () => {
  await cleanupFixtures();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(fs.open).mockReset().mockImplementation(nativeFs.open);
});
const padded = (size: number) => "{}" + " ".repeat(size - 2);
const paths = (capture: Awaited<ReturnType<typeof captureConfigurations>>) =>
  capture.files.map((f) => f.path);

describe("captured configuration inputs", () => {
  it("drains bounded fixture writers after a real write failure before cleanup", async () => {
    const gate = () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => { release = resolve; });
      return { promise, release };
    };
    const fourStarted = gate(), failFirst = gate(), failedWrite = gate(), finishOthers = gate();
    let active = 0, peak = 0, started = 0, finished = 0, root = "";
    let fixtureFinished = false, cleanupFinished = false;
    const ownedWrites: Promise<void>[] = [];
    vi.spyOn(fs, "writeFile").mockImplementation((...args: Parameters<typeof fs.writeFile>) => {
      const write = (async () => {
        root = dirname(String(args[0]));
        active++;
        peak = Math.max(peak, active);
        if (++started === 4) fourStarted.release();
        try {
          if (String(args[0]).endsWith("tsconfig.0.json")) {
            await failFirst.promise;
            failedWrite.release();
            throw new Error("OWNED_FIXTURE_WRITE_FAILURE");
          }
          await finishOthers.promise;
          await nativeFs.writeFile(...args);
        } finally {
          active--;
          finished++;
        }
      })();
      ownedWrites.push(write);
      return write;
    });
    const operation = fixture(Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`tsconfig.${i}.json`, "{}"]),
    ));
    const outcome = operation.then(
      () => { fixtureFinished = true; return undefined; },
      (error: unknown) => { fixtureFinished = true; return error; },
    );
    let cleanup: Promise<void> | undefined;
    try {
      await fourStarted.promise;
      cleanup = cleanupFixtures().then(() => { cleanupFinished = true; });
      failFirst.release();
      await failedWrite.promise;
      // Drain promise reactions while the remaining real filesystem writes
      // stay behind an explicit barrier; this is not a timing/sleep assertion.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(fixtureFinished).toBe(false);
      expect(cleanupFinished).toBe(false);
      finishOthers.release();
      expect(await outcome).toEqual(new Error("OWNED_FIXTURE_WRITE_FAILURE"));
      await cleanup;
      expect(peak).toBe(4);
      expect(started).toBe(8);
      expect(finished).toBe(8);
      expect(active).toBe(0);
      await expect(nativeFs.stat(root)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      failFirst.release();
      finishOthers.release();
      await Promise.allSettled([outcome, ...(cleanup ? [cleanup] : []), ...ownedWrites]);
      if (root) await nativeFs.rm(root, { recursive: true, force: true });
    }
  });

  it("preserves unreadable capture fault injection through an aliased temporary parent", async () => {
    const root = await fixture({ "tsconfig.json": "{}" }, true);
    vi.mocked(fs.open).mockImplementation(
      async (...args: Parameters<typeof fs.open>) => {
        if (args[0] === join(root, "tsconfig.json"))
          throw Object.assign(new Error("PRIVATE_SENTINEL"), {
            code: "EACCES",
          });
        return nativeFs.open(...args);
      },
    );
    const result = await scan(root);
    expect(result.configurations).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        filePath: "tsconfig.json",
        message: expect.stringMatching(/^CONFIGURATION_UNAVAILABLE:/),
      }),
    );
    expect(JSON.stringify(result.diagnostics)).not.toContain(
      "PRIVATE_SENTINEL",
    );
  });

  it.each(["ignored", "symlinked", "unreadable"])(
    "marks an enumerated %s nearest config without reading bytes or counting it as source availability",
    async (rejection) => {
      const sentinel = "PRIVATE_CONFIG_SENTINEL";
      const inputs: Record<string, string> = {
        "tsconfig.json": "{}",
        "sub/a.ts": "export function a() {}",
      };
      if (rejection === "ignored") {
        inputs[".gitignore"] = "sub/tsconfig.json\n";
        inputs["sub/tsconfig.json"] = sentinel;
      } else if (rejection === "unreadable") {
        inputs["sub/tsconfig.json"] = sentinel;
      }
      const root = await fixture(inputs);
      if (rejection === "symlinked") {
        const outside = await fixture({ "base.json": sentinel });
        await fs.symlink(
          join(outside, "base.json"),
          join(root, "sub/tsconfig.json"),
          "file",
        );
      }
      const opens = vi
        .spyOn(fs, "open")
        .mockImplementation(async (...args: Parameters<typeof fs.open>) => {
          if (
            rejection === "unreadable" &&
            args[0] === join(root, "sub/tsconfig.json")
          )
            throw Object.assign(new Error(sentinel), { code: "EACCES" });
          return nativeFs.open(...args);
        });
      const result = await scan(root);
      expect(result.configurations.map((f) => f.path)).toEqual([
        "tsconfig.json",
      ]);
      expect(result.files.map((f) => f.path)).toEqual(["sub/a.ts"]);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          filePath: "sub/tsconfig.json",
          message: expect.stringMatching(/^CONFIGURATION_UNAVAILABLE:/),
        }),
      );
      expect(result.availability.unavailablePaths).not.toContain(
        "sub/tsconfig.json",
      );
      expect(JSON.stringify(result.diagnostics)).not.toContain(sentinel);
      if (rejection !== "unreadable")
        expect(opens.mock.calls.map(([p]) => p)).not.toContain(
          join(root, "sub/tsconfig.json"),
        );
      expect((await scan(root)).diagnostics).toEqual(result.diagnostics);
    },
  );

  it("captures JSONC and shared relative array extends once in deterministic order", async () => {
    const inputs = {
      "sub/tsconfig.json":
        '{ // comment\n "extends": ["../shared.json", "..\\\\shared.json"], }',
      "tsconfig.app.json": '{"extends":"./shared.json"}',
      "shared.json": '{"compilerOptions":{"baseUrl":"."}}',
      "unrelated.json": '{"sentinel":"never an input"}',
    };
    const root = await fixture(inputs);
    const opens = vi.spyOn(fs, "open");
    const result = await captureConfigurations(
      root,
      Object.keys(inputs).reverse(),
    );
    expect(paths(result)).toEqual([
      "shared.json",
      "sub/tsconfig.json",
      "tsconfig.app.json",
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.files
        .find((f) => f.path === "sub/tsconfig.json")
        ?.bytes.toString(),
    ).toBe(inputs["sub/tsconfig.json"]);
    expect(
      opens.mock.calls.filter(([p]) => p === join(root, "shared.json")),
    ).toHaveLength(1);
  });

  it("retains invalid JSONC bytes as inputs without echoing them in diagnostics", async () => {
    const invalid = '{"SECRET_SENTINEL": invalid';
    const root = await fixture({ "tsconfig.json": invalid });
    const result = await captureConfigurations(root, ["tsconfig.json"]);
    expect(paths(result)).toEqual(["tsconfig.json"]);
    expect(result.files[0]?.bytes.toString()).toBe(invalid);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        filePath: "tsconfig.json",
        message: expect.stringMatching(/invalid.*JSONC/i),
      }),
    );
    expect(JSON.stringify(result.diagnostics)).not.toContain("SECRET_SENTINEL");
  });

  it.each([262144, 262145])(
    "checks the opened file at the %i byte single-file boundary",
    async (size) => {
      const root = await fixture({ "tsconfig.json": padded(size) });
      const reads: ReturnType<typeof vi.spyOn>[] = [];
      const open = nativeFs.open;
      vi.spyOn(fs, "open").mockImplementation(
        async (...args: Parameters<typeof fs.open>) => {
          const handle = await open(...args);
          reads.push(vi.spyOn(handle, "read"), vi.spyOn(handle, "readFile"));
          return handle;
        },
      );
      const result = await captureConfigurations(root, ["tsconfig.json"]);
      if (size === 262144) {
        expect(result.files[0]?.bytes.length).toBe(262144);
        expect(result.diagnostics).toEqual([]);
      } else {
        expect(result.files).toEqual([]);
        expect(result.diagnostics).toContainEqual(
          expect.objectContaining({
            filePath: "tsconfig.json",
            message: expect.stringMatching(/262144|single.file|file.*budget/i),
          }),
        );
        expect(reads.flatMap((r) => r.mock.calls)).toEqual([]);
      }
    },
  );

  it.each([16, 17])(
    "enforces the 4194304 byte total boundary with %i maximum-size seeds",
    async (count) => {
      const inputs = Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `tsconfig.${String(i).padStart(2, "0")}.json`,
          padded(262144),
        ]),
      );
      const root = await fixture(inputs);
      const result = await captureConfigurations(root, Object.keys(inputs));
      expect(result.files).toHaveLength(16);
      expect(result.files.reduce((total, f) => total + f.bytes.length, 0)).toBe(
        4194304,
      );
      expect(result.diagnostics.length).toBe(count === 16 ? 0 : 1);
      if (count === 17)
        expect(result.diagnostics[0]?.message).toMatch(/total|4194304/i);
    },
  );

  it.each(["single-file", "total"])(
    "rejects bytes that grow past the %s budget after opened-handle stat",
    async (budget) => {
      const inputs: Record<string, string> = { "tsconfig.z.json": "{}" };
      if (budget === "total") {
        for (let i = 0; i < 16; i++)
          inputs[`tsconfig.${String(i).padStart(2, "0")}.json`] = padded(
            i === 15 ? 262142 : 262144,
          );
      }
      const root = await fixture(inputs);
      vi.spyOn(fs, "open").mockImplementation(
        async (...args: Parameters<typeof fs.open>) => {
          const handle = await nativeFs.open(...args);
          if (args[0] === join(root, "tsconfig.z.json")) {
            const stat = handle.stat.bind(handle);
            vi.spyOn(handle, "stat").mockImplementation(async () => {
              const beforeGrowth = await stat();
              await fs.writeFile(
                join(root, "tsconfig.z.json"),
                padded(budget === "single-file" ? 262145 : 3),
              );
              return beforeGrowth;
            });
          }
          return handle;
        },
      );
      const result = await captureConfigurations(root, Object.keys(inputs));
      expect(paths(result)).not.toContain("tsconfig.z.json");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          filePath: "tsconfig.z.json",
          message: expect.stringMatching(/budget after reading/i),
        }),
      );
    },
  );

  describe.each([512, 513])("%i eligible configuration seeds", (count) => {
    const inputs = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `tsconfig.${String(i).padStart(3, "0")}.json`,
        "{}",
      ]),
    );
    let root: string;
    beforeEach(async () => {
      // Fixture preparation has its own hook budget; the test measures the
      // real 512/513 capture boundary without serial setup IO in its deadline.
      root = await fixture(inputs);
    });
    it(`enforces the 512 file limit for ${count} eligible seeds`, async () => {
      const result = await captureConfigurations(
        root,
        Object.keys(inputs).reverse(),
      );
      expect(result.files).toHaveLength(512);
      expect(result.diagnostics.length).toBe(count === 512 ? 0 : 1);
      if (count === 513)
        expect(result.diagnostics[0]?.filePath).toBe("tsconfig.512.json");
    });
  });

  it.each([16, 17])(
    "bounds an extends chain of %i configuration levels",
    async (count) => {
      const inputs: Record<string, string> = {};
      for (let i = 1; i <= count; i++)
        inputs[i === 1 ? "tsconfig.json" : `level${i}.json`] =
          i === count
            ? "{}"
            : JSON.stringify({ extends: `./level${i + 1}.json` });
      const root = await fixture(inputs);
      const result = await captureConfigurations(root, Object.keys(inputs));
      expect(result.files).toHaveLength(16);
      expect(paths(result)).not.toContain("level17.json");
      expect(result.diagnostics.length).toBe(count === 16 ? 0 : 1);
      if (count === 17)
        expect(result.diagnostics[0]?.message).toMatch(/depth|16/i);
    },
  );

  it("diagnoses a cycle even when a path was already captured", async () => {
    const root = await fixture({
      "tsconfig.json": '{"extends":"./shared.json"}',
      "shared.json": '{"extends":"./tsconfig.json"}',
    });
    const result = await captureConfigurations(root, [
      "shared.json",
      "tsconfig.json",
    ]);
    expect(paths(result)).toEqual(["shared.json", "tsconfig.json"]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        filePath: "shared.json",
        message: expect.stringMatching(/cycle/i),
      }),
    );
    expect(
      await captureConfigurations(root, ["tsconfig.json", "shared.json"]),
    ).toEqual(result);
  });

  it.each([
    ["./missing.json", /missing|not.*allowed|unavailable/i],
    ["@scope/config", /unsupported|package/i],
    ["./base.ts", /unsupported|\.json/i],
    ["../../outside.json", /outside|escape/i],
    ["C:\\outside.json", /unsupported|absolute/i],
  ])(
    "rejects unavailable or unsupported extends %s",
    async (target, reason) => {
      const root = await fixture({
        "tsconfig.json": JSON.stringify({ extends: target }),
      });
      const result = await captureConfigurations(root, ["tsconfig.json"]);
      expect(paths(result)).toEqual(["tsconfig.json"]);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          filePath: "tsconfig.json",
          message: expect.stringMatching(reason),
        }),
      );
    },
  );

  it("diagnoses an allowed file removed before capture", async () => {
    const root = await fixture({});
    const result = await captureConfigurations(root, ["tsconfig.json"]);
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        filePath: "tsconfig.json",
        message: expect.stringMatching(/read|missing|unavailable/i),
      }),
    );
  });

  it("rechecks file and directory symlinks without reading outside sentinel bytes", async () => {
    const sentinel = "PRIVATE_SENTINEL_NEVER_READ";
    const outside = await fixture({
      "base.json": sentinel,
      "tsconfig.json": sentinel,
    });
    const root = await fixture({
      "tsconfig.json": '{"extends":["./link.json","./linked/tsconfig.json"]}',
    });
    await fs.symlink(
      join(outside, "base.json"),
      join(root, "link.json"),
      "file",
    );
    await fs.symlink(outside, join(root, "linked"), "dir");
    const opens = vi.spyOn(fs, "open");
    const result = await captureConfigurations(root, [
      "tsconfig.json",
      "link.json",
      "linked/tsconfig.json",
    ]);
    expect(paths(result)).toEqual(["tsconfig.json"]);
    expect(
      result.diagnostics.some((d) => /symlink|outside/i.test(d.message)),
    ).toBe(true);
    expect(opens.mock.calls.map(([p]) => p)).toEqual([
      join(root, "tsconfig.json"),
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("composes scanner ignores and fixed exclusions without exposing configuration as source", async () => {
    const sentinel = "PRIVATE_SENTINEL_NEVER_READ";
    const outside = await fixture({ "outside.json": sentinel });
    const inputs = {
      "a.ts": "export function a() {}",
      ".gitignore": "ignored.json\nignored/\n",
      "sub/.gitignore": "private.json\n",
      "tsconfig.json":
        '{"extends":["./ignored.json","./ignored/base.json","./sub/private.json","./node_modules/base.json","./link.json","../outside.json"]}',
      "sub/tsconfig.json": '{"extends":"../shared.json"}',
      "shared.json": "{}",
      "ignored.json": sentinel,
      "ignored/base.json": sentinel,
      "sub/private.json": sentinel,
      "node_modules/base.json": sentinel,
    };
    const root = await fixture(inputs);
    await fs.symlink(
      join(outside, "outside.json"),
      join(root, "link.json"),
      "file",
    );
    const opens = vi.spyOn(fs, "open");
    const result = await scan(root);
    expect(result.files.map((f) => f.path)).toEqual(["a.ts"]);
    expect(result).toHaveProperty("configurations");
    expect(result.configurations.map((f) => f.path)).toEqual([
      "shared.json",
      "sub/tsconfig.json",
      "tsconfig.json",
    ]);
    expect(
      result.diagnostics.filter((d) => d.filePath === "tsconfig.json"),
    ).toHaveLength(6);
    expect(result.availability.unavailablePaths).toEqual(
      expect.arrayContaining(["ignored", "link.json"]),
    );
    expect(result.availability.excludedPaths).toContain("node_modules");
    expect(JSON.stringify(result.diagnostics)).not.toContain(sentinel);
    expect(opens.mock.calls.map(([p]) => p)).not.toContain(
      join(root, "ignored.json"),
    );
    expect(opens.mock.calls.map(([p]) => p)).not.toContain(
      join(outside, "outside.json"),
    );
  });
});
