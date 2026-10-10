# IDX03 clean integration E2E selector repair

Main-owned clean candidate: /tmp/atlas-idx03-clean-20261010-wn3h_oyv/workspace. This later integration phase is separate from the original source-freeze40/compiled79 delegated gate; neither frozen receipt was rewritten.

Original full clean pipeline installed with npm ci and passed build/typecheck/lint/882 tests(78 files)/smoke, then E2E exited1: 14 expected PASS / 5 unexpected FAIL of19, 104.895s command wall time (Playwright JSON104270.989ms). Main-owned integration logs retain these gate outcomes. Early 16/3 estimates were intermediate observations and are not final results.

All five failures were actual strict-mode selector ambiguity: two captured/legacy CommonJS cases at commonjs.spec.ts:96, zero-manifest case at :254, two captured/legacy tsconfig cases at tsconfig.spec.ts:103. diagnostics.locator("summary") matched six descendants: diagnostic summary, new configuration project graph summary, roots/projects/references/scopes summaries. Error-context, screenshot and trace independently show this action failure. The product was rendering nested diagnostics correctly; tests assumed no nested details.

Authorized change ONLY tests/e2e/commonjs.spec.ts and tests/e2e/tsconfig.spec.ts:
- identify the diagnostics container via its direct-child summary with exact existing bilingual labels;
- click :scope > summary;
- keep the existing English Indexed files count assertion, selecting that stable diagnostics container instead of .navigation details.last(), which now names a graph sample child.
No coverage/source/SDK/language/unknown/sentinel assertions were removed or weakened. No timeout, product, diagnostic rendering, helper or browser settings changed. Formatting affected only the two spec files.

Before any rerun, full-first-fail/ copied complete original artifacts/e2e (JSON and59 artifact files including all five contexts/PNGs/traces and earlier successful generated images) plus original integration/e2e.log/results.json/source receipts. before.json records original SHA values; after.json confirms they remain unchanged.

Frozen revised test bytes:
- tests/e2e/commonjs.spec.ts SHA256 209881d280c7e4557f31a6c22bdc3b65ee511e8c9e8e0249dd453ce6f29508e4
- tests/e2e/tsconfig.spec.ts SHA256 bf48e82bad323c869a868b7a0b8034a595c94398d77c3dac70b0dd01dfc78c99

The same clean candidate ran only:
```sh
npx eslint tests/e2e/commonjs.spec.ts tests/e2e/tsconfig.spec.ts
npx playwright test tests/e2e/commonjs.spec.ts tests/e2e/tsconfig.spec.ts
```
Scoped lint exit0 (lint.log); targeted browser result5 PASS /0 FAIL /0 flaky,20.8s (targeted-five.log, targeted-five-artifacts/results.json). All original assertions reached completion in those five cases. We did not rerun the other14 E2E cases, root882 tests, build or typecheck.

after.json proves 122 original product source inputs unchanged and146 compiled files unchanged; only the two explicit E2E test hashes changed, and they match patched-tests-freeze.json. Product-source manifest excludes E2E tests; an initial receipt checker incorrectly expected test paths inside that manifest and raised AssertionError:[] after successful browser execution. receipt-first-check-fail.log retains that bookkeeping failure; final receipt compares product inputs and beforeTestHashes separately. It did not trigger another Playwright run or modify gate results.

selector-only.patch is the precise commit patch (no stage/commit by delegated agent). revised-source/ stores both frozen revised spec bytes. Main must preserve original full19 run14/5 FAIL alongside targeted5/5 PASS when integrating. This report makes no claim that the full19 suite was rerun green.
