# Ver.318 Desktop Sidebar Semantic Takeover Productization

## Purpose

Productize the Ver.317 audit result by retiring the V158 startup semantic decoration from `desktop-sidebar-v242.js`.

The navigation buttons already own visible text, and that native text supplies their accessible names. The dynamically inserted Work Memo navigation has already operated under the same contract without `data-desktop-sidebar-label`, generated `title`, or generated `aria-label`.

## Product change

- Remove `labelNavigationButtons()` from the active desktop sidebar runtime.
- Remove its startup invocation between `ensurePinButton()` and `bindEvents()`.
- Do not relocate the three generated attributes to another global owner.
- Keep native visible button text as the navigation semantic source of truth.

## Preserved responsibilities

The change does not alter:

- desktop pin persistence;
- hover, pointer, keyboard focus, Escape, or drag reveal/collapse behavior;
- pointer-navigation blur handling;
- pageshow state correction;
- the exact 861px desktop / 860px mobile ownership boundary;
- delayed mobile-shell handoff;
- static navigation labels or dynamic Work Memo navigation;
- Firebase paths, task/ToDo/schedule/memo persistence, or canonical renderers.

## Regression promotion

The Ver.317 injected candidate is replaced by product regression against the real runtime. Ver.318 Browser regression verifies:

- static navigation exposes the expected accessible names without generated sidebar semantics;
- Work Memo remains discoverable by accessible name and opens normally;
- collapsed desktop state expands on hover and keyboard focus and collapses with Escape;
- the 861 -> 860 -> 861 ownership boundary remains intact.

Protocol regression additionally locks the source boundary so the retired function and generated semantic writes cannot silently return.

## Release

Release and responsibility baseline advance from 278 to 279.

## Rollback

`backup/ver317-before-sidebar-semantic-takeover-v318`

## Gate

Merge only the exact product branch head after Protocol, Browser, and Firebase Emulator regression checks are green. After merge, verify main Regression and GitHub Pages before recording the Ver.318 checkpoint.