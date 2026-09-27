# Ver.304 mobile schedule-create synchronous handoff

## Baseline

- Audit baseline: Ver.303 / release 272
- Product release: 273
- Product runtime: `mobile-shell-v234.js`
- Canonical navigation/render owner: `app.js`

## Promoted change

Ver.303 proved that clicking the canonical Schedule navigation item completes `syncNavigationUi()` and `render()` in the same JavaScript task. By the time the navigation `.click()` returns, Schedule rendering has already created `[data-new-schedule]` and bound it to `openScheduleDialog()`.

Ver.304 therefore removes only the three fixed schedule-create callbacks:

- `setTimeout(tryOpen, 80)`
- `setTimeout(tryOpen, 220)`
- `setTimeout(tryOpen, 500)`

The mobile Schedule create path now keeps:

1. the existing direct `tryOpen()` when Schedule is already rendered;
2. the canonical Schedule navigation click when the button does not yet exist;
3. one synchronous `tryOpen()` immediately after that navigation returns.

## Preserved boundaries

The following behavior is unchanged:

- mobile `＋` create menu and its close behavior;
- canonical navigation and active-item state;
- mobile header title synchronization;
- board status-tab reconciliation and semantic board observer;
- resize reconciliation;
- 860/861px conditional mobile-shell loading boundary;
- task create path;
- Schedule dialog semantics in `app.js`;
- Firebase, task persistence, workflow, notifications, and every business-data write path.

## Regression contract

Product regression must verify:

- Tasks → mobile `＋` → `新しい予定` opens the Schedule dialog and activates Schedule;
- an already-rendered Schedule view still uses the direct open path;
- the canonical navigation exposes `[data-new-schedule]` in the same JavaScript task;
- 861px → 860px late mobile-shell loading still supports the same create flow;
- release manifest and `baselineRelease` advance together to 273;
- no 80/220/500ms schedule-create retry remains.

## Next audit boundary

Ver.305 should audit the remaining navigation reconciliation in `bindGlobalClicks()`: the document capture listener currently uses `setTimeout(..., 0)` so its close/title/board work runs after the canonical navigation handler. The next audit should determine whether the same ordering can be expressed with a narrower deterministic event phase while preserving drawer close, header title, board tabs, 860/861px behavior, and conditional loading. Product runtime is not changed by that future audit until equivalent behavior is proven.