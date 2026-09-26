# Ver.298 Mobile Shell Resize Reconciler

## Baseline

- Ver.297 audit main: `2f215a88ddaeb4397147e56963fe944893c46ec7`
- previous release / baselineRelease: `269`
- Ver.297 PR Regression #726, main Regression #727 and Pages #458: green

## Product change

Ver.297 proved that resize recovery needs only three of the five `patchAll()` responsibilities to preserve the existing recovery contract.

The startup `patchAll()` remains unchanged and still owns:

1. `ensureMobileHeader()`
2. `patchMobileBoardTabs()`
3. `syncMobileHeaderTitle()`
4. `syncMobileMenuButton()`
5. `bindGlobalClicks()`

The rAF-deduped `schedulePatch()` used by `resize` now runs only:

```js
patchMobileBoardTabs();
syncMobileHeaderTitle();
syncMobileMenuButton();
```

This removes redundant per-resize execution of header creation checks and the one-shot global click binder while retaining board, title and menu recovery.

## Preserved boundaries

- startup `patchAll()` remains unchanged;
- `#boardView`-scoped MutationObserver remains board-only;
- 860/861px desktop/mobile boundary remains unchanged;
- conditional mobile-script loading remains owned by `config.js`;
- navigation synchronization remains active;
- `openNewSchedule()` 80ms / 220ms / 500ms retries remain unchanged;
- no Firebase, task persistence, workflow, notification, or other business-data write path is changed.

## Release

- release manifest: `269 -> 270`
- responsibility baseline: `269 -> 270`

## Regression promotion

The Ver.297 browser audit is promoted from a route-rewritten audit into direct product regression: it loads the unmodified release 270 runtime and verifies drift recovery, 860/861 round-trip, stable header identity, navigation title synchronization, and single mobile-shell loading.
