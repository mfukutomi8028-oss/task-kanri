# Ver.442 — Targeted date focus telemetry (diagnosis only)

Issue #355. Based on formally accepted Ver.441 main `108de11444f1b908466f23bef00b238298b54027`, with same-SHA Protocol/Browser/Firebase/Regression and Pages success and backup checkpoint.

## Verified observation

The Ver.441 merged-main Browser shard1 reported 20 successful date transitions, but after a programmatic focus call the title was not the active element in 12/20 cycles for both invalid and corrected date phases. Native date value and invalid-error class assertions passed. These **do not identify the cause** of the earlier, different missing-error-class symptom. Rapid Playwright interactions are not evidence of user-visible failure.

## Narrow scope

In the existing Ver.441 20-cycle diagnostic only, capture a compact snapshot of the actual active target and whether it resides inside the date wrapper immediately after requesting title focus. Report sorted target distributions and date-wrapper counts alongside the existing counters. Preserve every existing value, error-class and test lifecycle assertion. Preserve the error-time full diagnostic payload.

No app/runtime files, release-manifest/Release304, test workflow configuration, Firebase/Rules, Pages packaging or published assets change. There is no sleep, retry increase, assertion relaxation, or product fix.

## Interpretation and acceptance

A high count of focus returning to a date segment may suggest a native validation/focus event path, but does not prove that mechanism without event order/real user confirmation. Keep Issue #355 open. Require independent exact-head Protocol, both Browser shards, Firebase, final Regression, then expected-head merge and main same-SHA Regression/Pages success, plus a dedicated recovery checkpoint. No merge while any gate fails.
