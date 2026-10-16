# Historical root audit ledger — Ver.430 verified batch

Issue #292 Stage D / 2026-10-12 JST.

## Safe-batch scope and verification

The first Ver.430 attempt to archive eight V293–311 mobile-shell audits **was rejected** after eight existing Protocol tests failed while reading those former root files (Actions #38230883779). All eight were restored byte-for-byte; they are **retained, not retired**, because current tests still consume them.

The revised Ver.430 candidate archives six different audit-only reports. On the verified Ver.429 main, the expanded Ver.426 Git tracked-text reference scan reported zero exact filename owner matches for each of these six, and successor decision/product reports remain. This is a prefilter, **not proof that dynamic or external references do not exist**. Exact-head Protocol, Browser and Firebase must still pass before main integration.

This ledger and its one reusable Protocol guard are designed to accept additional verified archive rows in future batches without requiring a new validation test for every batch.

## Immutable originals and retained successors

Pinned source is accepted Ver.428 main `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c`. Six audit originals total **18,772 bytes**.

| Retired root audit | Source commit | Original Git blob SHA | Bytes | Retained follow-up decision | Fixed recovery URL |
| --- | --- | --- | ---: | --- | --- |
| `PERSONAL_REMINDER_POLLING_AUDIT_V362.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `df320d606886664523bafbf9c17ce7f71a8cfcea` | 4,334 | `PERSONAL_REMINDER_POLLING_PRODUCT_V363.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/PERSONAL_REMINDER_POLLING_AUDIT_V362.md) |
| `SCHEDULE_REMINDER_POLLING_AUDIT_V360.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `07634eb33c2d0b2517fd869f38eeb526be11adeb` | 2,849 | `SCHEDULE_REMINDER_POLLING_PRODUCT_V361.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/SCHEDULE_REMINDER_POLLING_AUDIT_V360.md) |
| `SCHEDULE_TODAY_POLLING_AUDIT_V358.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `49f7b7f4bd1f03de4187a32f31a4fa80c66737ce` | 2,614 | `SCHEDULE_TODAY_POLLING_PRODUCT_V359.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/SCHEDULE_TODAY_POLLING_AUDIT_V358.md) |
| `SIDEBAR_COMPATIBILITY_AUDIT_V289.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `696a3a20eacf26c42bff2777f7fcf4d97c06c8ac` | 1,860 | `SIDEBAR_COMPATIBILITY_RETIREMENT_V290.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/SIDEBAR_COMPATIBILITY_AUDIT_V289.md) |
| `SIDEBAR_SEMANTIC_TAKEOVER_AUDIT_V317.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `8c884bc64d3c3524d86946a09b887cf29f75a8e1` | 4,142 | `SIDEBAR_SEMANTIC_TAKEOVER_PRODUCT_V318.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/SIDEBAR_SEMANTIC_TAKEOVER_AUDIT_V317.md) |
| `WORK_FEATURES_OBSERVER_BOUNDARY_AUDIT_V314.md` | `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` | `fc07b98f803621f51c290bfa1246acfba1a87fa7` | 2,973 | `WORK_FEATURES_OBSERVER_BOUNDARY_PRODUCT_V315.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c/WORK_FEATURES_OBSERVER_BOUNDARY_AUDIT_V314.md) |

## Operating boundaries

- The retained subsequent product/decision documents stay in the root. Historic audit outcomes on Release 265–295 must not replace the current Release304 implementation contract.
- A GitHub text search with zero filename matches does not rule out GitHub PR comments, cached `blob/main/` links, bookmarks, concatenated paths or non-textual dependencies. Old URLs can break; fixed original links allow restoration.
- No app JS/CSS/HTML, manifest, Firebase/Rules, authentication, user data, or GitHub Pages runtime changes are permitted. `package.json` only registers one extra shared Protocol test in the existing single `node --test` list.
- **Keep** the V293/295/297/299/305/307/309/311 documents: Protocol still reads them. Also keep operational rollback, observer-safety and legacy-asset documents unless a separate audit establishes their status.
- Current tracked-file count falls by four net (six old docs removed, ledger and shared test added); it does not erase Git history or prove any reduction in Pages output.

## Formal acceptance and restoration

Ver.429 main `2a5622f78a0d4334ab3c7dde18e683f337ddecf5` already passed exact-SHA Protocol, Browser, Firebase, Regression and Pages, and checkpoint `backup/ver429-runtime-inventory-audits-validated-checkpoint` exists.

For Ver.430 require independent exact-head Protocol/Browser/Firebase/Regression success, expected-head main merge, main exact-SHA Regression/Pages success and a dedicated checkpoint. No merge on a red or incomplete test.

To restore, fetch the unchanged original blob from the pinned source link, place it at the historical root path, then rerun the active regressions.

## Ver.481: two superseded mobile-shell product handoffs

**Issue #292, Stage D/E.** Accepted starting point: Ver.480 main `c363d30fc9e94497e5e2ca4fd8e8160c11b30a9e`; successful same-SHA Regression and Pages, with the Ver.480 validated checkpoint. This batch re-evaluates two documents retained for additional review in the Ver.438 snapshot; that snapshot was explicitly not a permanent retention requirement.

- Ver.300's direct-child-only board observer design is already present in `mobile-shell-v234.js`, and strengthened by the semantic observer in Ver.302. Current owners: `test-harness/mobile-shell-board-observer-v299.test.mjs`, `test-harness/mobile-shell-board-observer-semantic-v302.test.mjs`, `tests/mobile-shell-board-observer-semantic-v302.spec.mjs`, and the retained Ver.313 owner audit.
- Ver.306's document-bubble navigation handoff was narrowed further to `.nav`-scoped delegation in Ver.308 without losing dynamic Work Memo navigation. Current owners: `test-harness/mobile-shell-nav-scope-v308.test.mjs`, `tests/mobile-shell-nav-scope-v308.spec.mjs`, and `MOBILE_SHELL_NAV_SCOPE_V308.md`.
- The present runtime owner and active Protocol/Browser tests stay unchanged. No tests, snapshots, release manifests, Firebase Auth/Rules/writers, production data, cache-compatible assets or Pages deployment files are removed. This is **historical root Markdown only**, not permission to delete current product responsibilities.

### Fixed originals and retained successor documents

| Retired root audit | Source commit | Original Git blob SHA | Bytes | Retained follow-up decision | Fixed recovery URL |
| --- | --- | --- | ---: | --- | --- |
| `MOBILE_SHELL_BOARD_OBSERVER_V300.md` | `c363d30fc9e94497e5e2ca4fd8e8160c11b30a9e` | `9e2b2403e3a41a0a49cb75f35e13224a4f2cb86e` | 1,756 | `MOBILE_SHELL_LONG_LIVED_RESPONSIBILITY_AUDIT_V313.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/c363d30fc9e94497e5e2ca4fd8e8160c11b30a9e/MOBILE_SHELL_BOARD_OBSERVER_V300.md) |
| `MOBILE_SHELL_NAVIGATION_HANDOFF_V306.md` | `c363d30fc9e94497e5e2ca4fd8e8160c11b30a9e` | `ba5e1a2f1314cab5752e6b85dcc9f947b5ea3df6` | 1,962 | `MOBILE_SHELL_NAV_SCOPE_V308.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/c363d30fc9e94497e5e2ca4fd8e8160c11b30a9e/MOBILE_SHELL_NAVIGATION_HANDOFF_V306.md) |

**Ver.481 originals: 2 files / 3,718 bytes.** The source commit and Git blob hashes pin byte-for-byte recovery. The existing reusable Ver.430 ledger validator checks the new row structure, original absence, successor existence, fixed recovery URLs and active-entrypoint references. The Stage E reference guard rejects reintroduced root files and live executable-code references. Any untested dynamically constructed path or external document bookmark remains a residual risk.

### Link, review and rollback boundaries

- Old `blob/main/` bookmarks and root document URLs may break. A pinned historical URL above remains available; if a hidden dependency is discovered, restore exactly the original blob to its original path and rerun all required CI.
- This batch does not alter the Release304 web runtime, the GitHub Pages packaged runtime, current tests or business information. Re-evaluate the other retained notes independently; their historic Ver.438 retention reasons still apply unless justified by a new audit.
- Acceptance requires the exact Draft-PR head Protocol, Browser shards 1/2, Firebase Emulator and final Regression success; expected-head merge; same-SHA main Regression and Pages build/deploy success; and a dedicated checkpoint matching main with zero diff. A failed or pending CI gate is not success.
