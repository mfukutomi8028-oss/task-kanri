# Ver.303 mobile schedule-create retry audit

## Baseline

- Product baseline: Ver.302 / release 272
- Product runtime under audit: `mobile-shell-v234.js`
- Canonical navigation/render owner: `app.js`
- This audit changes tests/documentation only. 製品コードは変更しない。

## Current behavior

`openNewSchedule()` first clicks an existing `[data-new-schedule]` button when the Schedule view is already rendered. Otherwise it clicks the canonical Schedule navigation item, then retries `tryOpen()` after fixed 80/220/500ms delays.

## Canonical timing contract

The `app.js` navigation click handler updates `state.layout`, calls `syncNavigationUi()`, and then calls `render()` synchronously. Schedule rendering creates `[data-new-schedule]` and binds its click handler to `openScheduleDialog()` before `render()` returns.

Therefore, after the canonical Schedule nav `.click()` returns, `[data-new-schedule]` should already be available in the same JavaScript task. The fixed 80/220/500ms callbacks are not expected to own an asynchronous data dependency.

## Browser audit

The Ver.303 browser audit verifies both sides of the contract:

1. From Tasks, a canonical Schedule nav `.click()` makes `[data-new-schedule]` available immediately in the same JavaScript task and its click opens the Schedule dialog.
2. A route-local candidate replacement removes the 80/220/500ms callbacks and performs one synchronous `tryOpen()` immediately after canonical navigation; the mobile `＋` → `新しい予定` path still opens the Schedule dialog.
3. When already on Schedule, the pre-existing direct `tryOpen()` path continues to open the dialog without navigation.

The route-local replacement exists only inside the audit browser test and is not a product modification.

## Decision gate

If Protocol and Browser regression are green on this audit branch, promote Ver.304 as the product candidate:

- preserve the first direct `tryOpen()` for an already-rendered Schedule view;
- preserve canonical Schedule navigation;
- replace only the three fixed 80/220/500ms retries with one synchronous `tryOpen()` immediately after navigation;
- preserve dialog semantics, mobile create-menu behavior, navigation/title synchronization, board reconciliation, resize handling, and conditional mobile-shell loading;
- do not change Firebase or business-data write paths.
