# Ver.292 Mobile Shell Startup Repatch Retirement

## Scope

Ver.292 promotes the Ver.291 audit result into the active product runtime.

Only these two fixed startup insurance calls are removed from `mobile-shell-v234.js`:

```js
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
```

## Preserved recovery paths

The following responsibilities remain unchanged:

- the immediate startup `patchAll()` path;
- `resize` -> `schedulePatch` recovery;
- `orientationchange` -> delayed `schedulePatch` recovery;
- the `#boardView`-scoped MutationObserver for status-tab reconciliation;
- conditional mobile-shell loading in `config.js` when crossing into `max-width: 860px`;
- navigation-click header/tab synchronization;
- `openNewSchedule()` 80ms / 220ms / 500ms retries.

## Evidence carried forward from Ver.291

With only the 300ms / 1000ms calls suppressed in a temporary served copy, Ver.291 proved that:

- 390px and 860px cold boots reached the canonical mobile header immediately;
- header title and active navigation stayed synchronized;
- task/schedule creation continued through canonical entry points;
- status tabs and active columns were correct;
- board-local task-card mutations updated counts through the scoped observer;
- state stayed stable beyond the old 1000ms insurance window;
- 861px desktop cold boot -> 860px late mobile-shell loading reached the same canonical state;
- Protocol, Browser regression and Firebase Emulator suites were green.

Ver.292 converts that suppression audit into the product contract: tests run against the unmodified release 268 runtime and require both fixed startup calls to be absent.

## Release boundary

- Release manifest: 267 -> 268.
- Responsibility baseline: 267 -> 268.
- The physical file name `mobile-shell-v234.js` remains unchanged for loader compatibility.
- No Firebase, task persistence, workflow, notification, or other business-data write path is changed.

## Next audit boundary

The 150ms `orientationchange` recovery is intentionally retained in Ver.292. A later audit may compare it against the already-preserved `resize` recovery, because orientation changes commonly also generate resize events. That question is separate from the startup insurance timers removed here.
