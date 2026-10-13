# Ver.443 — Native invalid events versus segmented date focus returns

Issue #355. Draft follow-up **dependent on Ver.442** candidate head `4a79bb9468233796e32aaabe22a75dda7f1bb56c`; do not merge this candidate until Ver.442 is formally accepted, including its post-merge Regression/Pages and checkpoint.

## Verified input

Ver.442 independent Browser shard 1 succeeded. In its twenty-cycle diagnostic, title focus returned to the date **day** segment after impossible-date entry in 10/20 cycles and after valid correction in 3/20 cycles. All original date-value / error-class assertions passed. This is a target identification, not a demonstrated cause of the original missing-error-class flaky.

The controller's native source `invalid` listener adds `is-invalid` and refocuses the first empty date segment. A correlation between source `invalid` and focus returns is plausible, but not established by target counts alone.

## Change: observe, do not intervene

- Extend only the existing 20-cycle Playwright diagnostic to register a document capture listener for the **actual native date source** `invalid` event (non-bubbling). Do not preventDefault, trigger validation, or change application code.
- For each invalid and corrected-date phase, record count of source `invalid` events and the active target / dirty / class state at those events.
- Emit phase totals and counts of focus returning to the date wrapper **without** a recorded native invalid event, next to the existing focus-target distribution.
- Preserve every assertion for valid value, empty source on impossible date, `is-invalid` feedback, and clearing after correction, plus the failure JSON artifact; append native invalid-event telemetry to the artifact.
- A source `invalid` event might occur after a snapshot; those counts should be interpreted as best-effort observations, **not** proof of causality or a reason to weaken assertions.

## Scope and acceptance

No changes to native controller `date-segment-controls-v230.js`, production HTML/JS/CSS, Release304, workflows, Pages, published assets/PNG, Firebase/Rules/auth, or stored data. No sleeps, retry increases, focus hacks, or new product contracts.

Dependency and merge gates: Ver.442 complete exact-head CI → expected-head merge → same-SHA main Regression/Pages success → checkpoint; then Ver.443 independent exact-head Protocol / Browser both shards / Firebase / Regression success → expected-head main merge → same-SHA Regression/Pages success → checkpoint. Keep Issue #355 open until the original missing-error-class symptom is causally explained.
