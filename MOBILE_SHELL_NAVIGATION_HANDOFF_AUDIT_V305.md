# Ver.305 mobile navigation handoff audit

## Baseline

- Product baseline: Ver.304 / release 273
- Product runtime under audit: `mobile-shell-v234.js`
- Canonical navigation/render owner: `app.js`
- Audit-only branch: product runtime and release remain unchanged

## Current ordering

`bindGlobalClicks()` currently listens on `document` in the capture phase. It therefore sees `.nav-item` clicks before the canonical target listener in `app.js` runs. To wait until `app.js` has synchronously updated `state.layout`, called `syncNavigationUi()`, and completed `render()`, mobile-shell defers these three reconciliation steps with `setTimeout(..., 0)`:

- `closeMobileMenu()`
- `syncMobileHeaderTitle()`
- `patchMobileBoardTabs()`

The browser audit confirmed this ordering directly: immediately after the current capture-path `nav.click()` returns, the mobile drawer/title are still pre-reconciliation; after the zero-timeout callback runs, the drawer closes, the title matches the active navigation item, and board status tabs are canonical.

## Candidate audited

Only the Playwright-served audit copy of `mobile-shell-v234.js` was changed. The candidate:

1. moves the delegated navigation listener from document capture to normal document bubble phase;
2. removes `setTimeout(..., 0)`;
3. runs `closeMobileMenu()`, `syncMobileHeaderTitle()`, and `patchMobileBoardTabs()` synchronously.

Because the canonical navigation listener is attached directly to each `.nav-item`, the target listener completes first. The event then bubbles to `document`, so mobile reconciliation naturally runs after the canonical `syncNavigationUi()` and `render()` without a later task.

## Browser evidence

The route-local bubble-phase candidate preserved all audited boundaries:

- Tasks navigation closes an open mobile drawer in the same click task;
- mobile header title matches the canonical active navigation immediately;
- board status tabs and active column are already reconciled when the click returns;
- Tasks -> Today removes board status tabs and the active board column synchronously;
- 861px -> 860px conditional late loading still loads `mobile-shell-v234.js` exactly once;
- after that late load, the same synchronous navigation handoff remains valid.

The existing capture path was also kept as a baseline test and demonstrated why its current zero-timeout exists: capture runs too early for synchronous reconciliation.

## Regression result

Regression #784 on the audit head completed successfully:

- Protocol and release-contract tests: success
- Browser regression smoke tests: success
- Firebase Emulator write tests: success

## Product gate

Ver.306 may replace only the navigation reconciliation inside `bindGlobalClicks()`:

- document capture listener -> document bubble listener;
- remove the navigation `setTimeout(..., 0)`;
- keep the same three reconciliation calls and their order.

The following boundaries must remain unchanged during productization:

- one-shot global click binding guard;
- mobile drawer close behavior;
- mobile header title synchronization;
- board status-tab reconciliation and semantic board observer;
- resize reconciliation;
- Ver.304 synchronous Schedule create handoff;
- 860/861px conditional mobile-shell loading;
- Firebase, task persistence, workflow, notification, and all business-data write paths.

Ver.305 itself is audit-only: `mobile-shell-v234.js`, release manifest value 273, and `baselineRelease` 273 are not changed by the audit.
