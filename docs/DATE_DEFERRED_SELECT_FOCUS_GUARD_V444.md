# Ver.444 — Guard deferred date-segment selection against stale focus (Issue #355)

Starting point: Ver.443 formally accepted main `9784138b7236b964ead10d0deba719f780fa6e25`, successful same-SHA Regression/Pages and `backup/ver443-date-native-invalid-event-diagnostics-validated-checkpoint`.

## Evidence and hypothesis

Ver.443 exact-head Browser shard 1 run `38333480313` passed the original invalid-date feedback contract for all 20 cycles but recorded focus returning inside the day segment in 4/20 impossible-date and 9/20 corrected-date phases, with zero captured native source `invalid` events. These observations refute an explanation *solely* relying on captured native invalid events, but do not prove why the historical missing-`is-invalid` failure occurred.

The current `date-segment-controls-v230.js` unconditionally calls `field.select()` in a `requestAnimationFrame` queued by a focus handler. If another input gains focus before the callback executes, `select()` may refocus the stale field. That can interfere with the existing `focusout` deferred `commitSegments({pad: true})` gate, which requires focus outside the wrapper.

## Minimal fix

Only perform deferred `field.select()` if `document.activeElement === field` when the animation frame executes. Do **not** force any blur, alter `commitSegments`, validation or native date semantics. Preserve segment content selection for an input that remains focused.

Add a deterministic real-browser regression to `tests/date-keyboard-boundary-v230.spec.mjs` that synchronously focuses the day field and then the title in the same browser task, crosses two animation frames and requires focus to remain on the title. Also confirm focused day text remains auto-selected. Existing invalid-date and 20-cycle focus/feedback assertions stay unchanged.

## Boundaries

No changes to HTML/CSS, Release304/manifest, Pages builder/legacy aliases or PNG, Firebase/Rules/Auth/storage, workflow, snapshots, or legacy frozen script. No fixed sleep, retry increase or assertion relaxation.

This correction addresses a demonstrable *focus-stealing mechanism*; it does **not** establish that the one-time Ver.436 missing-`is-invalid` symptom has the same root cause. Keep Issue #355 open for continued evidence and confirmation.

## Required acceptance gates

Use the exact latest PR head and pass independent Protocol, Browser shard 1 and 2, Firebase emulator and final Regression. Only then merge with expected-head SHA, require same-SHA main Regression and Pages success, then create a dedicated recovery checkpoint. Do not declare acceptance while any gate is incomplete or failed.
