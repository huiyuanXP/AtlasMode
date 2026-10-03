import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Captured CommonJS bytes only: requiring any target code is forbidden.
export async function createForwardingFixture(root) {
  const path = join(root, "forwarding");
  const marker = join(root, "TARGET_EXECUTED");
  // Put the same sentinel on every traversed module, while declarations stay on line 2.
  // These are fixture bytes for capture only; never require or execute them.
  const markerWrite = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "executed");`;
  await mkdir(path);
  const files = {
    "package.json": '{"type":"commonjs"}\n',
    "entry.cjs":
      `${markerWrite} const mod = require("./index.cjs");\nfunction entry() { return mod.helper(); }\nexports.entry = entry;\n`,
    "index.cjs": `${markerWrite} module.exports = require("./barrel.cjs");\n`,
    "barrel.cjs": `${markerWrite} module.exports = require("./leaf-a.cjs");\n`,
    "leaf-a.cjs":
      `${markerWrite} // 作者原文\nfunction helper() { return "中文 leaf A"; }\nexports.helper = helper;\n`,
    "leaf-b.cjs":
      `${markerWrite} // 作者原文\nfunction helperB() { return "中文 leaf B"; }\nexports.helper = helperB;\n`,
    "unsafe-leaf.cjs":
      'function unsafeHelper() { return "unsafe"; }\nexports.helper = unsafeHelper;\n',
    "unsafe.cjs":
      'module.exports = require("./unsafe-leaf.cjs");\nmodule.exports = {};\n',
    "unknown.cjs":
      'const unsafe = require("./unsafe.cjs");\nfunction unsafeCaller() { return unsafe.helper(); }\nexports.unsafeCaller = unsafeCaller;\n',
    "never-execute.cjs": `${markerWrite}\nthrow new Error("Target source must never execute");\n`,
  };
  await Promise.all(
    Object.entries(files).map(([name, bytes]) =>
      writeFile(join(path, name), bytes),
    ),
  );
  return {
    path,
    marker,
    files,
    redirect: () =>
      writeFile(
        join(path, "barrel.cjs"),
        `${markerWrite} module.exports = require("./leaf-b.cjs");\n`,
      ),
    assertNotExecuted: () => assert.rejects(access(marker)),
  };
}

// Keep the actual owned PID before SDK close; a reset transport.pid proves nothing.
export function assertProcessStopped(pid) {
  assert.ok(Number.isInteger(pid) && pid > 0, "Captured owned process PID");
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
}
