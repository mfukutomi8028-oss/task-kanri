# Ver.439 — asset inventory dynamic-declaration fidelity

Issue #292, Stage E. Baseline Ver.438 main `21c102d6ef99d41923a3f557d1b8c9cda34eae42` (same-SHA Regression and Pages success, checkpoint validated).

## Finding

The Ver.379 read-only asset inventory already parses all five release-manifest arrays, but its classification logic treats only `requiredAssets` and `optionalAssets` as active declarations. Entries solely in `dynamicStyles`, `dynamicScripts` or `mobileScripts` can therefore be misclassified as deletion-review candidates if they lack a direct literal reference in the runtime corpus.

This is an **audit fidelity** defect, not a newly discovered stale runtime asset. The legacy PNG/JS/CSS URL preservation contracts and the Pages builder use separate verification.

## Change

Use all five parsed manifest arrays for the inventory's `declared` set. Add three fixture assets declared only dynamically and assert they remain `declared-active`. The asset scanner remains strictly read-only and cannot grant deletion authorization. Keep current production `release-manifest.js` and its five lists unchanged.

Following Ver.438's categorization, retain `ASSET_RETIREMENT_AUDIT_V379.md` as the historical rationale for this scanner and `FILE_RETIREMENT_V378.md` as historic rollback/legacy-cache caution; **do not retire either in this PR**. They carry distinct information about the scanner and prior deletions. Neither should be treated as a current list of deletable files.

## Explicitly unchanged

Current app HTML/JS/CSS, Release304, Firebase/Rules and task data, Pages workflow and packaged assets, existing compatibility PNGs/SVGs, Protocol/Browser workflow definitions, and Git history.

## Acceptance

Independent exact-head Protocol, both Browser shards, Firebase and final regression all success; expected-head merge; same-merge-SHA main Regression and Pages success; verify a dedicated recovery checkpoint. If any gate is pending or fails, keep this as Draft.
