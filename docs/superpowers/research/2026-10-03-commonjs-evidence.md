# CommonJS checker research — not a product fix or acceptance result

2026-10-03T02:34Z. Ephemeral pure in-memory TypeScript AST probe using installed
TypeScript5.9.3/ts-morph27.0.2 and the baseline NodeNext/allowJs/checkJs/noLib options.
Fixtures are authored strings, never executed. Product source, HEAD and builds unchanged.
Evidence /tmp/atlasmode-commonjs-checker-probe.{cjs,jsonl}.

- Stable `function help; exports.help=help` and `module.exports={help}` give a checker
  FunctionDeclaration from helper.cjs for imported namespace/destructured helper calls.
- `exports.help=help; exports.help=()=>2` still gives the ORIGINAL help declaration.
- `function entry(require){const mod=require('./helper.cjs');mod.help()}` still gives
  the helper declaration even though require's symbol is a local Parameter.
- Inline `exports.help=function help(){}` exposes PropertyAccessExpression rather than
  function declaration; blindly supporting it requires an explicit immutable export map.
- Source-file symbol export enumeration was empty in this probe; entry extraction cannot
  assume getSymbolAtLocation(SourceFile).exports supplies CommonJS exposure candidates.

Concrete future acceptance: actual SourceIndexer/HTTP negative controls must remain
unresolved for overwritten export, shadowed require/exports/module, importer variable
reassignment/member writes and ambiguous/dynamic targets. Never grade checker identity
alone as runtime value proof for CommonJS. Add explicit module import evidence and
exposed functions only for a deliberately small unshadowed stable static subset.

Do not broaden active captured-tsconfig Task2. Validate product-level baseline once,
then write separate brainstorming/spec/plan and sequential reviewed implementation.
These probes are compiler observations, not yet an actual product finding/gate.

## Actual product confirmation (2026-10-03T02:35:56Z)

Ran `/tmp/atlasmode-commonjs-product-probe.mjs` against existing built SourceIndexer;
3 real temporary `.cjs` fixture pairs (stable, overwritten, shadowed) were scanned and
indexed, never executed, then removed in finally. Product checkout/build/HEAD unchanged.
Report `/tmp/atlasmode-commonjs-product-probe.json`: HEAD27702f71cd7b152e5df5b497591fd8df8868c112;
Node24.19.0; compiled TypeScript extraction hash before=after
c734223d89d18ff5144574a9568ef772fff7cda7e7f3f0320423c1d16595c309.

Both negative cases incorrectly resolve mod.help() to helper.cjs:1 `help`, same target
as the stable control. Stable helper has exported:false despite explicit exports.help,
so CommonJS entry discovery is also absent. These are demonstrated pre-existing
product gaps, not merely compiler hypotheses. Current Task2 worker notified not to
broaden task; controller prioritizes separate CJS safety/entry plan before workspace
mapping after captured-tsconfig gates. No whole-suite/browser rerun needed for discovery.

## Mature Node target prepared, not yet product-validated

Read remote stable Express5 tags through existing Git proxy; selected5.2.1 and cloned
unmodified shallow tag to /tmp/atlasmode-validation-express. Exact commit
 dbac741a49a5a64336b70c06e85c2e2706e36336; clean including untracked. Receipt
/tmp/atlasmode-express-target-provenance.json. No target dependency install/script/runtime.

Actual lib/express.js:27 exports = module.exports = createApplication is canonical initial
chain assignment. lib/application.js:40 var app = exports = module.exports = {} shows
stable root alias with mutable properties and indirect entry methods. Future supported
subset should explicitly decide these patterns; do not pretend const-only imports cover
legacy var-heavy Express. Dynamic mixin/Router/dependency factories remain unresolved.
Source functions and exposure are useful independently of complete dynamic app semantics.

## Additional bounded pure-AST observations

/tmp/atlasmode-commonjs-module-symbol-probe.{cjs,jsonl}: checker.getSymbolAtLocation
(require string literal) gives a captured helper SourceFile even for the shadowed case.
This public checker API can supply identity/evidence ONLY AFTER lexical/export guards;
module literal identity itself does not fix the false positive.

/tmp/atlasmode-commonjs-extensions-probe.{cjs,jsonl}: built-in special require binding
occurs for js/cjs/jsx/mjs; ts/cts/mts return no module symbol/call declaration. Importantly,
.mjs cannot assume Node require global; .js/.jsx depend on nearest package.json type.
Current config captures do not generally include package.json, so positive generic JS
CommonJS support needs bounded captured package-scope metadata +input freshness, or
must remain explicitly restricted. Do not silently feed real-disk package.json to host.
Future spec must choose truthful package-scope handling; .cjs explicit extension remains
CommonJS regardless package type. packageJSON-only type edit must stale input/plan/routes.

Controller follow-up note: package-scope truth is required for positive .js CJS support. Current Task3 remains configonly; next formalplan must avoid a checker-derived require target from .mjs/type:module, reject opaque nearestpackage instead of ancestor fallback, and include package-only type freshness. Do not let this futuremetadata design silently change current configcoverage contract.
