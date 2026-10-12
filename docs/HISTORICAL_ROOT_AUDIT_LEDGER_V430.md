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
