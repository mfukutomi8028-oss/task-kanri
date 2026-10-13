# Ver.441 — date-segment focusout diagnostic regression

Issue #355. Starting point: formally accepted Ver.440 main `78df84a166cfa898a3c30681576ec30ab832bcef` and `backup/ver440-pages-alias-inventory-validated-checkpoint`.

## Observed failure (Ver.436)

The original `tests/foundation-js-behavior-v194.spec.mjs` assertion for impossible date 2026-09-31 failed once on Browser shard 1 and passed on retry in run 38252833221. Playwright logged wrapper `data-dirty="true"`, an empty native source value, and **no** `is-invalid` class after an attempted `taskTitle.focus()` and an eight-second assertion timeout. Subsequent main runs did not reproduce the flaky outcome.

In current `date-segment-controls-v230.js`, a fully typed invalid date calls `commitSegments()` with `pad=false` and clears native input without marking the wrapper invalid. On actual focus exit, `focusout` schedules a `setTimeout(0)` and calls `commitSegments({pad:true})` only if focus is outside the wrapper and `data-dirty=true`; that path sets `is-invalid`. Therefore the log is compatible with missing / ineffective focus exit, a missed deferred commit, or other later UI interference; **the single log does not establish which occurred**.

## Limited change

- Keep the original user-facing date test unchanged.
- Add a separate Playwright diagnostic that repeats valid → impossible → corrected date transitions **20 times in one isolated dialog**, with no backend writes.
- Verify that the day field actually received focus and that the title actually received focus when a blur/commit is expected. Continue to require blank native value and visible invalid feedback for impossible dates; never replace assertions with fixed sleeps or an unconditional programmatic blur.
- Observe (without changing) focusin/focusout, title focus and wrapper class/dirty transitions. On failure attach a JSON snapshot with active element, whether focus remains inside, native value, field values, dirty/invalid state and the last 60 events, and print a single diagnostic log.
- A 20-cycle success narrows the reproduction rate under the tested CI environment; **it does not prove root cause or justify closing Issue #355**. Keep the issue open until repeat evidence and any production-level defect are resolved.

## Safety boundary

Only the existing Playwright test file and this investigation note change. Do not alter `date-segment-controls-v230.js`, Release304, HTML/CSS, Pages output, the browser matrix workflow, Firebase/Rules/Auth, production storage or legacy URLs.

## Gate

Independent exact-head Protocol, Browser shard 1+2, Firebase and Regression all success, followed by expected-head merge, same-SHA main Regression and Pages success, then a fixed recovery checkpoint. Failure requires diagnosis and a new tested head before any merge.
