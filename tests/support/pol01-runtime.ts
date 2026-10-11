import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export async function pol01Runtime(root: string) {
  const mode =
    process.env.POL01_ACCEPTANCE_MODE === "compiled" ? "compiled" : "source";
  const checkout = fileURLToPath(new URL("../../", import.meta.url));
  const env = { ...process.env };
  delete env.TSX_TSCONFIG_PATH;
  const loader = mode === "compiled" ? [] : ["--import", "tsx"];
  if (mode === "source") {
    const config = join(root, "runtime-tsconfig.json");
    await writeFile(
      config,
      JSON.stringify({
        extends: resolve(checkout, "tsconfig.base.json"),
        compilerOptions: {
          paths: Object.fromEntries(
            ["core", "service", "storage", "indexer", "mcp"].map((name) => [
              `@codemap/${name}`,
              [
                resolve(
                  checkout,
                  `${name === "mcp" ? "apps" : "packages"}/${name}/src/index.ts`,
                ),
              ],
            ]),
          ),
        },
      }),
    );
    env.TSX_TSCONFIG_PATH = config;
  }
  return {
    mode,
    env,
    crashArgs: [...loader, resolve(checkout, "tests/support/pol01-crash.ts")],
    serverArgs: [
      "--import",
      new URL("./graceful-preload.mjs", import.meta.url).href,
      ...loader,
      resolve(
        checkout,
        `apps/server/${mode === "compiled" ? "dist/index.js" : "src/index.ts"}`,
      ),
    ],
  };
}
export function assertOwnedPidAbsent(pid: number | undefined) {
  if (!pid) throw new Error("owned child PID missing");
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
    throw error;
  }
  throw new Error(`owned child still alive: ${pid}`);
}
