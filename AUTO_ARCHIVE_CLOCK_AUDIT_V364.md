# Ver.364 — Automatic archive six-hour clock audit

## Verified base
- Ver.363 main: 0d8bde1d53f31364bd0fe84bf1deb63d90790097.
- Main Regression #1114: Protocol, Browser and Firebase Emulator succeeded.
- Pages #534: build and deployment succeeded.
- Restore: backup/ver363-before-v364-auto-archive-audit.
- Audit only: no product runtime, UI, release, baselineRelease, or Firebase write path changes.

## Current ownership
- Active archive-ui-v182.js registers one startup setTimeout(autoArchive, 2500) and one unconditional setInterval(autoArchive, 6h).
- workflow-v152-update triggers schedule() then renderAll(); it does not invoke autoArchive().
- The archive condition uses completedAt > 0 and completedAt < (Date.now() - 90 * 86400000). This is a strict 90 elapsed 24-hour days threshold, not calendar-day rollover.
- Completed only; existing archives and merged-duplicate sources are excluded.
- Up to 20 tasks are processed per pass, in map order, via the awaited canonical W.archiveTask(id, 'auto') writer.
- Archive UI does not write directly to Firebase. Existing archive/unarchive transaction safety remains in workflow-v152.js.

## Tests
test-harness/auto-archive-clock-v364.test.mjs boots the actual unchanged product script under a controlled clock and instrumented archive writer.
- Verifies one 2.5s startup timer and one six-hour periodic timer, unaffected by repeated workflow updates.
- Verifies strict 90-day cutoff, completion/date guards, archive and duplicate exclusion.
- Verifies 20-per-pass batching, subsequent 25-item catch-up, and correct writer reason.
- Verifies workflow-update event alone does not replace the periodic clock.
- Checks canonical writer delegation and release/baseline synchronization.
Repository-wide Protocol, Browser, and Firebase Emulator are the PR CI gates.

## Decision and future contract
Do not remove the six-hour clock in Ver.364. Time arrival changes eligibility even without data mutations. Unlike prior 30/60-second watchers, this wakes nominally only four times daily; the potential idle saving is modest relative to the consequences of missed archive runs.

A one-shot candidate is not authorized for productization until all are demonstrated:
1. Schedule at the earliest completedAt + 90*DAY + 1ms boundary, recompute on data/update/user/restore changes.
2. Catch up after background suspension, focus, pageshow, and visibility restoration; tolerate delayed timers.
3. Drain >20 eligible records without six-hour-per-batch starvation, rapid write bursts, or infinite retry loops.
4. Preserve canonical transactional archive writers and safe conflict/failure behavior, including multi-tab races.
5. Confirm actual browser user flows and automatic-archive expectations.

Outcome: leave interval and product logic unchanged; release / baseline stay 296 / 296.
