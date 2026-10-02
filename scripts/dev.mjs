import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = new Set();
let stopping = false;
let timer;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  if (children.size)
    timer = setTimeout(() => {
      for (const child of children) child.kill("SIGKILL");
    }, 5000);
}
function launch(args, cwd = root) {
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit" });
  children.add(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  const completion = new Promise((resolve) =>
    child.once("close", (code) => {
      children.delete(child);
      if (stopping && !children.size) clearTimeout(timer);
      resolve(code ?? 1);
    }),
  );
  return { child, completion };
}
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
try {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run the development supervisor with npm run dev.");
  for (const name of ["core", "indexer", "storage", "service", "server"]) {
    if (stopping) break;
    const { completion } = launch([
      npm,
      "run",
      "build",
      "-w",
      `@codemap/${name}`,
    ]);
    const code = await completion;
    if (code !== 0) {
      stop(code);
      break;
    }
  }
  if (!stopping) {
    const require = createRequire(join(root, "apps/web/package.json"));
    const vite = join(
      dirname(require.resolve("vite/package.json")),
      "bin",
      "vite.js",
    );
    const server = launch([
      "--import",
      "tsx",
      join(root, "apps/server/src/index.ts"),
    ]);
    const web = launch(
      [vite, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
      join(root, "apps/web"),
    );
    for (const { completion } of [server, web])
      void completion.then((code) => {
        if (!stopping) stop(code === 0 ? 1 : code);
      });
    await Promise.all([server.completion, web.completion]);
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
