import childProcess, { type ChildProcess } from "node:child_process";
import { AsyncLocalStorage } from "node:async_hooks";
import { rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";
import { promisify } from "node:util";
import { afterAll } from "vitest";

export const PYTHON_TEARDOWN_HOOK_MS = 90000;
const DRAIN_DEADLINE_MS = 85000;
export type PythonFixtureOwner = {
  readonly name: string;
  readonly environment: string | undefined;
  readonly roots: Set<string>;
  readonly fixtures: Set<Promise<unknown>>;
  readonly children: Set<Promise<void>>;
  phase: "open" | "closing" | "closed" | "failed";
  completion?: Promise<void>;
};
const ownerContext = new AsyncLocalStorage<PythonFixtureOwner>();
const owners = new Set<PythonFixtureOwner>();
let admitted: PythonFixtureOwner | undefined;
let blocked: string | undefined;
let environmentOwner: PythonFixtureOwner | undefined;
function failClosed(reason: string): void {
  blocked ??= reason;
  record({ event: "admission-blocked", reason });
}
export function beginPythonFixtureOwner(name: string): PythonFixtureOwner {
  if (
    blocked ||
    (admitted && admitted.phase !== "closed") ||
    children.size ||
    environmentOwner ||
    probeModel
  )
    throw new Error(
      "Python fixture admission blocked: " +
        (blocked ?? "previous owner still active"),
    );
  const owner: PythonFixtureOwner = {
    name,
    environment: process.env.CODEMAP_PYTHON,
    roots: new Set(),
    fixtures: new Set(),
    children: new Set(),
    phase: "open",
  };
  owners.add(owner);
  admitted = owner;
  record({ event: "owner-admitted", owner: name });
  return owner;
}
export function currentPythonFixtureOwner(): PythonFixtureOwner {
  const owner = ownerContext.getStore() ?? admitted;
  if (!owner || owner.phase === "closed" || owner.phase === "failed")
    throw new Error("No active Python fixture owner");
  return owner;
}
export function registerPythonFixtureRoot(
  owner: PythonFixtureOwner,
  root: string,
): void {
  if (owner.phase === "closed" || owner.phase === "failed")
    throw new Error("Cannot register a root after owner cleanup");
  owner.roots.add(root);
}
async function drainOwner(owner: PythonFixtureOwner): Promise<void> {
  while (owner.fixtures.size) await Promise.allSettled([...owner.fixtures]);
  while (owner.children.size) await Promise.all([...owner.children]);
}
export async function closePythonFixtureOwner(
  owner: PythonFixtureOwner,
  deadlineMs = DRAIN_DEADLINE_MS,
): Promise<void> {
  if (!owner.completion) {
    owner.phase = "closing";
    owner.completion = (async () => {
      await drainOwner(owner);
      const restored =
        process.env.CODEMAP_PYTHON === owner.environment &&
        environmentOwner !== owner;
      // This collection belongs permanently to this owner; no late splice of
      // any later test's roots or mutable suite environment baseline.
      await Promise.all(
        [...owner.roots].map((root) =>
          rm(root, { recursive: true, force: true }),
        ),
      );
      owner.roots.clear();
      if (!restored)
        throw new Error("Python fixture environment was not restored");
      owner.phase = "closed";
      record({
        event: "owner-closed",
        owner: owner.name,
        pendingFixtures: owner.fixtures.size,
        pendingChildren: owner.children.size,
      });
    })().catch((error) => {
      owner.phase = "failed";
      failClosed("owner cleanup failed");
      throw error;
    });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      failClosed("owner drain deadline expired");
      reject(
        new Error(
          "Python fixture drain deadline expired; subsequent test admission is blocked",
        ),
      );
    }, deadlineMs);
  });
  try {
    await Promise.race([owner.completion, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const children = new Map<ChildProcess, Promise<void>>();
const events: unknown[] = [];
let omittedEvents = 0;
let discovered: { command: string; prefix: string[] } | undefined;
let verified: string | undefined;
let probeModel: { attempted: number; startedFile: string } | undefined;

function record(event: unknown) {
  if (events.length < 512) events.push(event);
  else omittedEvents++;
}
function observe(child: ChildProcess, command: unknown, args: unknown) {
  if (!Array.isArray(args)) return;
  const isolated = args.indexOf("-I");
  if (isolated < 0 || isolated > 1) return;
  const phase =
    args[isolated + 1] === "-c"
      ? "probe"
      : typeof args[isolated + 1] === "string" &&
          basename(args[isolated + 1]) === "index.py"
        ? "parse"
        : undefined;
  if (!phase || children.has(child)) return;
  const started = performance.now();
  let settle!: () => void;
  const closed = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const owner = currentPythonFixtureOwner();
  owner.children.add(closed);
  children.set(child, closed);
  record({
    event: "start",
    model: probeModel !== undefined,
    phase,
    executable: typeof command === "string" ? basename(command) : "unknown",
    pid: child.pid,
  });
  child.once("error", (error: NodeJS.ErrnoException) =>
    record({ event: "error", phase, pid: child.pid, code: error.code }),
  );
  child.once("close", (code, signal) => {
    children.delete(child);
    owner.children.delete(closed);
    if (phase === "parse" && code === 0 && typeof command === "string")
      discovered = { command, prefix: args.slice(0, isolated) };
    let aliveAfterClose = false;
    try {
      if (child.pid) {
        process.kill(child.pid, 0);
        aliveAfterClose = true;
      }
    } catch {
      /* Owned PID already exited. */
    }
    record({
      event: "close",
      aliveAfterClose,
      phase,
      pid: child.pid,
      code,
      signal,
      milliseconds: performance.now() - started,
    });
    settle();
  });
}
const originalExec = childProcess.execFile;
const originalSpawn = childProcess.spawn;
const exec = (...args: unknown[]) => {
  const child = Reflect.apply(originalExec, childProcess, args) as ChildProcess;
  observe(child, args[0], args[1]);
  return child;
};
const custom = (
  originalExec as typeof originalExec & {
    [promisify.custom]: (
      ...args: unknown[]
    ) => Promise<unknown> & { child: ChildProcess };
  }
)[promisify.custom];
Object.defineProperty(exec, promisify.custom, {
  value: (...args: unknown[]) => {
    let actual = args;
    // A portable, explicitly labelled discovery model: the first real child
    // exceeds the existing 5s probe deadline; the fallback is a verified Python.
    // The separate readiness capture uses the actual default candidates.
    if (
      probeModel &&
      Array.isArray(args[1]) &&
      args[1].includes("-I") &&
      args[1].includes("-c")
    ) {
      probeModel.attempted++;
      if (probeModel.attempted === 1) {
        actual = [
          process.execPath,
          [
            "-e",
            "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); setTimeout(() => process.exit(1), 6000)",
            probeModel.startedFile,
          ],
          ...args.slice(2),
        ];
      } else {
        if (!verified) throw new Error("Python readiness was not verified");
        actual = [verified, args[1], ...args.slice(2)];
      }
    }
    const pending = Reflect.apply(
      custom,
      childProcess,
      actual,
    ) as Promise<unknown> & { child: ChildProcess };
    observe(pending.child, actual[0], args[1]);
    return pending;
  },
});
childProcess.execFile = exec as typeof originalExec;
childProcess.spawn = ((...args: unknown[]) => {
  const actual =
    probeModel && Array.isArray(args[1]) && args[1].includes("-I")
      ? [verified, args[1], ...args.slice(2)]
      : args;
  const child = Reflect.apply(
    originalSpawn,
    childProcess,
    actual,
  ) as ChildProcess;
  observe(child, actual[0], args[1]);
  return child;
}) as typeof originalSpawn;
syncBuiltinESMExports();

export function pythonFixture<T>(work: () => Promise<T>): Promise<T> {
  const owner = currentPythonFixtureOwner();
  const pending = ownerContext.run(owner, work);
  owner.fixtures.add(pending);
  void pending.then(
    () => owner.fixtures.delete(pending),
    () => owner.fixtures.delete(pending),
  );
  return pending;
}
export async function drainPythonFixtures(): Promise<void> {
  await drainOwner(currentPythonFixtureOwner());
}
export function pythonReadiness(milliseconds: number): void {
  const owner = currentPythonFixtureOwner();
  record({
    event: "readiness",
    milliseconds,
    pendingFixtures: owner.fixtures.size,
    activeOwnedPids: [...children.keys()].map((c) => c.pid),
  });
}
afterAll(async () => {
  // Hook wrapper expiry never authorizes restoration while old work is active.
  // Admission checks the owner synchronously even if a runner hook has expired.
  for (const owner of owners) await closePythonFixtureOwner(owner);
  if (children.size || environmentOwner || probeModel)
    throw new Error("Python fixture shutdown still owns active state");
  childProcess.execFile = originalExec;
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
  if (
    process.platform === "win32" ||
    process.env.CODEMAP_TEST_PYTHON_DIAGNOSTICS === "1"
  )
    console.log(
      JSON.stringify({
        component: "python-fixture",
        node: process.version,
        platform: process.platform,
        events,
        omittedEvents,
        blocked,
        pendingFixtures: [...owners].reduce((n, o) => n + o.fixtures.size, 0),
        activeOwnedPids: [...children.keys()].map((c) => c.pid),
      }),
    );
}, PYTHON_TEARDOWN_HOOK_MS);

export async function verifyDiscoveredPython(): Promise<void> {
  if (!discovered)
    throw new Error("Default discovery did not complete a Python capture");
  const args = [
    discovered.command,
    [
      ...discovered.prefix,
      "-I",
      "-c",
      "import json, sys; print(json.dumps({'executable': sys.executable, 'version': list(sys.version_info[:3])}))",
    ],
    { timeout: 5000 },
  ];
  const pending = Reflect.apply(custom, childProcess, args) as Promise<{
    stdout: string;
  }> & { child: ChildProcess };
  observe(pending.child, args[0], args[1]);
  const identity = JSON.parse((await pending).stdout) as {
    executable: unknown;
    version: unknown;
  };
  if (
    typeof identity.executable !== "string" ||
    !identity.executable ||
    !Array.isArray(identity.version) ||
    identity.version.length !== 3 ||
    !identity.version.every(Number.isInteger) ||
    identity.version[0] < 3 ||
    (identity.version[0] === 3 && identity.version[1] < 10)
  )
    throw new Error("Default discovery did not verify Python 3.10+");
  verified = identity.executable;
  record({
    event: "verified",
    executable: basename(verified),
    version: identity.version,
  });
}
function environmentFixture<T>(
  value: string | undefined,
  work: () => Promise<T>,
): Promise<T> {
  return pythonFixture(async () => {
    const owner = currentPythonFixtureOwner();
    if (environmentOwner)
      throw new Error("Another Python fixture environment override is active");
    environmentOwner = owner;
    const previous = process.env.CODEMAP_PYTHON;
    if (value === undefined) delete process.env.CODEMAP_PYTHON;
    else process.env.CODEMAP_PYTHON = value;
    try {
      return await work();
    } finally {
      if (environmentOwner !== owner) {
        failClosed("environment lease changed owner");
        throw new Error("Python environment lease changed owner");
      }
      if (previous === undefined) delete process.env.CODEMAP_PYTHON;
      else process.env.CODEMAP_PYTHON = previous;
      environmentOwner = undefined;
    }
  });
}
export function verifiedPythonFixture<T>(work: () => Promise<T>): Promise<T> {
  if (!verified) throw new Error("Python readiness was not verified");
  return environmentFixture(verified, work);
}
export function defaultPythonFixture<T>(work: () => Promise<T>): Promise<T> {
  return environmentFixture(undefined, work);
}
export async function modelPythonProbeBarrier<T>(
  startedFile: string,
  work: () => Promise<T>,
): Promise<{ value: T; attempts: number }> {
  if (probeModel) throw new Error("A discovery model is already active");
  probeModel = { attempted: 0, startedFile };
  try {
    const value = await defaultPythonFixture(work);
    return { value, attempts: probeModel.attempted };
  } finally {
    await drainPythonFixtures();
    probeModel = undefined;
  }
}
