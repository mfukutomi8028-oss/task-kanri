# Ver.306 mobile navigation handoff productization

## Baseline

- Audit: Ver.305 / release 273
- Product release: 274
- Runtime: `mobile-shell-v234.js`
- Canonical navigation owner: `app.js`

## Promoted change

Ver.305 proved that the canonical `.nav-item` target listener completes `syncNavigationUi()` and `render()` before the click bubbles to `document`.

Ver.306 therefore changes only `bindGlobalClicks()` navigation reconciliation:

- document capture listener -> document bubble listener;
- retire `setTimeout(..., 0)`;
- run `closeMobileMenu()`, `syncMobileHeaderTitle()`, and `patchMobileBoardTabs()` synchronously in the same click task.

## Preserved boundaries

- one-shot global click binding guard;
- mobile drawer close behavior;
- mobile header title synchronization;
- board status tabs and semantic board observer;
- resize reconciliation;
- Ver.304 synchronous Schedule create handoff;
- 860/861px conditional mobile-shell loading;
- Firebase, task persistence, workflow, notification, and all business-data write paths.

## Regression contract

Product regression must prove:

- Tasks navigation closes an open drawer synchronously;
- header title matches the canonical active nav when the click returns;
- board tabs and active column are canonical in the same click task;
- Tasks -> Today removes board tabs synchronously;
- 861px -> 860px late loading still loads the mobile shell once and preserves the handoff;
- Schedule create still opens through the Ver.304 synchronous path;
- release manifest and `baselineRelease` are both 274;
- the navigation zero-timeout no longer exists.

## Next audit

Ver.307 should audit whether the remaining document-wide delegated navigation listener can be narrowed to explicit bindings on the static `.nav-item` set. This is audit-only until drawer close, title synchronization, board tabs, Tasks/Today navigation, Schedule create, 860/861px late loading, and one-shot binding are shown equivalent.