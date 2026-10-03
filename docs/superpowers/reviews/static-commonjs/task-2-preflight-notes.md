# Task2 capture integration notes, read before formal dispatch

Prepared by controller while Task1 is sole source owner; observations, no source changes.
Existing configCapture.ts implements its read closure with: normalize eligible paths,
failed/captured caches, component lstat checks, same-location realpath, O_NOFOLLOW,
opened file handle stat, per-file/remaining-total budgets, inode/dev/location recheck,
remaining-budget+one byte allocation/read and post-read budgets; handle closes in finally.

Refactoring must keep those exact obligations, not just final path realpath. Successful
capture bytes may be shared with package capture to avoid double read. Config and package
acceptance/count/total/failure markers are independent: a config budget failure must not
make a package opaque under the package budget, or vice versa. Reused successful bytes
still count fully toward each consuming category budget. Failed partial reads are not
valid capture bytes. The snapshot uses one shared successful byte observation per path.
Existing config inheritance uses independent selected-chain validation,16level convention,
DAG memoization and exact CONFIGURATION_UNAVAILABLE: marker; do not broaden marker scan.

Scanner knows ignored/rejected package paths before reading. Dedicated PACKAGE_MANIFEST_UNAVAILABLE:
marker must carry normalized filePath, not propagate into source availability or source
nodes/count. Strict JSON captured bytes including invalid input remain hash inputs;
rejected bytes are never opened just to diagnose. Core optional packageFiles and old
absent metadata are distinguishable from recorded empty array.

Ordinary .js positive mode needs nearest valid captured root-contained package and no
ESM syntax. Analyzer (not path-only provider) checks source syntax. Include import/export,
import.meta/top-level await as appropriate captured module evidence; nested async await
is not top-level module syntax. .cjs/.mjs explicit format does not claim runtime success.
No workspace package lookup, parent-root metadata, target imports/exports or loader hooks.

Future worker must consume exact approved Task1 contract and commit after its independent
gate, not this note as authority to change mode hook in parallel. Final Task2 context
will bind actual Task1 IDs/signatures, affected checks and test ownership.

Task1approvedinterface mustalso preserve itsfixround1 shared executabledeclarationuniqueness:
CJS localduplicates do notfall through while overloadsignature-onlydeclarations do not
countas multiplebodies. These83registry/253affectedchecks formTask2 regression baseline;
Task2 mustnot replaceguards with mode-onlychecker trust. ActualTask1gate stillpending
until scopedreview; thisnote records implementationevidence, not approval.
