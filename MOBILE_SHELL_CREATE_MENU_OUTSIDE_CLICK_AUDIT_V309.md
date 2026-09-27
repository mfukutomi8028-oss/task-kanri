# Ver.309 create-menu outside-click lifecycle audit

## Baseline

- Product baseline: Ver.308 / release 275
- Main checkpoint: `b953236fedf5dbc963895386515a7bbea015a321`
- Product runtime under audit: `mobile-shell-v234.js`
- Ver.309 is audit-only. Product runtime and release stay unchanged.

## Current responsibility

`ensureMobileHeader()` installs a document-level `click` listener for the lifetime of the loaded mobile shell. The callback wakes on every document click and only then checks whether the target is outside `#workMobileHeader` before calling `closeCreateMenu()`.

The listener is useful only while `#workMobileCreateMenu` is open. While the create menu is closed, those document-wide callbacks have no user-visible work to perform.

## Candidate under audit

The route-local candidate keeps the same outside-click target test but narrows the listener lifecycle:

1. no outside-click listener is registered while the create menu is closed;
2. opening the create menu registers one document `click` listener;
3. closing by outside click, create action, Escape, or another close path removes that listener;
4. repeated open/close cycles must not accumulate listeners.

This is intentionally a lifecycle audit rather than a simple `document -> body` target move. A body-level permanent listener would still wake for essentially every normal application click and would provide little value.

## Required browser evidence

The audit must verify both current and candidate behavior:

- the current product listener wakes for ordinary outside clicks even while the create menu is closed;
- the candidate has zero outside-click callbacks while the create menu is closed;
- opening the create menu enables exactly one outside-click listener;
- a click inside the mobile header does not dismiss the menu;
- a click outside the header dismisses the menu and removes the listener;
- Escape dismisses the menu and removes the listener;
- Schedule create still closes the menu and opens the canonical Schedule dialog;
- repeated open/close cycles do not duplicate callback execution;
- 861px -> 860px conditional mobile-shell loading still installs the candidate correctly;
- desktop-width behavior remains unchanged.

## Non-target boundaries

Do not change or reassign ownership of:

- canonical navigation in `app.js`;
- Ver.308 `.nav`-scoped navigation reconciliation;
- task or Schedule create semantics;
- mobile drawer behavior;
- status-tab observer or resize reconciliation;
- 860/861px conditional loading;
- Firebase, persistence, workflow, notifications, or any business-data write path.

## Product gate

If Protocol, Browser regression, and Firebase Emulator checks are all green with the lifecycle candidate, Ver.310 may promote only this listener lifecycle narrowing. Release and `baselineRelease` remain 275 in Ver.309.