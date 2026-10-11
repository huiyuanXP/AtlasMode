# Task3 independent review R1 — REQUEST_CHANGES C0/I2/M1

Reviewer /root/task3_review, gpt-6.1-sol high, isolated fork, read-only VM.
Freeze source b0a72c07cc66b465c6ad61f09a4c58c98c213cbe67c0e641868fc922dd7fa566; test5cb4e373e7c37dcc277d1ce259a2604bf35d18c63a541746b6e63700677a176b.

I1 overview-visual.ts:658: all missing measurements default300x220, but group contract360x(220+60*ports). Threeport collapsed header+fact, measurements empty: ready header0,0 / fact0,316; required headerheight400 => overlap84 before gap. Existing noCollision test101 also code-only default; group fixture408 explicitly measured, missed fallback. Fix type/port fallback and regression.

I2 overview-visual.ts:103/107: raw graph301/relations901 written into visual nodesLowerBound/edgesLowerBound. Planfilter emptyops emits0, raw901nulltargetroutes emits0, so claimed301/901 false. Keep exact source counts, unscanned emitted lowerbounds0. Fix early-gate regressions.

M1 overview-visual.ts:321/325: groupa:b memberc and groupa memberb:c yield same group-member:a:b:c alias; preflightready/nodes4. Laterlayout646 rejects visual_identity so no partialready, but should reject earlier invalid_input in bounded visual-ID scan preserving identity format.

Strengths: bounded preflight two op/relation passes; nested loops accounted; group union route/membership copy allocation; pin sourceKey/firstalias stable; prior validated before live reset and real visits before dedup; manualpairs finalonly; final validation uses samebudget; data.node.id rank lookup/groupblocks preserve semantics.

Named focused dependency checks: graph/projection69/81/113/147/183, function-target26/31, groups/projection26/33/48/79/125/152, overview-layout10/26. Raw119PASS/5files + ownedtype/lint emptylogs/exit0 manifests read, no suite rerun. TrueRED34FAIL preserved; green-task3-2 61/63 intermediateFAIL preserved. Final logs no actualwarning (ANSI/slow timing notwarning).

Independent Node one-shot probe: node --experimental-transform-types --disable-warning=ExperimentalWarning --input-type=module against frozen snapshots, I1/I2/M1 scenarios, exit0; no file/Git writes.

Task4/5 session/actualDOM/applysave/compiledworker/browser/realmediumperformance unverified out-of-scope, notTask3 blockers. Assessment Needs fixes: I1 can markoverlapready, I2 violatestruthfulrejection. No approval/commit/push.
