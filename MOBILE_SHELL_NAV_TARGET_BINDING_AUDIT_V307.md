# Ver.307 mobile navigation target-binding audit

## Baseline

- Product baseline: Ver.306 / release 274
- Runtime under audit: `mobile-shell-v234.js`
- Canonical navigation owner: `app.js`
- Audit-only: product runtime and release remain unchanged

## Question

Ver.306 moved mobile navigation reconciliation from a document capture listener plus `setTimeout(..., 0)` to a synchronous document bubble listener. The remaining listener is still document-wide and wakes for every click before filtering with `.closest('.nav-item')`.

Ver.307 audits whether this remaining delegated listener can be narrowed to the static `.nav-item` targets already present in `index.html` without changing behavior.

## Candidate used only by browser audit

The test harness intercepts `mobile-shell-v234.js` and temporarily replaces only `bindGlobalClicks()` with an equivalent candidate:

- keep `window.__workBoardMobileFixClicksV101` as the one-shot binding guard;
- enumerate `document.querySelectorAll('.nav-item')` once when the mobile shell starts;
- attach one bubble-phase click listener to each current nav target;
- inside that listener run the existing `closeMobileMenu()`, `syncMobileHeaderTitle()`, and `patchMobileBoardTabs()` sequence synchronously;
- do not modify `app.js`, Firebase, persistence, workflow, notifications, release metadata, or production source.

The static-target hypothesis is grounded in the current HTML: the four layout buttons and three filter buttons are present in `index.html` before application startup. The audit also covers the 861px -> 860px late-load path, where the same static targets already exist before `mobile-shell-v234.js` is conditionally loaded.

## Required evidence

The candidate must preserve all of the following in a real browser:

- Tasks navigation closes an open drawer in the same click task;
- mobile header title matches canonical navigation state immediately;
- board status tabs and active column reconcile immediately;
- Tasks -> Today removes board tabs immediately;
- a static filter nav item still closes the drawer without disturbing the current layout/title/board state;
- 861px -> 860px late mobile-shell loading binds the existing nav targets and loads the shell only once;
- Ver.304 synchronous Schedule create handoff remains intact;
- the one-shot binding guard remains present;
- release manifest and `baselineRelease` remain 274 during audit.

## Product gate

No production change is authorized by this file alone. Promotion is allowed only if Protocol, Browser, and Firebase Emulator regression all remain green and the candidate produces canonical state across the required paths. If successful, the next product version may replace the document-wide delegated navigation listener with explicit static-target bindings while preserving the one-shot guard and all non-target boundaries.
