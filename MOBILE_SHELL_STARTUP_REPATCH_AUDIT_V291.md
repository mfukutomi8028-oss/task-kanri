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

## CI observations

The first audit run, Regression #704, completed the full protocol suite successfully. The 390px and 860px cold-boot audit scenarios also passed with both startup timers suppressed.

Two later browser scenarios failed because the audit helper attempted a Playwright pointer click on the canonical left-navigation task button while that sidebar button was intentionally outside the viewport in the closed mobile drawer. The failure log repeatedly reported `element is outside of the viewport`; it did not show a missing mobile reconciliation or a dependency on either startup timer.

The helper was changed to invoke the same canonical navigation button through its DOM click event path, matching the established mobile regression pattern and leaving the production runtime and audit suppression unchanged.

Regression #705 on head `fe93e17a9022afbc61d3ecab7c19b5c624b7b786` then completed successfully:

- Protocol and release-contract tests: success
- Browser regression smoke tests: success
- Firebase Emulator write tests: success

## Findings

With both startup insurance passes suppressed:

- 390px and exact-boundary 860px cold boots reached a canonical mobile header immediately.
- The header title matched the active canonical navigation item after all release assets were ready.
- Task and schedule creation still delegated through the existing canonical entry points.
- The task board exposed status tabs and exactly one active mobile board column.
- A board-local task-card mutation updated and restored status-tab counts through the existing board-scoped MutationObserver.
- State remained unchanged after waiting beyond the former 1000ms insurance window.
- A desktop 861px cold boot could cross to 860px, load `mobile-shell-v234.js` exactly once, and reach the same canonical mobile header/title/tab state without either startup timer.
- Returning across the 861/860 boundary did not request another mobile shell.
- The full existing browser regression suite and Firebase Emulator write suite remained green.

No tested behavior required a delayed full-shell `patchAll()` at 300ms or 1000ms.

## Decision

The Ver.291 evidence supports retiring **only** these two startup insurance calls in Ver.292:

```js
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
```

Ver.292 must preserve the distinct recovery paths that were deliberately outside this audit:

- `resize` recovery;
- `orientationchange` recovery;
- the board-scoped MutationObserver;
- conditional mobile-shell loading in `config.js`;
- `openNewSchedule()` 80ms / 220ms / 500ms retries.

The Ver.291 audit itself remains release `267` and makes no production, Firebase, or business-data write change. Product removal is deferred to Ver.292 so it can receive its own release bump and full PR/main/Pages validation.
