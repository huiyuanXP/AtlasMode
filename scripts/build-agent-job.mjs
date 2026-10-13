// Standalone explicit build. Never imported by npm lifecycle/server build/dev.
import { createHash } from "node:crypto";
import { lstat, readFile, mkdir, mkdtemp, writeFile, rename, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HELPER_SOURCES = [
  "apps/server/native/agent-job/main.cpp", "apps/server/native/agent-job/job.cpp", "apps/server/native/agent-job/job.h",
  "apps/server/native/agent-job/protocol.cpp", "apps/server/native/agent-job/protocol.h",
  "apps/server/src/agent/windows-job-protocol.ts", "scripts/build-agent-job.mjs",
].sort();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function sourceDigest(directory, files = HELPER_SOURCES) {
  const items = [];
  for (const relative of [...files].sort()) {
    if (!/^[A-Za-z0-9_./-]+$/u.test(relative) || relative.split("/").some((item) => item === ".." || item === "." || !item) || path.isAbsolute(relative)) throw new Error("Invalid source relative path");
    const source = path.join(directory, relative); if (!(await lstat(source)).isFile() || (await lstat(source)).isSymbolicLink()) throw new Error("Source must be an actual file");
    items.push([relative, sha(await readFile(source))]);
  }
  return sha(JSON.stringify(items));
}
function command(exe, args, cwd) {
  const result = spawnSync(exe, args, { cwd, encoding: "utf8", shell: false, windowsHide: true, timeout: 60000, env: { ...process.env, VSLANG: "1033" }, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Native command failed: ${path.basename(exe)} (${result.status ?? "spawn"})\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}
export async function buildAgentJob(options = {}) {
  const platform = options.platform ?? process.platform; const arch = options.arch ?? process.arch;
  if (platform !== "win32" || arch !== "x64" || process.platform !== "win32" || process.arch !== "x64") throw new Error("Native build requires real Windows x64; no skip or portable fallback");
  const sdk = (process.env.WindowsSDKVersion ?? "").replace(/[\\/]+$/u, ""); const compilerVersion = process.env.VCToolsVersion ?? "";
  if (process.env.VSCMD_ARG_TGT_ARCH !== "x64" || !/^\d+(?:\.\d+){2,3}$/u.test(sdk) || !/^\d+(?:\.\d+){2,3}$/u.test(compilerVersion)) throw new Error("Activate installed VsDevCmd.bat -arch=x64 -host_arch=x64 first (use installed vswhere.exe); no toolchain is installed by this script");
  const compilerPackage = `MSVC tools ${compilerVersion}`;
  const located = command("where.exe", ["cl.exe"], root).trim().split(/\r?\n/u)[0];
  if (!located || !path.isAbsolute(located) || path.extname(located).toLowerCase() !== ".exe" || !(await lstat(located)).isFile()) throw new Error("Actual MSVC cl.exe required");
  const before = await sourceDigest(root); const output = path.join(root, "apps/server/native/bin/win32-x64");
  await mkdir(output, { recursive: true }); const work = await mkdtemp(path.join(os.tmpdir(), "atlas-agent-job-build-"));
  const flags = ["/nologo", "/Bv", "/std:c++20", "/EHsc", "/MT", "/W4", "/WX", "/Brepro", "/utf-8", "/DUNICODE", "/D_UNICODE", "/DWIN32_LEAN_AND_MEAN", "/DNOMINMAX", "/D_WIN32_WINNT=0x0A00", "/DWINVER=0x0A00"];
  const source = (name) => path.join(root, "apps/server/native/agent-job", name);
  try {
    const exe = path.join(work, "atlas-agent-job.exe");
    const log = command(located, [...flags, source("main.cpp"), source("job.cpp"), source("protocol.cpp"), `/Fe:${exe}`], work);
    if (await sourceDigest(root) !== before) throw new Error("Native sources changed while compiling");
    const actualCompiler = log.match(/cl\.exe[^\r\n]*Version\s+([0-9.]+)/iu)?.[1];
    if (!actualCompiler) throw new Error("MSVC /Bv did not report actual compiler version");
    const compiler = `${compilerPackage}; cl ${actualCompiler}`;
    const bytes = await readFile(exe); const manifest = { protocol: 1, platform: "win32", arch: "x64", sourceDigest: before, binarySha256: sha(bytes), compiler, sdk };
    // A stale pair is unavailable at runtime; no half-written bytes are published.
    await writeFile(path.join(output, "atlas-agent-job.exe.next"), bytes);
    await writeFile(path.join(output, "manifest.json.next"), JSON.stringify(manifest, null, 2) + "\n");
    await rename(path.join(output, "atlas-agent-job.exe.next"), path.join(output, "atlas-agent-job.exe"));
    await rename(path.join(output, "manifest.json.next"), path.join(output, "manifest.json"));
    if (options.tests) {
      command(located, [...flags, source("protocol.cpp"), source("tests/protocol-tests.cpp"), `/Fe:${path.join(work, "protocol-tests.exe")}`], work);
      command(path.join(work, "protocol-tests.exe"), [], work);
      command(located, [...flags, source("job.cpp"), source("protocol.cpp"), source("tests/job-fixture.cpp"), `/Fe:${path.join(work, "job-fixture.exe")}`], work);
      command(located, [...flags, source("job.cpp"), source("protocol.cpp"), source("tests/job-harness.cpp"), `/Fe:${path.join(work, "job-harness.exe")}`], work);
      const receipt = command(path.join(work, "job-harness.exe"), [path.join(work, "job-fixture.exe"), path.join(output, "atlas-agent-job.exe")], work);
      await writeFile(path.join(output, "native-test.log"), receipt);
    }
    await writeFile(path.join(output, "build.log"), log);
    return manifest;
  } finally { await rm(work, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== "--tests") || process.argv.filter((arg) => arg === "--tests").length > 1) { console.error("Usage: node scripts/build-agent-job.mjs [--tests]"); process.exitCode = 2; }
  else buildAgentJob({ tests: process.argv.includes("--tests") }).then((manifest) => console.log(JSON.stringify(manifest))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
