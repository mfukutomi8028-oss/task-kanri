# Ver.373 preparation: completed board scope (Issue #280)

Date: 2026-10-09. This is a test-only candidate validation, not a product release or formal completion checkpoint.

## Baseline

- Main: `4a70183a29e61605faf881b28ddacfe26d1e6cb7` (Ver.372 notification focus improvement, PR #279).
- PR #279 exact head `28cc29f14fb9bf036115e3475a2f155a8316178a` passed Protocol, Browser Regression and Firebase Emulator in run `37874804792` before merging.
- Ver.372 main Regression: `37876056374`, still running when this record was prepared. Pages `37876056498` succeeded. Do not treat the main regression or checkpoint as complete based on this document.
- Release / responsibility baseline remain **299 / 299**.
- Product `app.js` blob: `9aa614ffe4aa76a5b852794a70d31b26a1a10b8f`.
- Restore: `backup/ver372-before-v373-board-scope`; work branch: `fix/ver373-completed-board-scope`.

## User-facing problem and bounded candidate

The canonical task query recognizes both `done` and `mineDone`, while `renderBoard()` checks only `state.scope === "done"` for the visible columns and section-add affordance. With the combined mine/completed scope, the query selects the user's completed task but the board generates no matching card. A list view can therefore contain the same task that the board appears to lose.

The candidate uses `scopeHasDone() || isCompletedStatus(elements.statusFilter.value)` for both board decisions, matching the query's existing completion predicate. Retaining the detailed status condition matters when the completed status remains selected after the completed navigation toggle is turned off.

No query, data writer, Firebase operation, task schema, sorting, archival rule, reserved-task rule, list renderer or timeline renderer is changed. The candidate transformation checks its exact source anchors and changes only the existing `renderBoard()` function; it adds no runtime sidecar.

## Verification boundary

- Local Node source-level reproduction: legacy `mineDone` selects one task but emits zero cards. The candidate matches the unchanged query in all **12** combinations of four scopes and three status selections. All code outside `renderBoard()` is byte-identical. Reapplying the candidate or using missing source anchors is rejected.
- Local Protocol / release-contract: **482 / 482 passed**, no failures or skips, on the Ver.372 Pages source plus these test-only files. The exact GitHub `pages.yml` blob `08924c89f251f3f6dd5ebd51e3dbcfeb385c56ab` was supplied because Pages artifacts omit `.github`; the assertion was not weakened.
- Pages ZIP SHA-256 verified: `ad18993e587841ec91cb7a334038ed5ea17e62aec45206e29a2ac006e7185ba3`. The manifest, baseline and product source match the expected Ver.372 blobs.
- New JavaScript files pass `node --check`.
- Full-app local browser navigation was denied with `ERR_BLOCKED_BY_ADMINISTRATOR`; no alternate route was used to bypass it. No new full-app browser result is claimed locally.
- `tests/completed-board-boundary-v373.spec.mjs` adds **13 CI cases**: one source matrix case, four unmodified-product reproductions, and eight candidate browser cases across 1366px and 390px.
- Browser cases use real navigation, both mine/done selection orders, board/list transitions, individual filter restoration, detailed status, search, reset, reload, archived/reserved exclusions, mobile tabs and task-cache preservation. Candidate source is substituted only inside the test browser's localhost `app.js` response; repository runtime files remain untouched.
- Tests seed synthetic local-only data, disable Firebase configuration and abort every non-local network request, including candidate fetches. Existing Firebase Emulator tests remain part of the full CI. Production Firebase is never used or changed.

## Acceptance and promotion

Keep this work separate from Ver.372's post-merge acceptance. This validation may run in parallel, but no additional runtime change may merge before Ver.372's main Regression, Pages, release/baseline and checkpoint are verified.

A successful candidate CI is not a shipped fix. After all required CI stages pass and the baseline browser cases reproduce Issue #280, promote the proven predicate directly into the existing `app.js`, update Release / baseline together, and replace the legacy/candidate-only expectations with durable product regression coverage. Recheck the exact diff, PR head and main, then require exact-head merge, main Regression, Pages and a formal checkpoint. Keep Issue #280 open until the product fix is actually accepted.

Do not extend this change into generic Observer cleanup or a navigation redesign. Any similar timeline behavior requires its own reproduced user flow and must not be silently included here.
