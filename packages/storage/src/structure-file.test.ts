import { expect, test } from "vitest";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { StructureFileStore } from "./structure-file.js";

const bytes = (purpose: string) =>
  Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      folders: [{ path: "src", purpose }],
      dependencyRules: [],
    }),
  );
const digest = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
async function fixture() {
  const root = await fs.mkdtemp(join(tmpdir(), "atlas-pol01-file-"));
  const directory = join(root, ".codemap"),
    path = join(directory, "structure.json");
  await fs.mkdir(directory);
  await fs.writeFile(path, bytes("old"));
  return { root, path, original: bytes("old") };
}
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

test("reads actual bytes digest and missing null", async () => {
  const { root, original } = await fixture();
  const store = new StructureFileStore();
  expect(await store.read(root)).toMatchObject({
    bytes: original,
    digest: digest(original),
    diagnostics: [],
  });
  expect(
    await store.read(await fs.mkdtemp(join(tmpdir(), "atlas-pol01-missing-"))),
  ).toMatchObject({ bytes: null, digest: null, diagnostics: [] });
});
test("oversize and invalid UTF8 retain stable actual digest and do not mutate", async () => {
  const { root, path } = await fixture(),
    store = new StructureFileStore();
  for (const content of [
    Buffer.alloc(1024 * 1024 + 1, 32),
    Buffer.from([0xc0, 0x80]),
  ]) {
    await fs.writeFile(path, content);
    const read = await store.read(root);
    expect(read.digest).toBe(digest(content));
    expect(read.diagnostics).not.toHaveLength(0);
    expect(Buffer.compare(await fs.readFile(path), content)).toBe(0);
  }
});
test("rejects symlink metadata directory and file", async () => {
  const { root, path } = await fixture(),
    store = new StructureFileStore();
  const outside = await fs.mkdtemp(join(tmpdir(), "atlas-pol01-outside-"));
  const linkedRoot = await fs.mkdtemp(join(tmpdir(), "atlas-pol01-linked-"));
  await fs.symlink(outside, join(linkedRoot, ".codemap"), "dir");
  await expect(store.read(linkedRoot)).rejects.toMatchObject({
    code: "INVALID_PATH",
  });
  await fs.unlink(path);
  await fs.symlink(join(outside, "not-a-target"), path);
  await expect(store.read(root)).rejects.toMatchObject({
    code: "INVALID_PATH",
  });
});
test.each(["open", "writeFile", "sync", "close", "rename"])(
  "prepublication %s failure leaves original exact bytes",
  async (stage) => {
    const { root, path, original } = await fixture();
    const store = new StructureFileStore({
      fs: {
        ...fs,
        open: async (...args: Parameters<typeof fs.open>) => {
          const temporary = String(args[0]).endsWith(".tmp");
          if (temporary && stage === "open") throw new Error("injected-open");
          const handle = await fs.open(...args);
          if (!temporary) return handle;
          return new Proxy(handle, {
            get(target, key) {
              if (key === stage)
                return async () => {
                  if (stage === "close") await target.close();
                  throw new Error(`injected-${stage}`);
                };
              const value = Reflect.get(target, key, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        },
        rename: async (...args: Parameters<typeof fs.rename>) => {
          if (stage === "rename") throw new Error("injected-rename");
          return fs.rename(...args);
        },
      },
    });
    const result = await store.publish(root, {
      mutationId: "one",
      expectedDigest: digest(original),
      bytes: bytes("new"),
    });
    expect(result.phase).toBe("not_published");
    expect(result.actualDigest).toBe(digest(original));
    expect(await fs.readFile(path)).toEqual(original);
  },
);
test("postpublication directory sync failure cannot report unmodified original", async () => {
  const { root, path, original } = await fixture();
  const store = new StructureFileStore({
    fs: {
      ...fs,
      open: async (...args: Parameters<typeof fs.open>) => {
        const handle = await fs.open(...args);
        if (basename(String(args[0])) !== ".codemap") return handle;
        return new Proxy(handle, {
          get(target, key) {
            if (key === "sync")
              return async () => {
                throw new Error("injected-directory-sync");
              };
            const value = Reflect.get(target, key, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    },
  });
  const result = await store.publish(root, {
    mutationId: "one",
    expectedDigest: digest(original),
    bytes: bytes("new"),
  });
  expect(result.phase).toBe("uncertain");
  expect(result.actualDigest).toBe(digest(bytes("new")));
  expect(await fs.readFile(path)).toEqual(bytes("new"));
});
test("digest recheck detects external update before publication", async () => {
  const { root, path, original } = await fixture();
  let changed = false;
  const store = new StructureFileStore({
    fs: {
      ...fs,
      open: async (...args: Parameters<typeof fs.open>) => {
        const handle = await fs.open(...args);
        if (String(args[0]).endsWith(".tmp") && !changed) {
          changed = true;
          await fs.writeFile(path, bytes("external"));
        }
        return handle;
      },
    },
  });
  expect(
    await store.publish(root, {
      mutationId: "one",
      expectedDigest: digest(original),
      bytes: bytes("new"),
    }),
  ).toMatchObject({
    phase: "not_published",
    errorCode: "STRUCTURE_CONFLICT",
    actualDigest: digest(bytes("external")),
  });
  expect(await fs.readFile(path)).toEqual(bytes("external"));
});
test("concurrent readers see complete old or new JSON and original permissions persist", async () => {
  const { root, path, original } = await fixture(),
    entered = gate(),
    release = gate();
  await fs.chmod(path, 0o640);
  const originalMode = (await fs.stat(path)).mode & 0o777;
  if (process.platform !== "win32") expect(originalMode).toBe(0o640);
  const unlinked: string[] = [];
  const store = new StructureFileStore({
    fs: {
      ...fs,
      rename: async (...args: Parameters<typeof fs.rename>) => {
        entered.resolve();
        await release.promise;
        return fs.rename(...args);
      },
      unlink: async (file: Parameters<typeof fs.unlink>[0]) => {
        unlinked.push(String(file));
        return fs.unlink(file);
      },
    },
  });
  const publishing = store.publish(root, {
    mutationId: "one",
    expectedDigest: digest(original),
    bytes: bytes("new"),
  });
  // Observe an incomplete adapter's failure without leaving a rejected promise or a hung gate.
  void publishing.catch(() => entered.resolve());
  await entered.promise;
  const reading = Promise.all(
    Array.from({ length: 30 }, () => store.read(root)),
  );
  void reading.catch(() => {});
  release.resolve();
  await publishing;
  const reads = [...(await reading), await store.read(root)];
  for (const read of reads) {
    expect([digest(original), digest(bytes("new"))]).toContain(read.digest);
    expect(() =>
      JSON.parse(Buffer.from(read.bytes!).toString("utf8")),
    ).not.toThrow();
  }
  expect((await fs.stat(path)).mode & 0o777).toBe(originalMode);
  expect(unlinked).not.toContain(path);
});
