# Ver.372 - Personal inbox keyboard and focus behavior

## Baseline and gate

- Original product baseline: `f9bdfd1e693592d97af5e6727f50f6efdc1b1dfc` (PR #277 / Ver.371, Release 298).
- PR #277 was merged with exact head `b3823d9532967b47d443366a0feaa729b01c5820` after Protocol, Browser Regression and Firebase Emulator succeeded in run `37870596424`.
- Its main Regression `37871836732` failed in the older Ver.316 clock-audit isolation test; Pages `37871836780` succeeded. That failed run is not a formal checkpoint.
- Recovery PR #278 passed all three CI stages in run `37873087878` at exact head `b144ad6368f7ee5aff39c76dd594ec16234c609a` and was merged into main `4334f19de574f34b8d1cb57c49902b3df07eac0e`. It only changes tests and the recovery record `CI_RECOVERY_V371.md`.
- At this document update, recovery main Regression `37874221287` is still running; Pages `37874221228` has passed build and deploy. Release / baseline are 298 / 298. Ver.371 formal completion still requires that main regression and `backup/ver371-checkpoint`.
- PR #279 is now targeted at the recovered main. Fresh PR validation may run in parallel while this PR remains Draft. This replaces the earlier serial retarget schedule, not the acceptance gate: do not mark the product complete or merge until Ver.371 is a verified checkpoint and this exact PR head passes all required CI.
- Original restore branch: `backup/ver371-before-v372-inbox-focus`.
- Additional pre-retarget restore: `backup/ver372-before-v371-recovery-sync` at `3474005f850d93950df7fb68221609f89ba7099c`.
- Work branch: `fix/ver372-inbox-keyboard-focus`.
- Candidate Release / responsibility baseline: **299 / 299**.

## Reproduced product problem

The existing inbox declared `aria-modal="true"` but did not explicitly manage focus. Isolated Chromium running the actual Ver.371 inbox source and styles at 1366px and 390px reproduced all three failures: opening left focus outside the drawer, Tab from the last action escaped the drawer, and Escape did not restore the opener.

This is an interaction fix, not another generic Observer cleanup. Layout, labels, notification categories, unread/all filters and task navigation remain unchanged.

## Selected implementation

- Move focus to the existing close button when opened; contain Tab and Shift+Tab within currently visible, enabled controls.
- Make the existing app shell and mobile header/overlay inert only while the drawer is open. Restore only inert state owned by this drawer, preserving pre-existing inert state.
- Restore the opener on close, or the rebuilt inbox entry / a visible navigation control when the original opener no longer exists.
- On notification list replacement, restore the same notification action by semantic ID. If the action disappears or is disabled, use the current filter or close button without stealing a valid focus already inside the panel.
- Replace the old permanent Escape handler with open-only keyboard and focus listeners. Repeated open is idempotent; closing removes both listeners. No new Observer or timer is introduced.
- Yield focus and Escape to an open native dialog. Leave the separate status/toast layer outside background inert ownership.

A native `<dialog>` conversion was not selected: it would change the layer relationship with the existing body-level save-error feedback and require a broader visual/lifecycle migration. The current drawer is retained for this bounded improvement.

Reference: W3C WAI-ARIA APG [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), checked 2026-10-09. The reference informs focus entry, contained tab order, close behavior and fallback focus; this is not a claim of complete WCAG or screen-reader certification.

## Preserved responsibilities

`workflow-v152.js`, Firebase paths and transactions, `expectedReadAt`, individual/all read semantics, Ver.371 busy-state recovery, persistence, notification delivery, task data and existing native dialog lifecycle are unchanged. Tests use synthetic local data only; production Firebase is never contacted or modified.

## Verification performed before draft PR

- JavaScript syntax: modified inbox source, release manifest and new browser spec pass `node --check`.
- Protocol / release-contract: **482 / 482 pass** (including the separate PR #278 recovery tests). The Pages artifact omits `.github`; the exact current `pages.yml` was supplied to the local fixture (blob `08924c89f251f3f6dd5ebd51e3dbcfeb385c56ab`) rather than weakening the workflow assertion. GitHub CI remains the complete-checkout authority.
- Isolated real Chromium with actual inbox JS/CSS: **14 grouped checks pass**, seven at each of 1366px and 390px. Covers repeated open/close and listener cleanup, forward/reverse Tab, blocked background focus, live row replacement, empty list, pending-operation failure, rebuilt opener, preservation of existing inert state, native dialog Escape, status-layer availability, task handoff, page errors and horizontal overflow. Persistence in this isolated fixture is a stub, not an Emulator result.
- Added `tests/inbox-keyboard-focus-v372.spec.mjs`: **10 full-app regression cases**, five per viewport, including canonical local-only read/unread and task opening. These tests abort every non-local request.
- Full-app local navigation is blocked by the managed browser (`ERR_BLOCKED_BY_ADMINISTRATOR`). It was not bypassed. Full Browser Regression and Firebase Emulator results must be obtained from PR CI; isolated checks are not a substitute.
- Real mobile devices, Safari/Firefox and screen readers have not been tested in this change.

## Retarget review on 2026-10-09

- Compared the candidate against recovered main: only the five intended notification files differ. Recovery test changes are already in main and are not a new product modification here.
- The local review copy of `inbox-ui-v183.js` matches PR blob `20b05fd54fad976fd9aafcdc21a7d1aa9591c97c` exactly. The retarget document commit changes no runtime, CSS, tests or version number.
- Independently reran the existing inbox boundary, user-UX ownership and Ver.371 clock-recovery Node tests: **15 / 15 passed**, no skips. This is a focused source-level check, not the full 482-test suite or browser testing.
- Rechecked manifest / baseline alignment (main 298 / 298; candidate 299 / 299) and confirmed canonical task, workflow, configuration and event-delivery files are unchanged in the review copy.
- Retried one ordinary localhost full-app navigation in the current managed environment: it was denied with `ERR_BLOCKED_BY_ADMINISTRATOR`. No browser tests completed in that attempt and no alternate route was used to bypass the restriction.
- After base retargeting, this documentation commit triggers fresh PR CI under the existing main-targeted workflow. Record the actual run and exact head in PR #279; do not assume that merely retargeting or leaving Draft starts a successful test run.

## Acceptance and next work

Merge only after Ver.371 is a verified checkpoint and all three Ver.372 PR CI stages are green for the exact head. Recheck main and head immediately before exact-head merge. Then require the new main Regression, Pages, Release / baseline 299 / 299 and `backup/ver372-checkpoint` before declaring Ver.372 complete.

The next product candidate is Issue #280: the actual `getFilteredTasks()` and `renderBoard()` functions disagree for `mineDone` (one matching completed task, zero task cards in generated board HTML). This was reproduced in a Node VM with synthetic dependencies, not a full browser. Validate the user flow in CI before fixing it as a separate bounded change. Keep archive / reserved-task semantics and data writes untouched. The broader Today / Tasks discovery work in `DEVELOPMENT_PLAN_V371.md` follows; do not reopen generic Observer reduction without a measured user-facing problem.
