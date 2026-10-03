# Ver.360 Schedule reminder polling scope audit

Base: Ver.359 main `75cbe877065c97ec1496c8eec9e34799a3432679`

Restore point: `backup/ver359-before-v360-schedule-reminder-polling-audit`

## Current owner

`app.js` owns the 15-minute schedule reminder lifecycle.

Current startup behavior:

```js
function startScheduleReminderWatcher() {
  if (state.scheduleReminderTimer) return;
  state.scheduleReminderTimer = setInterval(checkScheduleReminders, 30000);
  setTimeout(checkScheduleReminders, 1200);
}
```

`checkScheduleReminders()` compares each relevant schedule's `startAt` to `Date.now()`, fires only while `0 < start-now <= 15 minutes`, persists a reminder key before firing, and prunes reminder-history entries older than seven days.

Schedule refresh paths already call `checkScheduleReminders()` immediately for remote subscription updates and local schedule loading. Notification-permission activation also performs an immediate check.

## Audit result

The 30-second interval is not required for collection synchronization. Its only unique responsibility is detecting passage of time into the 15-minute reminder window.

That responsibility can be represented more narrowly by a one-shot timer aimed at the earliest unnotified reminder boundary (`startAt - 15 minutes`). After firing, the runtime can call the existing duplicate-safe `checkScheduleReminders()` and arm the next boundary.

Unlike the Ver.359 Schedule Today timer, this timer **must not be cleared simply because the document becomes hidden**. Schedule reminders are expected to remain useful while the board is open in a background tab. A product lifecycle should therefore keep the one-shot timer armed while hidden, and use `focus`, `pageshow`, and visible recovery only as catch-up/re-arm protection for browser suspension or timer throttling.

## Productization contract for Ver.361

A safe product change should:

1. Remove only `setInterval(checkScheduleReminders, 30000)`.
2. Preserve the existing startup catch-up semantics.
3. Compute the next eligible, unnotified reminder boundary from current schedules.
4. Own at most one reminder timeout.
5. On timeout, run `checkScheduleReminders()` and re-arm from current schedule state.
6. Re-arm after schedule collection refresh so newly-created/edited schedules can move the next boundary earlier.
7. Keep background-tab reminder capability; do not implement visibility-only ownership.
8. Add focus/pageshow/visible catch-up so a suspended tab reconciles immediately on return.
9. Preserve reminder key generation, assignee filtering, seven-day seen-map pruning, Notification behavior, schedule writes, and Firebase paths.
10. Promote audit coverage to product regression before release/baseline advancement.

## Release impact

Audit only. Product runtime remains unchanged and Release / baseline remains **294**.
