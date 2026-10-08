# Ver.363 personal-reminder one-shot product

Base: Ver.362 main `6fb04f0435d83651da31848dd70fb0e740d3cb78`, Release / baseline 295.

Restore: `backup/ver362-before-v363-personal-reminder-product`.

## Product changes

- `reminders-v152.js`: remove the permanent `setInterval(schedule,30000)`; arm at most one timeout at the earliest eligible, incomplete task's future personal reminder `at` timestamp.
- When visible, also consider the 24-hour `is-soon` transition and next local midnight for Today membership and date-label updates. When hidden, release UI-only boundaries and **retain the reminder notification deadline**.
- Timeout invokes `patch()` directly, not via `requestAnimationFrame`, because background rAF may be suspended and notifications must not rely on a frame. `patch()` reconciles the current user and notification dedup before re-arming.
- Data events, DOM observers, startup, focus, pageshow, and visible recovery continue to reconcile state; hidden transition re-arms only notification-owned timeouts.
- If deadline styling changes while data signature remains the same, update only existing detail state badge class/text or Today item class/time. Do **not** remount the detail form or erase unsaved note/date input. Data-signature changes retain existing re-render semantics.
- Respect browser timeout maximum `2147483647` ms and re-evaluate after a cap-length timer; invalid, missing and completed items cannot own timer deadlines.
- Leave acknowledgement writes, notification dedup by user and `id:at`, Notification permission semantics, Firebase paths, and UI controls unchanged.

## Tests

- `test-harness/personal-reminder-one-shot-v363.test.mjs`: actual product module in isolated VM (timer ownership, clock arrival, background delivery, visible midnight, 24-hour UI boundary, reschedules, completion, identity and dedup).
- `tests/personal-reminder-one-shot-v363.spec.mjs`: product-browser regression for timeout count, background delivery, focus/pageshow idempotency, Today due classes with DOM identity retention, detail form unsaved note preservation, and local-midnight membership.
- Ver.362 isolated runtime compatibility harness updated for the one-shot owner, and Ver.361 historical release assertion made forward compatible.
- Register the new protocol test in `package.json`.

Release / baseline: **295 → 296**.

## Merge contract

Merge only after Protocol, Browser Regression and Firebase Emulator write suites are successful on the exact PR head. Confirm main Regression, GitHub Pages, and release/baseline after merge.
