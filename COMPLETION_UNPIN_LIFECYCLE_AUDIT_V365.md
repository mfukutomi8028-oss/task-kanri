# Ver.365 — completion-unpin 1.5-second fallback lifecycle audit

## Base and scope
- Base: Ver.364 main `3c611916721be72d70eaa4d196749c07f4440e1f`.
- Restore: `backup/ver364-before-v365-completion-unpin-audit`.
- Target: active `completion-unpin-v150.js` only. The audit adds behavioral tests; it does not change runtime, user interface, release version, Firebase paths, or database writes.
- Release / baseline: **296 / 296** (unchanged).

## Findings from real-source execution
1. `bindRemote()` runs once on startup. If `ensureRemote()` returns null, the script repairs the local cache and starts exactly one 1500ms interval.
2. Local `workflow-v150-update` can repair immediately, but is not a canonical task-cache-write event. Prior Ver.330 browser tests show a direct completed+pinned cache mutation without that event is repaired at the next 1500ms tick.
3. In remote mode the interval is **not** started. A Firebase `onValue` subscription scans tasks; each candidate uses a guarded `runTransaction` with `applyLocally:false`, preserving latest-status checks, revision increments, and `inFlight` de-duplication.
4. An existing local timer has no `clearInterval` path. In a synthetic state change away from `local-only`, its callback remains scheduled but the first `dependencyState()` gate prevents local writes.
5. `workflow-core-v150.js` caches the initial Firebase initialization promise; adding runtime rebind/reconnect hooks to completion-unpin alone would not establish a working reconnection contract.

## Decision
**Do not remove the 1500ms fallback in Ver.365.** Its task-cache safety role is demonstrated in browser regression Ver.330 and the Ver.365 isolated real-source tests. In the normal configured remote path the fallback interval is not registered, limiting its performance impact to local-only operation. Event-only replacement without canonical task-write and cross-tab coverage risks leaving completed tasks pinned.

Before a later product optimization: instrument all task-cache writes, prove local/cross-tab `storage` and canonical write signals cover the fallback, test newly completed tasks without `workflow-v150-update`, and separately define whether live local-only → remote reconnection is a supported workflow. Only then consider conditional cancellation or event-only ownership.

## Validation gate
- New Node audit: `test-harness/completion-unpin-lifecycle-v365.test.mjs` executes the unchanged product script in VM for startup, local polling, update-event repair, remote subscription, transactional guards, concurrent callback deduplication, and timer lifecycle.
- Existing Browser Ver.330 regression stays enabled; entire Protocol / Browser / Firebase Emulator PR CI must pass.
- After exact-head merge, verify main Regression and GitHub Pages before declaring the checkpoint.
