# Ver.362 personal reminder polling audit

Base: Ver.361 formally green main `bc2a47e39e07c1eac51e276f2a1de45b0e9d51ea` (Release / baseline **295**).

Restore: `backup/ver361-before-v362-personal-reminder-audit`.

## Current owner

The active `reminders-v152.js` module unconditionally installs `setInterval(schedule,30000)` once at script evaluation. `schedule()` coalesces work into one `requestAnimationFrame` pass; `patch()` executes `clearCompleted()`, `patchDetail()`, `patchToday()`, and `notifyDue()`.

The 30-second interval is a **clock-arrival safety net**, not a Firebase synchronization mechanism. Existing `workflow-v152-update` and `workflow-v150-update` events, plus observers on `#mainContent` and `#detailBody`, handle many data/UI changes immediately. The independent interval catches reminders reaching `item.at` without any data or DOM change; simply removing it would break this behavior.

Notification ownership remains per active user (`lastUser`, `notified` Set), per task-id and reminder timestamp (`${id}:${item.at}`), and excludes completed/missing tasks. The due toast and, when permitted, native Notification share that dedup path. Acknowledgement writes are guarded via `clearing` and `W.writeReminder`.

## Additional calendar/UI responsibilities

- `dueItems()` collects uncompleted reminders through local **today 23:59:59.999**. Even when no reminder becomes due, the Today collection changes at midnight.
- `patchToday()` uses a data-based signature and builds `is-due` classes at render time. `patchDetail()` also uses a data signature. A periodic `patch()` call alone does **not** necessarily refresh the existing due styling when only time changes. This is a pre-existing presentation limitation; no runtime behavior is modified in this audit.
- `stateLabel()` changes at the reminder deadline and the 24-hour remaining threshold; `formatAt()` uses the local day boundary to choose “今日” versus a calendar date.
- Browser timer throttling/background suspension can postpone an interval. Today, no dedicated `focus` / `pageshow` / visible recovery listeners are installed by this module, so a resumed tab may wait for the next interval unless another event fires.

## Ver.363 product contract proposal

1. Replace only the personal-reminder 30-second interval after adding product browser coverage; keep the existing task and notification write paths.
2. Own at most one one-shot timer, scheduling the earliest valid future **uncompleted** reminder deadline, with a browser-safe maximum timeout and re-arm after firing.
3. Reconcile immediately after reminder/task data change, current-user change, and startup. Preserve the existing workflow events, observer responsiveness, rAF coalescing and dedup.
4. Keep a notification-boundary timer alive while hidden (personal reminders, like Ver.361 schedule reminders, must work in a background tab). On `focus`, `pageshow`, and visibility restoration, reconcile missed boundaries and re-arm.
5. Explicitly cover local-midnight Today membership/date-label refresh. Include the 24-hour UI transition or prove that a narrower rendering contract is correct. Do not confuse a UI-only timer with background notification ownership.
6. Reconcile due/not-due styling when crossing deadline if the existing data signature is unchanged, without destroying unsaved reminder-form edits; avoid blanket forced remounts.
7. Guard invalid `at` values, earlier/later reschedules, active-user changes, missing/completed tasks, acknowledge/clear writes, and repeated update events. Preserve user isolation and once-per-id/timestamp notifications.
8. Add Playwright product regression for foreground, background, resume, midnight, and idempotent arming before advancing release/baseline **295 → 296**.
9. No Firebase/emulator write behavior changes; use existing PR CI, exact-head merge, main Regression and Pages checks.

## Audit verification

`test-harness/personal-reminder-polling-v362.test.mjs` records the current interval and exercises the **actual unchanged module** in an isolated JS runtime: future reminder suppression, event-driven due notification, dedup, reschedule, user change, completion suppression, and release/baseline synchronization.

**Audit only:** no changes to production scripts or asset versions. Release / baseline stays at **295**.
