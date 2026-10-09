# Ver.371 main CI recovery: isolate the existing date-boundary audit

Date: 2026-10-09. Test-only follow-up; this is not a formal completion checkpoint.

## Verified baseline and failure

- PR #277 passed Protocol / release-contract, Browser Regression, and Firebase Emulator at exact head `b3823d9532967b47d443366a0feaa729b01c5820` (run `37870596424`).
- Exact-head merge produced main `f9bdfd1e693592d97af5e6727f50f6efdc1b1dfc`, tree `84e0e93c23c4f924c285d2f0f8c4c9b9e2a15333`.
- Main Regression `37871836732`, job `113631474342`, failed in the existing Ver.316 one-shot date-boundary browser audit. Protocol passed; the separate Firebase Emulator step was skipped following the browser failure.
- The browser result was 394 passed, 55 skipped, 1 failed. All eight new Ver.371 inbox tests passed. The skipped browser cases are not a successful Emulator run.
- At the strict `applyCalls === isolatedApplyCount` assertion, the first attempt observed 15 instead of 14; retry observed 16 instead of 15.
- Failure artifact: `11589949574`, `regression-report-37871836732`; SHA-256 `87c82604246748e74fa2b32841d694e8555b6f3e5f634ab3eddf1764952ac87e` verified after download. Both traces show separate suppression, baseline-read, date-change, and assertion calls.
- Release / baseline remain 298 / 298. Last formal checkpoint remains `backup/ver370-checkpoint` until the complete post-merge gates are green.
- Recovery branch: `test/ver371-clock-audit-frame-isolation`.
- Restore branch: `backup/ver371-before-clock-audit-recovery` at the above main SHA.

## Diagnosis and minimal correction

The audit injects `suppressCoreReconcile` at the start of the product MutationObserver callback. This prevents new reconciliation frames, but does not cancel a requestAnimationFrame callback that the observer already queued. The old test enabled suppression and immediately took a counter baseline, then changed its synthetic date. A prequeued frame could still run between those operations and increment the counter once.

This scheduling mechanism was reproduced deterministically using the actual browser audit route transformation and the actual product `observeCoreDom()` / date-boundary functions in a Node VM. The CI trace has no per-apply call stack, so the reproduction establishes the isolation defect without claiming that every possible source of future browser failures is excluded.

The browser test now enables suppression and awaits the next animation-frame boundary before clearing audit counters and returning its baseline in the same browser evaluation. Any previously queued owned frame completes while the original synthetic date is still in effect. Only then does the test advance its date.

No assertion was removed, weakened, skipped, or given a numeric tolerance. The test still requires incidental core callbacks, exactly unchanged apply count before the clock fires, a hidden future-task card before the boundary, visible card after the boundary, exactly one midnight fire, and rearming of the one-shot timer. No fixed-duration sleep or retry count was added.

## Additional regression proof

`test-harness/work-features-long-lived-v316.test.mjs` now includes two deterministic tests:

1. The old observer-only gate demonstrably permits one prequeued frame to cross the synthetic-date boundary without a midnight fire.
2. The actual corrected browser isolation callback passes with and without a prequeued frame, keeps the pre-boundary apply count fixed, and allows exactly the manual one-shot clock to advance the state and rearm.

The Node fixture controls scheduling and substitutes DOM effects; it is not a full-app browser or Firebase test. The existing real browser assertions remain authoritative for the rendered task.

## Validation and preservation

- Local Protocol / release-contract: 482 / 482 passed.
- Changed browser spec and Node test syntax: passed.
- GitHub blob SHAs matched locally checked files before tree creation.
- Product JavaScript, CSS, release-manifest.js, patch-responsibilities.json, Firebase paths/rules/transactions, CI workflows, and business data are unchanged.
- Full Browser Regression and Firebase Emulator must pass in the recovery PR, followed by exact-head merge and fresh main Regression / Pages verification. Local checks are not a substitute.

The separately prepared Ver.372 inbox keyboard/focus candidate is held out of this recovery. Do not merge another runtime change while the Ver.371 post-merge gate is unresolved. After recovery, complete the Ver.371 checkpoint first, then resume that user-facing improvement.
