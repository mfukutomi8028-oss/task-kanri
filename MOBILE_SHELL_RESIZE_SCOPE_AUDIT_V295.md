# Ver.295 Mobile Shell Resize Scope Audit

## Baseline

- Ver.294 checkpoint: `f1e095aa4887e73dad07fb32f74395852d781bb1`
- release / baseline: `269`
- main Regression #720: green
- Pages #455: green

## Audit target

After Ver.294 retired the redundant delayed `orientationchange` recovery, `mobile-shell-v234.js` still routes every `resize` through:

```js
window.addEventListener("resize", schedulePatch);
```

`schedulePatch()` executes the full `patchAll()` bundle:

- `ensureMobileHeader()`
- `patchMobileBoardTabs()`
- `syncMobileHeaderTitle()`
- `syncMobileMenuButton()`
- `bindGlobalClicks()`

Ver.295 asks whether viewport resize actually needs all five responsibilities, or whether resize can be limited to the viewport-dependent board reconciliation already owned by `patchMobileBoardTabs()` / `scheduleBoardTabs()`.

## Audit method

Production runtime remains unchanged. The browser audit serves a temporary copy of `mobile-shell-v234.js` where only:

```js
window.addEventListener("resize", schedulePatch);
```

is replaced with:

```js
window.addEventListener("resize", scheduleBoardTabs);
```

All startup, navigation, observer, loader and schedule-create behavior remains the production implementation.

## Required evidence

With resize narrowed only in the temporary audit copy:

1. Mobile-width resize repairs intentionally drifted board active-column / tab state.
2. Mobile -> desktop-width -> mobile transitions remove and restore mobile board tabs correctly.
3. Header visibility follows the responsive CSS boundary without needing `ensureMobileHeader()` on each resize.
4. Header title and menu button remain canonical across viewport transitions without resize-triggered title/menu resync.
5. Navigation click synchronization still updates the mobile title through its own event path.
6. The mobile shell is acquired only once during the tested viewport transitions.
7. Release remains 269 and existing Protocol / Browser / Firebase Emulator regressions remain green.

## Interpretation boundary

This audit does not claim that `ensureMobileHeader()`, `syncMobileHeaderTitle()`, `syncMobileMenuButton()` or `bindGlobalClicks()` are unnecessary globally. It asks only whether they need to be re-run because the viewport resized.

If the narrowed resize path leaves any real viewport transition stale, production keeps full `patchAll()` recovery. If all tested resize transitions stay canonical, a separate Ver.296 product change may narrow only the resize listener from `schedulePatch` to `scheduleBoardTabs`, while retaining full startup `patchAll()` and all other event-specific ownership.

## Non-targets

- No production runtime change.
- No release / baseline change.
- No Firebase or business-data write-path change.
- No change to startup `patchAll()`.
- No change to the `#boardView`-scoped MutationObserver.
- No change to navigation synchronization.
- No change to `openNewSchedule()` 80 / 220 / 500ms retries.
