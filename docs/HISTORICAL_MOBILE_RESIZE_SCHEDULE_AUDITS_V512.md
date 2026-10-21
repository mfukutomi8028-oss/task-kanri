# Ver.512 — Historical mobile resize and schedule handoff audits (Issue #292)

## Purpose and fixed recovery sources

Baseline: formally accepted Ver.511 main `bd28c5eae85e69cf37a54915ff7b0f719f6ddaf3` (main Regression #39525113176 and Pages #39525113213 success, identical checkpoint `backup/ver511-mobile-interaction-audit-archive-validated-checkpoint`).

This index consolidates historical **audit evidence**, not current runtime instructions. The old root documents can be reconstructed from fixed Git commits using their original SHA-1 blobs. Their original bytes are not rewritten.

| Retired root Markdown | Original Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_RESIZE_SCOPE_AUDIT_V295.md` | `b6a1dc3ba41dd86cd06e374b51e83be077ed9f04` | 2,945 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd28c5eae85e69cf37a54915ff7b0f719f6ddaf3/MOBILE_SHELL_RESIZE_SCOPE_AUDIT_V295.md) |
| `MOBILE_SHELL_RESIZE_RESPONSIBILITY_AUDIT_V297.md` | `57c4fe06a04700f9b1b904c7dca627db98c2c9f2` | 2,635 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd28c5eae85e69cf37a54915ff7b0f719f6ddaf3/MOBILE_SHELL_RESIZE_RESPONSIBILITY_AUDIT_V297.md) |
| `MOBILE_SHELL_SCHEDULE_RETRY_AUDIT_V303.md` | `53b6d002d8d1a539cd9df4ca9cdc68bb95de1aca` | 2,368 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd28c5eae85e69cf37a54915ff7b0f719f6ddaf3/MOBILE_SHELL_SCHEDULE_RETRY_AUDIT_V303.md) |

Originals: **3 files / 7,948 bytes**. Existing root `blob/main/` links and root-relative bookmarks may break after cleanup; use the immutable original URLs above for restoration. Historical Git history size does not shrink.

## Ver.295 — the board-only resize candidate was not safe to promote

Historical audit setup (only a temporary Playwright-served copy):

```js
window.addEventListener("resize", schedulePatch);
```

The board-only candidate substituted:

```js
window.addEventListener("resize", scheduleBoardTabs);
```

Production runtime remains unchanged during this historical audit. No Firebase or business-data write-path change was made.

**Important negative finding:** Ver.296's subsequent product gate rejected directly promoting the board-only resize substitution: it failed to recover intentionally drifted **header title** and **menu button** state even though board/status tabs recovered. Ver.295's narrower experiment alone does *not* justify removing title/menu recovery. The retained `MOBILE_SHELL_RESIZE_PRODUCT_GATE_V296.md` records that decision.

## Ver.297 — the three-responsibility repair adopted by Ver.298

Historical startup `patchAll()` responsibilities:

- `ensureMobileHeader()`
- `patchMobileBoardTabs()`
- `syncMobileHeaderTitle()`
- `syncMobileMenuButton()`
- `bindGlobalClicks()`

Ver.297 tested an rAF-deduped resize path that replaces its `patchAll()` call with the specific three responsibilities needed to restore board, title and menu, retaining header creation and one-shot navigation binding at startup:

```js
patchMobileBoardTabs();
syncMobileHeaderTitle();
syncMobileMenuButton();
```

Startup `patchAll()` must remain unchanged. The tested boundaries included an 860/861px viewport round-trip, deliberate UI drift, unchanged mobile-header identity, stable navigation and one-time conditional script loading. Ver.298 productized this three-responsibility subset, not Ver.295's board-only candidate. See retained `MOBILE_SHELL_RESIZE_RECONCILER_V298.md`, `mobile-shell-v234.js` and `test-harness/mobile-shell-resize-reconciler-v298.test.mjs`.

## Ver.303 — canonical same-task Schedule create handoff

The historical `openNewSchedule()` path retried the new-Schedule click at fixed `80/220/500ms` intervals after navigating to Schedule. Ver.303 demonstrated that canonical `app.js` navigation updates `state.layout`, performs `syncNavigationUi()` and `render()` synchronously. After the Schedule navigation click returns, `[data-new-schedule]` and its dialog handler are available in the same JavaScript task.

The valid Ver.304 replacement preserves the direct `tryOpen()` when already on Schedule and canonical navigation otherwise, but removes only the three fixed retries in favor of one synchronous `tryOpen()`. It preserves mobile menu, title, board reconciliation, 860/861px loading, Firebase/business-data writers and dialog behavior. Current owners: `MOBILE_SHELL_SCHEDULE_HANDOFF_V304.md`, `mobile-shell-v234.js`, `app.js`, `test-harness/mobile-shell-schedule-handoff-v304.test.mjs`.

## Non-changes, safety, and acceptance

- Retire only the three root Markdown copies named above and replace their current Protocol text reads with this index, preserving each existing assertion and all product checks without skipped tests or relaxed thresholds.
- Extend the existing Stage E archived-reference inventory to forbid root reintroduction and active-code references, and pin each original hash, byte count and immutable recovery URL in a Protocol test.
- Do not change any product HTML/JS/CSS, Release304/manifest, old runtime URL compatibility, Pages payload/build rules, workflow definitions, Firebase Auth/Rules, stored user data, or deferred security work.
- Gate: PR exact-head Protocol, Browser (1)/(2), Firebase Emulator and final Regression must succeed; merge only expected head; same-SHA main Regression and Pages including unchanged payload fingerprint must succeed; then verify a dedicated identical rollback checkpoint.
