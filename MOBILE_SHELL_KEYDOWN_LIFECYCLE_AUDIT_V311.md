# Ver.311 Mobile shell keydown lifecycle audit

## Base

- Base checkpoint: Ver.310
- Base main SHA: `310967c31004a02a5f79bb19a2b78ccd4ff2a1f2`
- release / baselineRelease: `276`
- Product runtime is not changed in this audit.

## Current responsibility

`mobile-shell-v234.js` installs one permanent `document` `keydown` listener when the mobile header is created. The listener only has semantic work for `Escape`, but it wakes for every keydown for the rest of the page lifetime even when both mobile drawer and create menu are closed.

## Candidate

Audit a transient Escape listener whose binding is derived from the actual UI state:

- bind when `body.work-mobile-menu-open` OR `#workMobileCreateMenu.open` is true
- keep exactly one document listener when both are open
- remove when both become closed
- derive state from the DOM instead of independent drawer/menu booleans
- call the same sync after `closeMobileMenu()`, `toggleCreateMenu()`, and `closeCreateMenu()`

This keeps state transitions safe when opening the drawer closes the create menu, when both transient surfaces overlap briefly, and when Escape closes them sequentially.

## Browser evidence required

1. Current Ver.310 permanent listener wakes on a non-Escape key while both transient surfaces are closed.
2. Candidate has zero keydown callbacks while both are closed.
3. Opening the create menu binds once; non-Escape keeps it open; Escape closes and unbinds.
4. Opening the mobile drawer binds once; Escape closes and unbinds.
5. Drawer + create-menu overlap still owns only one listener.
6. Overlay and navigation close paths remove the listener.
7. Repeated open/close cycles do not accumulate listeners or callbacks.
8. 861 -> 860 late mobile-shell loading keeps the lifecycle correct.
9. Desktop width does not load the mobile shell or bind the listener.

## Boundaries

- Do not modify `mobile-shell-v234.js` in Ver.311.
- Do not change `release-manifest.js`, `release-manifest.json`, release, or baselineRelease.
- Preserve Ver.310 transient create-menu outside-click ownership.
- Preserve Ver.308 nav-scoped click delegation.
- Preserve task, schedule, Firebase, notification, and persistence write paths.

## Product gate

If Protocol, Browser, and Firebase Emulator regressions are green and the candidate proves the evidence above, Ver.312 may productize only this Escape-listener lifecycle narrowing and advance release / baselineRelease from 276 to 277.