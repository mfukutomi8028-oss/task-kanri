# Ver.297 Mobile Shell Resize Responsibility Audit

## Baseline

- main checkpoint: `bf19a15e5ea9bf473900142d89cc6f17cd9ed8db`
- release / baselineRelease: `269`
- production runtime: `resize -> schedulePatch -> patchAll()` remains unchanged
- Ver.296 product gate proved that the Ver.295 board-only substitution repairs board/tabs but drops the existing header-title and menu-button recovery contract.

## Audit target

`patchAll()` currently contains five responsibilities:

1. `ensureMobileHeader()`
2. `patchMobileBoardTabs()`
3. `syncMobileHeaderTitle()`
4. `syncMobileMenuButton()`
5. `bindGlobalClicks()`

Ver.297 tests whether resize recovery can be narrowed to responsibilities 2-4 while keeping responsibilities 1 and 5 startup-owned.

The temporary audit substitution keeps the existing `schedulePatch()` requestAnimationFrame dedupe but replaces its `patchAll()` call with:

```js
patchMobileBoardTabs();
syncMobileHeaderTitle();
syncMobileMenuButton();
```

Production `mobile-shell-v234.js` is not changed in this audit.

## Why 1 and 5 are candidates for exclusion

- `ensureMobileHeader()` creates the header only when the mobile shell is first installed. Once installed, desktop/mobile CSS switches visibility without removing that DOM. A desktop cold boot that later enters mobile loads the shell and executes startup `patchAll()` before resize recovery becomes relevant.
- `bindGlobalClicks()` is guarded by `window.__workBoardMobileFixClicksV101` and is intentionally one-shot. Re-running it on every resize cannot add a second listener and therefore has no per-resize semantic value after startup.

## Required browser evidence

- mobile resize repairs intentionally drifted board, title and menu state with only responsibilities 2-4;
- 860/861 boundary round-trip still removes/restores board tabs and keeps header/menu/title canonical;
- navigation after one or more resizes still updates the mobile title, proving the startup global click binding remains active;
- mobile header identity remains stable across resize and no duplicate header is created;
- mobile shell is requested only once;
- Firebase/business-data paths remain blocked in the browser audit and unchanged in production.

## Decision gate

If all evidence is green, Ver.298 may productize a dedicated resize reconciler containing only:

- `patchMobileBoardTabs()`
- `syncMobileHeaderTitle()`
- `syncMobileMenuButton()`

Startup `patchAll()` must remain unchanged so header creation and global-click binding keep their current ownership.

If any existing recovery contract fails, keep the current `resize -> schedulePatch -> patchAll()` design.
