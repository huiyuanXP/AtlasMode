// Read-only complete fixed-target safety audit; never import target code.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { SourceIndexer } from "../../packages/indexer/dist/index.js";
import { repositoryProvenance } from "../../scripts/repository-provenance.mjs";
const target = "/tmp/atlasmode-idx01-express";
const revision = "dbac741a49a5a64336b70c06e85c2e2706e36336";
const out = resolve("docs/superpowers/reviews/idx01-2026-10-10");
const before = repositoryProvenance(target, revision);
const snapshot = await new SourceIndexer().index(target, "idx01-audit");
assert.ok(snapshot.coverage.files.includes("test/exports.js"));
const root = snapshot.nodes.find(
  (n) => n.name === "createApplication" && n.filePath === "lib/express.js",
);
assert.equal(root.exported, true);
const calls = snapshot.relations.filter((r) => r.type === "calls");
const incoming = calls.filter((r) => r.targetId === root.id);
assert.equal(incoming.length, 16);
const sourceEvidence = [];
for (const edge of incoming) {
  assert.equal(edge.evidence.text, "express()");
  const content = await readFile(join(target, edge.evidence.filePath), "utf8");
  const lines = content.split(/\r?\n/);
  assert.ok(lines[edge.evidence.line - 1].includes(edge.evidence.text));
  const binding = lines.find(
    (l) => l.trim() === "const express = require('../.');",
  );
  assert.ok(
    binding,
    "Every accepted incoming call is a stable direct require of the real root",
  );
  sourceEvidence.push({
    edge,
    binding,
    line: lines[edge.evidence.line - 1],
    sourceSha256: createHash("sha256").update(content).digest("hex"),
  });
}
const outgoing = calls.filter((r) => r.sourceId === root.id);
assert.equal(outgoing.length, 5);
assert.ok(
  outgoing.every((r) => r.resolution === "unresolved" && r.targetId === null),
);
const mutatedCalls = calls.filter(
  (r) =>
    r.evidence.filePath === "test/exports.js" &&
    /\.foo\(/.test(r.evidence.text),
);
assert.ok(mutatedCalls.length >= 3);
assert.ok(
  mutatedCalls.every((r) => r.resolution !== "resolved" && r.targetId === null),
);
const leafExports = snapshot.nodes.filter(
  (n) => n.kind === "function" && n.filePath === "lib/express.js" && n.exported,
);
assert.deepEqual(
  leafExports.map((n) => n.name),
  ["createApplication"],
);
const sources = {};
for (const path of [
  "index.js",
  "lib/express.js",
  "test/exports.js",
  "test/res.status.js",
]) {
  const content = await readFile(join(target, path), "utf8");
  sources[path] = {
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}
const evidence = {
  status: "passed",
  observedAt: new Date().toISOString(),
  provenance: { before, after: repositoryProvenance(target, revision) },
  coverage: snapshot.coverage,
  root,
  incomingEvidence: sourceEvidence,
  outgoing,
  mutatedCalls,
  leafExports,
  sources,
  scope:
    "Complete pinned captured target; accepted root edges match const direct require and exact source lines. Mutated foo calls remain unknown; no runtime/mixin/whole-program soundness claim.",
};
await writeFile(
  join(out, "express-safety-audit.json"),
  JSON.stringify(evidence, null, 2),
);
console.log(
  JSON.stringify({
    status: evidence.status,
    files: snapshot.coverage.files.length,
    incoming: incoming.length,
    outgoingUnknown: outgoing.length,
    mutatedUnknown: mutatedCalls.length,
    leafExports: leafExports.map((n) => n.name),
  }),
);
