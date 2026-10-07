# Ver.361 Schedule reminder one-shot product

Base: Ver.360 main `2888e36681dab83cfee1814e6bafa7e1d1a0fce9`

Restore point: `backup/ver360-before-v361-schedule-reminder-product`

## Product change

The Schedule 15-minute reminder owner in `app.js` no longer wakes every 30 seconds.

Ver.361 keeps the existing duplicate-safe `checkScheduleReminders()` behavior, but time arrival is now owned by one timeout aimed at the earliest eligible, unnotified `startAt - 15 minutes` boundary.

The lifecycle:

- keeps at most one reminder timeout;
- re-arms after remote schedule refresh, local schedule loading, and notification-permission activation;
- keeps the timeout armed while the board is in a hidden/background tab;
- performs immediate catch-up and idempotent re-arm on `focus`, `pageshow`, and return to visible;
- caps very long timeout delays at the browser timer maximum and re-evaluates later;
- preserves assignee filtering, reminder-key deduplication, seven-day seen-map pruning, Notification behavior, schedule data semantics, and Firebase write paths.

## Regression coverage

- `test-harness/schedule-reminder-one-shot-v361.test.mjs`
  - verifies the 30-second interval is gone;
  - verifies nearest-boundary selection, single timeout ownership, background capability, catch-up lifecycle, preserved reminder semantics, and release alignment.
- `tests/schedule-reminder-polling-v361.spec.mjs`
  - verifies no 30-second app interval is created;
  - verifies a schedule starting in 20 minutes owns one timeout at 5 minutes;
  - verifies hidden state does not release the reminder timeout;
  - verifies visible/focus/pageshow recovery stays idempotent;
  - verifies boundary firing persists reminder dedup state and leaves no timer when no later reminder exists.

## Release

Release / baseline: **294 -> 295**
