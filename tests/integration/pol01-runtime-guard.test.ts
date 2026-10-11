import { expect, test } from "vitest";
import { spawn } from "node:child_process";
import {
  killAtDurableBoundary,
  assertOwnedPidAbsent,
} from "../support/pol01-runtime.js";

// Removing the witness guard must not let early exit masquerade as a durable crash.
test.each([0, 1])(
  "early exit %s cannot satisfy owned durable hard kill",
  async (code) => {
    const child = spawn(process.execPath, ["-e", `process.exit(${code})`], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    await expect(killAtDurableBoundary(child)).rejects.toThrow(
      "exit without owned durable hard kill",
    );
    assertOwnedPidAbsent(child.pid);
  },
);
test("a forged PID cannot satisfy owned durable hard kill", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      'setInterval(()=>{},1000);process.send({pid:-1,boundary:"durable-intent/publish-hook",hardKill:"SIGKILL"})',
    ],
    { stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  await expect(killAtDurableBoundary(child)).rejects.toThrow(
    "invalid owned durable boundary receipt",
  );
  assertOwnedPidAbsent(child.pid);
});
test("parent owned kill retains strict signal termination after witnessed boundary", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      'setInterval(()=>{},1000);process.send({pid:process.pid,boundary:"durable-intent/publish-hook",hardKill:"SIGKILL"})',
    ],
    { stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  expect(await killAtDurableBoundary(child)).toEqual([null, "SIGKILL"]);
  assertOwnedPidAbsent(child.pid);
});
