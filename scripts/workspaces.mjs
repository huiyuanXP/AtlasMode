import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const order = ["core", "indexer", "storage", "service", "web", "mcp", "server"];
const command = process.argv[2];
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this helper through an npm script.");
function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [npm, ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
if (command === "dev") {
  process.exitCode = await run([
    "exec",
    "--",
    "concurrently",
    "--kill-others",
    "--names",
    "server,web",
    "npm run dev -w @codemap/server",
    "npm run dev -w @codemap/web",
  ]);
} else if (command === "build" || command === "typecheck") {
  // Dependency artifacts are required for public package entry point resolution.
  for (const name of order) {
    const code = await run([
      "run",
      command === "typecheck" ? "build" : command,
      "-w",
      `@codemap/${name}`,
    ]);
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
    if (command === "typecheck") {
      const checked = await run(["run", "typecheck", "-w", `@codemap/${name}`]);
      if (checked !== 0) {
        process.exitCode = checked;
        break;
      }
    }
  }
} else {
  throw new Error(`Unsupported workspace command: ${command}`);
}
