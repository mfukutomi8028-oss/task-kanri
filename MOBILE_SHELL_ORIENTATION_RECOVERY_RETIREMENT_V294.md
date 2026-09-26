# Ver.294 Mobile Shell Orientation Recovery Retirement

## Decision

Ver.293 demonstrated that real portrait/landscape viewport transitions emit `resize` and recover the mobile shell through the retained `resize -> schedulePatch -> patchAll()` path even when the delayed orientation listener is suppressed.

Ver.294 therefore removes only this audited redundant recovery:

```js
window.addEventListener("orientationchange", () => setTimeout(schedulePatch, 150));
```

## Preserved runtime paths

The product keeps all of the following unchanged:

- immediate startup `patchAll()`;
- `resize -> schedulePatch -> patchAll()` recovery;
- the `#boardView`-scoped MutationObserver and `scheduleBoardTabs()` path;
- conditional mobile-shell loading at the 860px boundary;
- navigation click synchronization;
- `openNewSchedule()` 80ms / 220ms / 500ms retries.

## Evidence promoted from Ver.293

The Ver.293 browser audit served a temporary copy with only the orientation listener suppressed and verified:

1. portrait -> landscape and landscape -> portrait device-metric transitions emit `resize`;
2. header/title/menu drift introduced immediately before rotation is recovered through resize;
3. the task-board status tabs return to exactly one active mobile column after rotation;
4. a mobile 800px -> desktop-width 1000px -> mobile 800px transition remains canonical;
5. the already-acquired mobile shell is not reloaded during the transition;
6. Protocol, Browser and Firebase Emulator regressions were green before productization.

The Ver.294 browser regression runs the unmodified product runtime, with no request interception or listener suppression, and repeats those rotation/recovery checks on release 269.

## Release / data boundary

- Release manifest: 268 -> 269.
- Responsibility baseline: 268 -> 269.
- No Firebase, task persistence, workflow, notification, or other business-data write path is changed.

## Next audit candidate

Ver.295 may audit whether the remaining `resize` recovery needs to call the full `patchAll()` or can be narrowed to the viewport-dependent mobile-board responsibility while preserving 860/861 boundary transitions, header/menu correctness, conditional loading, and existing business-data boundaries.
