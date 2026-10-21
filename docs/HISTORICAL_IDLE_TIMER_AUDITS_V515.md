# Ver.515 — Historical idle timer keep decisions (Issue #292)

## Accepted baseline and immutable recovery

Base is Ver.514 main `be4cf146c073d5fc15d1bb14230cb4e5bbf40095`; PR #435 exact-head checks and same-SHA Pages build/deploy have succeeded. Ver.514 formal acceptance/checkpoint is independently gated and is not implied by this draft. This is an audit-document archive only, not a runtime optimization.

| Retired root Markdown | Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `AUTO_ARCHIVE_CLOCK_AUDIT_V364.md` | `3b4111602e0bb7e615b886cc61fe50523b5e51fe` | 2,826 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/be4cf146c073d5fc15d1bb14230cb4e5bbf40095/AUTO_ARCHIVE_CLOCK_AUDIT_V364.md) |
| `COMPLETION_UNPIN_LIFECYCLE_AUDIT_V365.md` | `7e35cd1ad7ad3ee46095c84c9fdad0388e9fbe82` | 2,823 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/be4cf146c073d5fc15d1bb14230cb4e5bbf40095/COMPLETION_UNPIN_LIFECYCLE_AUDIT_V365.md) |

Originals: **2 files / 5,649 bytes**. The full historical bytes remain in Git history. Fixed Git commit links permit restoration; root `blob/main/` links and external bookmarks may return 404 after cleanup.

## Ver.364 — automatic archive six-hour clock: KEEP

This historical audit found that `archive-ui-v182.js` has one startup `setTimeout(autoArchive, 2500)` and one `setInterval(autoArchive, 6h)`. Automatic eligibility depends on strict elapsed time (`completedAt < Date.now() - 90 * 86400000`), not merely workflow update events. Only completed records that are not already archived or merged-duplicate sources are eligible; up to 20 are processed per run with the canonical awaited `W.archiveTask(id, 'auto')` writer.

**Do not remove the six-hour clock in Ver.364.** Clock arrival can change eligibility without any data-write event; the four nominal wakes per day are a small burden compared with missed archiving. A future one-shot alternative requires proven next-eligibility scheduling, restoration after background/focus/pageshow, catch-up of >20 tasks, idempotence and safe transaction/race behavior. The Ver.364 audit made no runtime, release or Firebase write changes. Current owners are `archive-ui-v182.js`, `workflow-v152.js`, `test-harness/auto-archive-clock-v364.test.mjs`.

## Ver.365 — completion-unpin 1500ms fallback: KEEP

The `completion-unpin-v150.js` fallback binds one `setInterval(localRepair, 1500)` only after startup cannot acquire a remote dependency (`local-only`). `workflow-v150-update` can repair immediately, but that event does not signal every canonical task-cache write. A completed pinned task written without the event still needs the fallback. Remote mode does **not** start the local interval; it uses Firebase `onValue` plus guarded `runTransaction` (`applyLocally:false`) to avoid overwriting status/revisions and duplicate in-flight work.

**Do not remove the 1500ms fallback in Ver.365.** An existing interval need not be cleared on a synthetic dependency-state transition because the `dependencyState()` gate prevents local writes, but that is not proof of a remote reconnect lifecycle. Replacing the fallback requires proof of all local/cache/cross-tab write signals, status transitions without workflow events, and separate reconnect requirements. Product runtime, Firebase paths, release and data writes remained unchanged during Ver.365. Current owners are `completion-unpin-v150.js`, `workflow-core-v150.js`, `test-harness/completion-unpin-lifecycle-v365.test.mjs`, and `tests/completion-unpin-polling-audit-v330.spec.mjs`.

## Safety and acceptance gate

Retire exactly the two root historical audit Markdown paths above, add them to the Stage E fail-closed archive index, and add Protocol validation of original SHA/bytes/recovery URL and preserved live product/test owners. Do not change production JS/HTML/CSS, release/manifest, Pages distribution, workflow definitions, Firebase Authentication/Rules/writers, persisted data or postponed security work.

Accept only after PR exact-head Protocol, Browser (1)/(2), Firebase and final Regression success; Ver.514 main formal acceptance/checkpoint identical; expected-head merge; Ver.515 same-SHA main Regression and Pages success with unchanged SHA-256; then dedicated identical rollback checkpoint.
