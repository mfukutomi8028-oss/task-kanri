# Ver.363 personal reminder one-shot lifecycle

Base: Ver.362 main `6fb04f0435d83651da31848dd70fb0e740d3cb78`.
Restore: `backup/ver362-v363-personal-reminders-20261008`.

## Product change

The active `reminders-v152.js` no longer runs `setInterval(schedule,30000)`. One owned `setTimeout` targets the nearest uncompleted reminder deadline, its 24-hour-before "soon" threshold, or next **local midnight**, whichever comes first. Delay is clamped to the browser maximum 2,147,483,647ms.

Every patch reconciles the existing due-toast/Notification flow, re-arms a single timer from the current reminder/task state, and preserves existing task and reminder update events and MutationObserver-based patch scheduling. `focus`, `pageshow`, and return to visible trigger catch-up; hidden tabs retain the clock owner for notification purposes.

For an unchanged reminder record signature, existing task-detail state badges are updated in place instead of remounting the editable reminder form. In Today's list, existing article due classes and time labels are refreshed in place without replacing action buttons. Thus time-only updates do not discard in-progress input.

## Preserved behavior

Task completion suppresses reminders and retains canonical `W.writeReminder` acknowledgement, user-change handling resets the local `notified` Set, and once-per task-id/timestamp dedup continues. Existing preset inputs, task/open controls, Firebase workflow, and notification permissions are unchanged.

## Test gates

- Protocol: `test-harness/personal-reminder-one-shot-v363.test.mjs` executes actual production source in a fake clock runtime, checking nearest deadline, timer ownership, background behavior, reconciliation, midnight, 24-hour threshold, duplicate protection, and user/task lifecycle.
- Existing Ver.362 protocol audit is kept compatible with the new one-shot timer ownership.
- Browser: `tests/personal-reminder-one-shot-v363.spec.mjs` asserts active source never installs the retired 30s interval, retains one midnight timeout, survives visibility/focus/pageshow, and fires/rearms correctly at midnight.
- Run full PR Protocol / Browser / Firebase Emulator before merge and main Regression / Pages after merge.

Release / baseline: **295 → 296**.
