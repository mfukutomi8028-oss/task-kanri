# Ver.308 mobile navigation scope promotion

## Baseline

- Audit baseline: Ver.307 / release 274
- Product release: 275
- Product runtime: `mobile-shell-v234.js`
- Canonical navigation owner: `app.js`

## Promoted change

Ver.307 showed that one-time direct binding to the seven `.nav-item` buttons present at mobile-shell startup is incomplete because `work-features-v167.js` inserts an eighth Work Memo navigation item later.

The same audit proved that the stable `.nav` container can own one delegated bubble-phase listener while preserving the dynamically inserted Work Memo item.

Ver.308 therefore changes only the navigation reconciliation listener target:

- before: `document.addEventListener("click", ...)`
- after: `document.querySelector(".nav")?.addEventListener("click", ...)`

The inner `.nav-item` delegation and reconciliation order remain unchanged:

1. `closeMobileMenu()`
2. `syncMobileHeaderTitle()`
3. `patchMobileBoardTabs()`

## Preserved boundaries

- one-shot guard `window.__workBoardMobileFixClicksV101`;
- canonical `app.js` target click handlers and synchronous `render()`;
- static layout navigation and filter navigation;
- dynamically inserted Work Memo navigation;
- drawer close and mobile header title synchronization;
- board status tabs and active-column reconciliation;
- Ver.304 synchronous Schedule create handoff;
- semantic board observer and resize reconciliation;
- 861px -> 860px conditional mobile-shell loading and single load;
- Firebase, task persistence, workflow, notifications, and business-data write paths.

## Release

- release manifest: 274 -> 275
- `baselineRelease`: 274 -> 275

## Regression contract

Product regression must verify Tasks, Today, static filter, dynamic Work Memo, Schedule create, and 861 -> 860 late loading against the unmodified production source. It must also prove that `bindGlobalClicks()` no longer binds a navigation reconciliation listener to `document`.

## Next audit boundary

Ver.309 should re-audit the remaining document-level click listener installed by `ensureMobileHeader()` for create-menu dismissal. That listener currently wakes for every document click and filters with `#workMobileHeader`. The audit should determine whether its scope/lifecycle can be narrowed without changing outside-click dismissal, mobile create actions, Escape behavior, navigation, late mobile-shell loading, or desktop behavior. No product change is authorized until equivalent behavior is proven.