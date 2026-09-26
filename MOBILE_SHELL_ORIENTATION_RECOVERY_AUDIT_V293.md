# Ver.293 Mobile Shell Orientation Recovery Audit

## Baseline

- Ver.292 checkpoint: `146b709197875f507c7afa08402e2788d07864e5`
- release / baseline: `268`
- PR #181 Regression #711: green
- main Regression #712: green
- Pages #451: green

## Audit target

After Ver.292 retired the 300ms / 1000ms startup insurance passes, `mobile-shell-v234.js` still has two viewport recovery paths:

```js
window.addEventListener("resize", schedulePatch);
window.addEventListener("orientationchange", () => setTimeout(schedulePatch, 150));
```

Ver.293 asks whether the delayed `orientationchange` path has independent product value when a real portrait/landscape viewport transition already emits `resize` and therefore schedules the same `patchAll()`.

The browser audit serves a temporary copy of `mobile-shell-v234.js` with only the `orientationchange` listener suppressed. Production runtime and release remain unchanged.

## Explicit non-targets

This audit does not suppress or change:

- `resize` recovery;
- immediate startup `patchAll()`;
- the `#boardView`-scoped MutationObserver;
- conditional mobile-shell loading in `config.js`;
- navigation click synchronization;
- `openNewSchedule()` 80ms / 220ms / 500ms retries;
- Firebase or business-data write paths.

## Required evidence

With only the delayed orientation listener suppressed:

1. Chromium portrait -> landscape and landscape -> portrait device-metric transitions emit `resize`.
2. Mobile header/title/menu drift introduced immediately before rotation is recovered by the retained resize path.
3. Task-board status tabs retain exactly one active mobile column after rotation.
4. A mobile -> desktop-width -> mobile rotation-style transition remains canonical and does not reload the already-acquired mobile shell.
5. Release remains 268 and all existing Protocol, Browser and Firebase Emulator regressions remain green.

## Interpretation boundary

A synthetic `orientationchange` dispatched without any viewport change is not treated as evidence that a real device rotation requires the listener. The product responsibility exists to reconcile viewport/layout changes; Ver.293 therefore measures actual device-metric transitions and the resize signal they produce.

If the audit finds a real rotation transition that does not emit resize or leaves a stale state without the orientation listener, the listener stays. If all tested rotation transitions are fully recovered through resize, Ver.294 may retire only the delayed orientation listener in a separate product change.
