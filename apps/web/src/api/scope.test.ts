import { expect, it, vi } from "vitest";
import { ProjectScope } from "./scope.js";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
it("late project requests cannot commit into a new project, including switching back", async () => {
  const scope = new ProjectScope();
  const pending = deferred<string>();
  const visible: string[] = [];
  scope.select("a");
  const old = scope.run(
    "source",
    () => pending.promise,
    (v) => visible.push(v),
  );
  scope.select("b");
  await scope.run(
    "source",
    async () => "B",
    (v) => visible.push(v),
  );
  scope.select("a");
  pending.resolve("old A");
  await old;
  expect(visible).toEqual(["B"]);
});
it("newer same-project selection wins when source responses resolve in reverse", async () => {
  const scope = new ProjectScope();
  scope.select("a");
  const pending = deferred<string>();
  let source = "";
  const old = scope.run(
    "source",
    () => pending.promise,
    (v) => {
      source = v;
    },
  );
  await scope.run(
    "source",
    async () => "new",
    (v) => {
      source = v;
    },
  );
  pending.resolve("old");
  await old;
  expect(source).toBe("new");
});
it("queued layout persistence captures project identity and cancels on switch", async () => {
  vi.useFakeTimers();
  const scope = new ProjectScope();
  scope.select("a");
  const writes: string[] = [];
  scope.schedule(
    "view",
    (id) => {
      writes.push(id);
    },
    250,
  );
  scope.select("b");
  await vi.advanceTimersByTimeAsync(300);
  expect(writes).toEqual([]);
  scope.schedule(
    "view",
    (id) => {
      writes.push(id);
    },
    250,
  );
  await vi.advanceTimersByTimeAsync(300);
  expect(writes).toEqual(["b"]);
  vi.useRealTimers();
});
