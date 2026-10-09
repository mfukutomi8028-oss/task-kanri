# Ver.373 product candidate: completed board scope and mobile exclusions

Date: 2026-10-09. Release / baseline candidate: 300 / 300. This record is not a formal completion checkpoint.

## Baseline and evidence

- Formal Ver.372 main: `4a70183a29e61605faf881b28ddacfe26d1e6cb7`, Release / baseline 299 / 299, `backup/ver372-checkpoint`.
- Ver.372 PR #279, main Regression `37876056374` and Pages `37876056498` passed before this product change.
- Initial PR #281 candidate head: `49e75c51a1ce37c510cf0760708bb74772c864bd`. Its historical preparation record remains in `COMPLETED_BOARD_SCOPE_V373.md`.
- Candidate CI `37876857383`: Protocol passed; Browser was 417 passed, 1 failed, 55 skipped; Firebase Emulator was skipped after Browser failed. This run did NOT pass the acceptance gate.
- Of the 13 added cases, 12 passed. All four unmodified-product cases reproduced Issue #280 in actual Chromium at 1366px and 390px in both mine/done selection orders. The board candidate passed its basic transitions, detailed-status, search, reset and reload cases.
- The failing case was the 390px archive/reserved exclusion check after entering list view. The trace showed `tr[hidden].workflow-task-archived-v152` remaining visible throughout the assertion, not an absence of its exclusion markers.
- Failure artifact `11592474732`, SHA-256 `b48843b4d8b7e50ae08a5af12e49dfbce9569ac15d027d9183b999a79235c57b`, was verified after download.

## Two bounded product corrections

1. In the existing `app.js` `renderBoard()`, use `scopeHasDone() || isCompletedStatus(elements.statusFilter.value)` for both the completed-column selection and section-add visibility. This matches the existing task query, including the detailed completed-status filter. All app code outside this function is unchanged.
2. In the existing `ui-mobile-shell-v234.css`, restrict only the row-grid selector to `.task-table tr:not([hidden]):not(.workflow-task-archived-v152):not(.future-task-v167-hidden)`. Its declarations stay unchanged. The previous `display: grid !important` overrode both archive and reserved-task hiding on mobile. The existing exclusion owners now retain control.

The original plan to wait for candidate-all-green before promotion is superseded by this reproduced product defect: the product PR now contains both necessary corrections and must pass a fresh complete CI run. No failed assertion is removed to make the original candidate appear green. There is no bypass of the final premerge or postmerge gates.

No task writer, Firebase operation, schema, filtering/query rule, archive or reserved-date writer, sorting, notification, list/timeline renderer, menu, observer, timer, or asset load order is changed. Legacy `mobile-fixes.js` remains byte-identical for cached-release compatibility. The existing mobile CSS equivalence test accepts exactly the new row selector and still compares every other declaration against the legacy block.

## Tests and validation before product CI

- Local Protocol / release-contract: 482 / 482 passed, no failures or skips. The local source fixture is the verified Ver.372 Pages artifact plus the changes; the exact canonical `pages.yml` was supplied because Pages artifacts omit `.github`. GitHub CI remains the complete-checkout authority.
- Actual product source matrix: 12 combinations of four scopes and three status selections match independent expected fixture IDs. The product check executes the real query and board functions without candidate transformation.
- Changed JavaScript syntax checks passed. `app.js` differs only inside `renderBoard`; CSS differs only in the row selector; release and baseline advance together to 300.
- Isolated Chromium loaded the actual CSS at 390, 860, 861 and 1366px. The old cascade exposed excluded rows at mobile widths; the revised cascade keeps hidden, archived and reserved rows hidden at all four widths while ordinary rows retain grid/table-row presentation. This is a CSS fixture, not full-app or Firebase verification.
- `tests/completed-board-boundary-v373.spec.mjs`: 13 cases (one source-matrix case and 12 full-app cases at 1366/390px) now test the actual product without source rewriting. Includes both selection orders, board/list, scope restoration, detailed status, search/reset/reload, mobile tabs, archive/reserved exclusion and unchanged task/start-date storage.
- `tests/mobile-hidden-rows-v373.spec.mjs`: four isolated CSS regressions at 390/860/861/1366px, including removal of exclusion markers and responsive transitions.
- No retry increase, fixed sleep, skip, forced click, or weaker exclusion assertion was introduced. The previously failing archive/reserved full-app assertions remain.
- Full-app local navigation is blocked by managed-browser policy (`ERR_BLOCKED_BY_ADMINISTRATOR`); the restriction is not bypassed. New full-app Browser and Firebase results must come from the product PR CI, not the local fixtures or the failed prior run.
- All new tests use synthetic local data or isolated markup and block external requests. Production Firebase is not contacted or modified. Real mobile devices, Safari/Firefox and screen readers are not verified here.

## Exact source assembly and recovery

- `app.js` blob: `e859ad787add7a0552fc14317ee6b527334352cc`.
- `ui-mobile-shell-v234.css` blob: `57d62ce174e05f1859f099a71dc00e99c42893d8`.
- `release-manifest.js` blob: `bfa5bd3fb26f1053acca44c24b1a73e67e967c78`.
- `patch-responsibilities.json` blob: `14ccf92b04debed5a83d00df6f1c249a4cc6920c`.
- To avoid manually copying the large source files through a text-only API, a one-shot utility on the separate `maintenance/ver373-source-blob` branch verified exact input/output blob hashes and created unattached blobs only. Run `37878258434` succeeded; it did not update product refs or merge. Its temporary workflow is excluded from the product tree and from main.
- The product commit is assembled via the GitHub connector from the existing PR tree, those verified blobs and checked test/document blobs. Check the final diff and exact head before merging; the source-preparation job is NOT a product test.
- Product restore: `backup/ver372-before-v373-board-scope` at the Ver.372 main.
- Pre-revision restore: `backup/ver373-before-mobile-hidden-recovery` at `49e75c51a1ce37c510cf0760708bb74772c864bd`.

## Acceptance and next work

Record the actual product head and CI in PR #281. Require Protocol / release-contract, Browser Regression and Firebase Emulator success for the exact head, recheck current main, reviews and conflicts, then exact-head merge. Afterward require the new main Regression, Pages build/deploy, Release / baseline 300 / 300 and `backup/ver373-checkpoint`. Only then mark Ver.373 complete and close Issue #280. Until then, main remains the formal Ver.372 baseline.

After acceptance, return to the Today / Tasks information-discovery work in `DEVELOPMENT_PLAN_V371.md`, prioritizing active-filter clarity and empty-result recovery. Do not add menus or reopen generic observer reduction without a measured user-facing need. Any separate timeline discrepancy requires its own reproduced user flow.
