# Ver.314 Work Features observer boundary audit

## Baseline

- Base: Ver.313 main `ca1091387c1b4874e989635641390c3d54d1cf65`
- Product release / responsibility baseline: `277`
- Target: `work-features-v167.js`
- Product runtime is not changed in this audit.

## Current responsibility

`observeCoreDom()` owns one long-lived `MutationObserver` and observes both `#mainContent` and `#detailBody` with `{ childList: true, subtree: true }`.

The callback reconciles several work-feature concerns after DOM replacement:

- business memo navigation/view availability
- task start-date field bridge
- memo-mode navigation state
- reserved/future-task visibility and counts
- start-date display in task detail

Ver.244 already removed the earlier app-shell-wide observation. The remaining question is whether obvious work-feature-owned mutations still wake this core observer unnecessarily.

## Candidate under audit

Do **not** narrow either observed root and do not change canonical render ownership.

Instead, test a minimal semantic guard at the callback boundary:

- when every delivered mutation is contained inside `#workMemoViewV167`, return without scheduling the core reconciliation frame;
- all other `#mainContent` and `#detailBody` mutations retain the current behavior.

This candidate is intentionally narrow. Business memo rendering already updates its own view synchronously through `renderMemoView()`, so a mutation fully inside that owned view should not need to re-run task/start-date/future-task reconciliation.

## Browser evidence required

The audit must demonstrate both sides of the boundary in a real browser:

1. Current Ver.313/277 behavior: a descendant mutation inside `#workMemoViewV167` reaches the core observer and schedules its reconciliation frame.
2. Candidate behavior: the same memo-owned mutation reaches the observer but schedules **no** core reconciliation frame.
3. Candidate behavior: an unrelated/non-memo mutation under `#mainContent` still schedules reconciliation.
4. Candidate behavior: a mutation under `#detailBody` still schedules reconciliation.
5. Memo navigation/view remains usable and `#taskStartDateV167` remains available.
6. Observed roots remain exactly `#mainContent` and `#detailBody`; this audit must not broaden scope.

## Boundaries

- `work-features-v167.js` remains unchanged in Ver.314.
- `release-manifest.js` remains release `277`.
- `patch-responsibilities.json` baseline remains `277`.
- Firebase paths, memo/task/start-date persistence, transactions, and cleanup logic are unchanged.
- No canonical task, board, dashboard, detail, or memo renderer is replaced.

## Decision gate

If Protocol, Browser, and Firebase Emulator regression are all green and the browser audit proves that only memo-owned self-mutations can be suppressed while main/detail recovery remains intact, the candidate is eligible for a later productization step. If those conditions are not met, keep the Ver.313 observer unchanged.
