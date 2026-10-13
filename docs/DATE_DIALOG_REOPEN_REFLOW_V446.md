# Ver.446 — Date segment dialog re-open and responsive reflow regression (Issue #355)

## Baseline and question

Ver.445 formally accepted main `1d493b18844775fc8e86d68e2a87a3f251484ecd`, same-SHA Regression #38339372994 and Pages #38339373005 success, and recovery checkpoint `backup/ver445-real-user-date-focusout-validated-checkpoint` are the required starting point.

Existing `app.js` resets the native due-date value before `taskDialog.showModal()`; `date-segment-controls-v230.js` observes the dialog `open` attribute and schedules `patchAll(); syncAll()` in a requestAnimationFrame. The Ver.240 dialog lifecycle also protects dismissal of an unsaved draft. Verify the combined behavior after invalid date entry and repeated opening/closing, and independently verify that browser viewport reflow does not prematurely commit or clear an incomplete invalid entry.

## Test-only changes

Two isolated Chromium Playwright tests are appended to the existing `tests/date-keyboard-boundary-v230.spec.mjs`:

1. **Viewport reflow:** enter impossible `2026-09-31` while focused on the day segment. The canonical native source stays empty, the wrapper remains dirty, and `is-invalid` is not yet shown. Change the real viewport from 1366px to 390px; require the day field, focus, dirty state and deferred feedback to remain unchanged. Click the title to exit the group: native source stays empty and `is-invalid` appears. Correct to `2026-09-30`, return to 1366px, and require valid source and no error after pointer exit. This probes browser CSS reflow, **not** a synthetic app data rerender.
2. **Dialog reopen after discarding:** three times in the same browser session, validate a normal date, replace the day with impossible `31`, click outside, and require the visible invalid class. Close with the actual app-owned close button and accept the Ver.240 trusted unsaved-input confirmation. Reopen using the existing new-task click handler. Require the native date, year/month/day segments, dirty flag, and invalid class to return to the clean new-task state. Confirm exactly two date wrappers and two picker buttons persist, with the same due-date wrapper DOM identity across cycles. No tasks are submitted.

Each test emits compact success metrics and attaches current dialog/source/segment/focus state as JSON on failure, without sleeps, synthetic blur, validation hooks, retries, or loosening the historical invalid-date assertions. Existing Ver.441–445 tests are unchanged.

## Scope and limitations

Only the preexisting Playwright test and this new document change. Production HTML/JS/CSS, date controller, Release304, manifest, Pages and legacy URLs/PNG, Firebase/Rules/Auth/real data, workflows, and existing recovery branches do not change. The test boot path disables remote Firebase configuration and blocks Firebase network requests. The synthetic new-task click invokes the actual app handler; the close action and unsaved-confirm are real UI interactions. Responsive viewport checks are a Chromium CSS reflow check, not a cross-device or mobile-browser certification.

## Causality and release gates

The one-time Ver.436 missing-`is-invalid` symptom remains causally unproven. A passing dialog lifecycle test does not establish that Ver.444's deferred-selection fix caused the historical symptom. Keep Issue #355 open for supported follow-up evidence.

Accept only after the latest exact PR head passes Protocol, Browser shard 1+2, Firebase emulator and final Regression; then expected-head merge, same-SHA main Regression/Pages success and read-back-verified recovery checkpoint. A failure requires root-cause analysis and a new tested head before merging.
