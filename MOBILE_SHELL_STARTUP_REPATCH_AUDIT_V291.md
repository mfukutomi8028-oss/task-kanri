# Ver.291 Mobile Shell Startup Repatch Audit

## Baseline

- Ver.290 checkpoint: `05a23130244b44544718d9b680fccaaa0ab23991`
- release: `267`
- main Regression #703: green
- Pages #449: green

## Audit target

`mobile-shell-v234.js` performs its canonical `patchAll()` on startup and then schedules two additional full-shell passes at 300ms and 1000ms:

```js
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
```

The current runtime already has more deterministic recovery paths:

- mobile cold boot loads `mobile-shell-v234.js` before the normal dynamic sidecars;
- desktop cold boot can acquire the mobile shell exactly once when crossing into `max-width: 860px`;
- `patchAll()` runs immediately when the late-loaded script evaluates after DOMContentLoaded;
- navigation clicks explicitly resynchronize the mobile header and status tabs;
- the board-scoped MutationObserver resynchronizes status tabs after board DOM changes;
- resize and orientationchange remain independent viewport-transition recovery paths.

Ver.291 is audit-only. The production `mobile-shell-v234.js`, release value, Firebase code and business-data write paths remain unchanged. Browser tests serve a temporary copy of `mobile-shell-v234.js` with only the two startup `setTimeout(schedulePatch, 300/1000)` calls suppressed.

## Explicit non-targets

This audit does **not** remove or suppress:

- `resize` recovery;
- `orientationchange` recovery;
- the board-scoped MutationObserver;
- conditional mobile-script loading in `config.js`;
- `openNewSchedule()`'s separate 80ms / 220ms / 500ms retries.

Those paths have different responsibilities and must not be conflated with the two startup insurance passes.

## Required evidence

With only the 300ms / 1000ms startup repatches suppressed inside the audit browser:

1. 390px and 860px mobile cold boot expose the mobile header without waiting for an insurance pass.
2. After all release assets are ready, the mobile title matches the canonical active navigation item.
3. The mobile create menu still delegates to the canonical task and schedule entry points.
4. Navigating to the task board produces usable status tabs and exactly one active board column.
5. A board-local DOM change updates the status-tab count through the existing board-scoped MutationObserver.
6. Waiting beyond the former 1000ms insurance window does not reveal a missing late reconciliation.
7. A desktop cold boot at 861px can resize to 860px, late-load the mobile shell once, and immediately reach the same canonical header/title/tab state.
8. Existing release 267, Firebase and business-data write behavior remain unchanged.

## Decision gate

Promote removal of only the two startup `setTimeout(schedulePatch, 300/1000)` calls if the protocol, browser regression and Firebase Emulator suites are green and the audit scenarios above pass without them.

If any scenario depends on a delayed full-shell pass, keep the timers for now and record the exact missing deterministic signal instead of forcing their removal.
