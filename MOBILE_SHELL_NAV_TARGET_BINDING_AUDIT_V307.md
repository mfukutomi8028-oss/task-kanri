# Ver.307 mobile navigation target-binding audit

## Baseline

- Product baseline: Ver.306 / release 274
- Runtime under audit: `mobile-shell-v234.js`
- Canonical navigation owner: `app.js`
- Audit-only: product runtime and release remain unchanged

## Question

Ver.306 moved mobile navigation reconciliation from a document capture listener plus `setTimeout(..., 0)` to a synchronous document bubble listener. The remaining listener is still document-wide and wakes for every click before filtering with `.closest('.nav-item')`.

Ver.307 audits whether that delegated listener can be narrowed without losing dynamic navigation behavior.

## First candidate and red finding

The first audit candidate bound listeners directly to the seven `.nav-item` buttons present in `index.html` when `mobile-shell-v234.js` starts. Regression #799 exposed an important runtime fact: after normal asset loading there are eight `.nav-item` elements, not seven.

The eighth item is the Work Memo navigation created later by `work-features-v167.js`:

- `mobile-shell-v234.js` is a conditional mobile script and loads before normal dynamic scripts;
- `work-features-v167.js` subsequently inserts `.nav-item.work-memo-nav-v167` after Schedule;
- therefore one-time direct binding to the initial seven targets cannot own later Work Memo clicks.

The initial direct-target proposal is rejected. The red run was caused by an audit assertion that exposed this dynamic eighth target; product Ver.306 itself remained unchanged.

## Refined candidate used only by browser audit

The refined harness intercepts `mobile-shell-v234.js` and temporarily replaces only `bindGlobalClicks()` with container-scoped delegation:

- keep `window.__workBoardMobileFixClicksV101` as the one-shot binding guard;
- bind one bubble-phase `click` listener to the stable sidebar navigation container `.nav`;
- retain `event.target?.closest?.('.nav-item')` inside that container;
- inside the match run the existing `closeMobileMenu()`, `syncMobileHeaderTitle()`, and `patchMobileBoardTabs()` sequence synchronously;
- do not modify `app.js`, Firebase, persistence, workflow, notifications, release metadata, or production source.

This keeps delegation for dynamically inserted descendants while reducing the listener scope from the entire document to the navigation surface that owns those descendants.

## Required evidence

The refined candidate must preserve all of the following in a real browser:

- Tasks navigation closes an open drawer in the same click task;
- mobile header title matches canonical navigation state immediately;
- board status tabs and active column reconcile immediately;
- Tasks -> Today removes board tabs immediately;
- a static filter nav item still reconciles without disturbing the current layout/title/board state;
- the dynamically inserted Work Memo nav also closes the drawer and updates the mobile header through the same container delegation;
- 861px -> 860px late mobile-shell loading binds the stable `.nav` container once and still handles the already-created dynamic Work Memo nav;
- Ver.304 synchronous Schedule create handoff remains intact;
- the one-shot binding guard remains present;
- release manifest and `baselineRelease` remain 274 during audit.

## Product gate

No production change is authorized by this file alone. Promotion is allowed only if Protocol, Browser, and Firebase Emulator regression all remain green and the refined container candidate produces canonical state across the required paths.

If successful, the next product version may replace document-wide navigation delegation with `.nav`-scoped delegation. Direct one-time binding to the initial `.nav-item` set must not be productized because it cannot cover the later Work Memo target.
