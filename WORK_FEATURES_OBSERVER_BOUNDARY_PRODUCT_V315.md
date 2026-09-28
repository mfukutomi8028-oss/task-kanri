# Ver.315 Work Features Observer Boundary Productization

## Purpose

Productize the Ver.314-audited semantic guard in `work-features-v167.js` so memo-owned render mutations no longer wake the core work-feature reconciliation path.

## Product change

- Keep the long-lived core observer rooted at `#mainContent` and `#detailBody`.
- Receive the MutationRecord batch in the product callback.
- If every mutation target belongs to `#workMemoViewV167`, return before scheduling the reconciliation frame.
- Mixed batches and mutations outside the memo view continue through the existing reconciliation path.
- The existing requestAnimationFrame dedupe, observer disconnect/re-observe cycle, navigation binding, start-date UI recovery, and future-task UI reconciliation remain unchanged.

## Preserved boundaries

Firebase paths, memo and start-date transactions, canonical task persistence, and orphan cleanup are unchanged.

No canonical task, board, dashboard, detail, or memo renderer is replaced. The observer continues to watch only the existing `#mainContent` and `#detailBody` subtree roots.

## Regression promotion

The Ver.314 semantic candidate is promoted to the product runtime. Ver.315 Browser regression verifies the real `work-features-v167.js` behavior:

- memo-owned-only mutation batches invoke the observer but schedule no core reconciliation frame;
- non-memo `#mainContent` mutations still reconcile;
- `#detailBody` mutations still reconcile;
- mixed memo/non-memo batches still reconcile;
- the Work Memo route and `#taskStartDateV167` remain available;
- observer root identity and options remain unchanged.

## Release

Release and responsibility baseline advance from 277 to 278.

## Rollback

`backup/ver314-before-work-features-observer-v315`

## Gate

Merge only the exact product branch head after Protocol, Browser, and Firebase Emulator regression checks are green. After merge, verify main Regression and GitHub Pages before recording the Ver.315 checkpoint.
