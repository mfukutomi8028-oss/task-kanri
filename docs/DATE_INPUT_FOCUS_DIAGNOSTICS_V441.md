# Ver.441 — date-segment focusout diagnostic regression

Issue #355. Starting point: formally accepted Ver.440 main `78df84a166cfa898a3c30681576ec30ab832bcef` and `backup/ver440-pages-alias-inventory-validated-checkpoint`.

## Observed failure (Ver.436)

The original `tests/foundation-js-behavior-v194.spec.mjs` assertion for impossible date 2026-09-31 failed once on Browser shard 1 and passed on retry in run 38252833221. Playwright logged wrapper `data-dirty="true"`, an empty native source value, and **no** `is-invalid` class after an attempted `taskTitle.focus()` and an eight-second assertion timeout. Subsequent main runs did not reproduce the flaky outcome.

In current `date-segment-controls-v230.js`, a fully typed invalid date calls `commitSegments()` with `pad=false` and clears native input without marking the wrapper invalid. On actual focus exit, `focusout` schedules a `setTimeout(0)` and calls `commitSegments({pad:true})` only if focus is outside the wrapper and `data-dirty=true`; that path sets `is-invalid`. Therefore the log is compatible with missing / ineffective focus exit, a missed deferred commit, or other later UI interference; **the single log does not establish which occurred**.

## Limited change

- Keep the original user-facing date test unchanged.
- Add a separate Playwright diagnostic that repeats valid → impossible → corrected date transitions **20 times in one isolated dialog**, with no backend writes.
- Verify that the day field receives focus before the attempted exit; require an empty native value and visible invalid feedback for impossible dates and a restored valid value + cleared invalid class after correction. Do **not** add permanent title-focus assertions during rapid cycling: CI demonstrated that the focus can return to date segments even after a valid date. Instead record whether title focus persisted in each phase, and tag focus event traces with the current phase. Never replace existing value/class assertions with fixed sleeps or unconditional blur.
- Observe (without changing) focusin/focusout, title focus and wrapper class/dirty transitions. On failure attach a JSON snapshot with active element, whether focus remains inside, native value, field values, dirty/invalid state and the last 60 events, and print a single diagnostic log.
- A 20-cycle success narrows the reproduction rate under the tested CI environment; **it does not prove root cause or justify closing Issue #355**. Keep the issue open until repeat evidence and any production-level defect are resolved.

## Safety boundary

Only the existing Playwright test file and this investigation note change. Do not alter `date-segment-controls-v230.js`, Release304, HTML/CSS, Pages output, the browser matrix workflow, Firebase/Rules/Auth, production storage or legacy URLs.

## Gate

Independent exact-head Protocol, Browser shard 1+2, Firebase and Regression all success, followed by expected-head merge, same-SHA main Regression and Pages success, then a fixed recovery checkpoint. Failure requires diagnosis and a new tested head before any merge.

## Initial independent CI finding and correction

Initial head `c3886175cd7d75b60c87ce4e063cbe42b758678b`, Actions run 38327796256, Browser shard 1 **failed** on a newly added `expect(taskTitle).toBeFocused()` assertion while the date was invalid (iteration 3, retry iteration 1). JSON diagnostics confirmed the active element had returned to the day segment and the wrapper already had `is-invalid`; native date stayed blank and dirty was true. The code's native `invalid` listener explicitly refocuses date fields. This is an invalid extra requirement introduced by the diagnostic test, **not proof that the original missing-`is-invalid` flaky has reproduced**.

Corrected head removes only that overstrong focus-retention assertion for invalid dates while preserving the actual empty-date + invalid-class contract and verifying title focus after valid correction. Full independent exact-head CI must be rerun; do not accept the failed head.

## Second independent CI finding: valid-date focus retention is also not invariant

Corrected head `df876a8404513a044fa11ea666fd0e70460fcbf7`, Actions run 38328358336, also failed Browser shard 1 on the additional `taskTitle.toBeFocused()` after a **valid** correction (iteration 6; retry iteration 2). Snapshot: native date `2026-09-30`, wrapper `data-dirty=false`, `is-invalid` absent, active field the day segment. This does not show lost data or a failure of the original invalid-date class assertion, but it exposes a separate programmatic-focus-retention question under unusually fast repeated edits. Its possible connection to the original flaky is unproven.

The next candidate retains the original date values + error-class contract across 20 cycles and records whether title focus persisted after invalid/valid attempts as diagnostic **metrics, not new pass/fail requirements**. Event entries now include the current phase; the original single-cycle test remains unchanged. The failed heads are never eligible for merge.
