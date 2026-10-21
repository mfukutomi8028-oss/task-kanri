# Ver.516 — First-paint, version and brand lifecycle historical audits (Issue #292)

## Fixed origins and scope

Baseline: formally accepted Ver.515 main `43231a69957f8bc70f6f0ad5d7e20dc6d3015c73`, [Regression #39535130957](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/39535130957) (five jobs success), [Pages #39535131071](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/39535131071) (build/deploy success) and validated checkpoint `backup/ver515-idle-timer-audit-archive-validated-checkpoint`.

This document archives historical audit decisions and experiments; it is **not** a current product release specification. Historic release numbers 260/261/264 are evidence snapshots, not the current Release304 baseline.

| Retired root Markdown | Original Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md` | `d184687720701e1c29186e7d33a5be23d714a38d` | 8,619 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/43231a69957f8bc70f6f0ad5d7e20dc6d3015c73/FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md) |
| `POSTLOAD_VERSION_SYNC_AUDIT_V278.md` | `3811233b99ef6cd84d6a19e35d5ea252c3079990` | 5,001 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/43231a69957f8bc70f6f0ad5d7e20dc6d3015c73/POSTLOAD_VERSION_SYNC_AUDIT_V278.md) |
| `BRAND_PAGESHOW_COLD_BOOT_AUDIT_V284.md` | `972e9f8ae0c77ed89a74951dc34e57fda707a50d` | 3,725 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/43231a69957f8bc70f6f0ad5d7e20dc6d3015c73/BRAND_PAGESHOW_COLD_BOOT_AUDIT_V284.md) |

The original three notes total **3 files / 17,345 bytes**. Each exact original remains recoverable in Git history by the pinned parent-commit link and original Git blob SHA-1 above. Root `blob/main/` links or external bookmarks to the retired files may return 404. Restore from immutable sources if an unknown external dependency is discovered.

## Ver.276 — manifest version text versus first-paint handoff (historical release 260)

The audit compared normal cold boot with suppression of **only** the legacy manifest version text update. The manifest `DOMContentLoaded` listener originally ran before config, changing text from `Ver.143` to `Ver.260` while the `wb-first-paint-v260` guard still hid the UI and assets-ready was false. The following config `start()` and its first `setVersion()` synchronised the semantic class `workboard-version-display`, text, title, `data-release-version` and global versions before reveal.

In the counterfactual, suppressing the manifest-owned **version text loop** did not change the revealed UI. Config's initial `setVersion()` corrected the legacy string and all semantic fields while the UI remained hidden. The manifest's separate legacy image final sweep `document.querySelectorAll('img').forEach(upgradeImage)` must **not** be removed. The first-paint guard, `workboard:assets-ready`, double-rAF reveal, four-second safety fallback, focus/pageshow drift recovery and config startup sync all remain independently required.

Historical acceptance decision: Ver.277 could retire only the redundant manifest version text loop, not its entire `DOMContentLoaded` handler. Later Ver.278 separately examined the post-load sync; do not read Ver.276 as authorising deletion of both calls. Historical PR #164 / Regression #644: Protocol 262 pass / 0 fail, Browser 192 pass / 55 skipped, Firebase Emulator success.

## Ver.278 — post-load `setVersion()` independent value (historical release 261)

After Ver.277 had removed the manifest's premature text write, `config.js` still invoked `setVersion()` at the start of `start()` and a second time after the stylesheet/script/mobile loads but before `notifyAssetsReady()`. A Playwright-intercepted copy suppressed only the **second** invocation.

The measured initial call had already established complete text, semantic class, title, dataset, and global version `Ver.261`; the asset loader did not regress those values. With the post-load call suppressed, first-paint reveal was identical and deliberate version drift still recovered through `focus` or `pageshow` independently. Thus 後段 `setVersion()` に独立したユーザー可視・復旧価値は確認できない.

Historical product decision: Ver.279製品として後段 `setVersion()` だけを撤去. **Keep** the startup `setVersion()`, focus/pageshow handlers, first-paint guard, assets-ready reveal, legacy image final sweep, four-second fallback, asset order, Firebase and business write paths. This was a historical release 262 proposal, not an instruction to change current release values. Historical PR #166 / Regression #651: Protocol 266 pass, Browser 194 pass / 55 skipped, Firebase Emulator success.

## Ver.284 — brand cold boot versus BFCache `pageshow` (historical release 264)

Following Ver.283, `brand-v185.js` initialised with one startup `apply()`, then a regular cold boot `pageshow` (`persisted=false`) invoked another `apply()`. Only the equivalent `data-brand-version` dataset mutation recurred; the brand mark, canonical four favicon links, and Notification wrapper were already correct from startup.

The audit suppressed only the first non-persisted pageshow in an instrumented test copy; the resulting visible brand state matched baseline. cold boot初回pageshowを実行しなくても、startup `apply()` だけで最終canonical状態は完全に成立した.

In a separate synthetic-drift test, BFCache-like `pageshow` (`persisted=true`) repaired brand, favicon and Notification. BFCache相当のpersisted pageshow recoveryには独立した復旧価値がある.

Ver.285製品化候補: `persisted=false` は `apply()` を再実行しない; `persisted=true` では従来どおり `apply()` を実行する. Never remove the required startup apply or the persisted pageshow recovery path. Historical Regression #677: Protocol 280 pass / 0 fail, Browser 201 pass / 55 skipped, Firebase Emulator success.

## Current owners, retention, and gates

- Current product owners: `release-manifest.js`, `config.js`, `brand-v185.js`, `index.html`, `patch-responsibilities.json`; keep actual runtime behavior unchanged.
- Current regression owners: `test-harness/first-paint-version-handoff-v276.test.mjs`, `test-harness/postload-version-sync-v278.test.mjs`, `test-harness/brand-dataset-idempotency-v286.test.mjs` and their Browser tests. Existing assertions remain byte-for-byte unchanged; only historical note read paths change.
- New archive is inventoried by Stage E fail-closed audit to forbid root reintroduction or active-code references. Dedicated test pins all three original blob hashes, byte counts, recovery links and the distinct **KEEP** versus **REMOVE ONLY** decisions.
- No product JavaScript, HTML, CSS, Release304/manifest, Pages payload/workflow, Firebase Authentication/Rules/writers, user data, or deferred security configuration changes.
- Require exact PR-head Protocol, Browser (1)/(2), Firebase Emulator, final Regression all success; expected-head merge; same-SHA main Regression and Pages build/deploy with unchanged payload SHA-256; dedicated identical backup checkpoint.
