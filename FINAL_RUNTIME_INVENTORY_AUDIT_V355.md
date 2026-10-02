# Ver.355 Final Runtime Wakeup Inventory Refresh

## Scope

Ver.354 formal checkpoint (`d1a5864e8d539bc150ec14ae11ae26b7d179732b`, Release 292) after refreshing active runtime wakeup ownership.

This is an audit-only version. Product runtime, release version, and `baselineRelease` remain unchanged.

## Active runtime static totals

Release 292 active JavaScript inventory:

- MutationObserver: 26
- document.addEventListener: 48
- document.removeEventListener: 7
- window.addEventListener: 24
- window.removeEventListener: 0
- media addEventListener: 1
- setInterval: 7
- setTimeout: 43
- requestAnimationFrame: 31

Static counts are inventory signals only. Previously audited owners are not reopened solely because their registrations remain present.

## Retained audited boundaries

- `comment-reactions-v191.js`: Ver.346-354 cleanup remains intact: fixed `#detailBody` click/submit/keydown delegation, transient document outside-click ownership only while a picker is open, and semantic comment-surface MutationObserver scheduling.
- `dependencies-v149.js`: retired 60-second polling remains absent.
- `saved-views-v148.js`: retired legacy saved-filter polling remains absent.
- `completion-unpin-v150.js` and `inbox-events-v183.js`: audited 1500ms local fallback polling remains necessary for local-only canonical cache changes without explicit workflow events.
- `reminders-v152.js`: 30-second schedule check remains time-driven notification ownership.
- `insights-v148.js`: 60-second schedule check remains time-driven relative-timing display ownership.
- `dialog-lifecycle-v239.js`: document listeners remain separate explicit dialog lifecycle responsibilities covered by existing regression tests.
- `archive-ui-v182.js`: six-hour automatic archive check for 90-day completed tasks remains a lower-frequency, time-driven candidate and is not prioritized ahead of higher-frequency observer churn.

## Browser evidence: comments-tabs observer

`comments-tabs-v149.js` currently owns one MutationObserver on fixed `#detailBody` with `{ childList: true, subtree: true }`.

The audit demonstrated:

1. After `.task-detail-tabs-v149` has already been installed, an unrelated descendant-only mutation under the comments detail subtree still invokes the comments-tabs observer callback and supplies mutation records.
2. The tab scaffold remains a single canonical instance; the callback reaches `patch()` and the existing-tab guard makes the work a no-op.
3. DOM churn outside `#detailBody` does not wake this observer.
4. Replacing the canonical contents of `#detailBody` does wake the observer and recreates the four-tab scaffold, so detail redraw detection is a real dependency that must be preserved.

## Selection

The next isolated target is **Ver.356 `comments-tabs-v149.js` observer scope audit**.

The candidate should test whether the current `#detailBody` subtree observer can be narrowed to direct-root child-list and/or a semantic redraw filter while preserving:

- initial tab installation;
- canonical detail redraw/reopen;
- Overview / Comments / History / Workflow tab construction;
- tab selection behavior and panels;
- task-detail dialog/right-pane behavior;
- no persistence or Firebase ownership changes.

Ver.356 is an audit first. Product runtime and Release 292 should remain unchanged until the candidate passes Protocol, Browser, and Firebase Emulator regression.
