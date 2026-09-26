# Ver.290 Sidebar Compatibility Retirement

## Scope

Ver.290 promotes the Ver.289 audit result into the active product runtime.

The only runtime removal is the preserved `desktop-sidebar-compat-v159` compatibility IIFE inside `desktop-sidebar-v242.js`.

## Canonical ownership after retirement

- `desktop-sidebar-v158` core remains byte-for-byte preserved inside `desktop-sidebar-v242.js`.
- The V158 `(min-width: 861px)` media boundary owns desktop state installation and cleanup.
- Entering 860px or below removes desktop sidebar runtime classes and `data-desktop-sidebar-state` while preserving the persisted pin preference.
- Returning to 861px or above restores the canonical desktop state from the existing V158 runtime.
- Ver.242 text-only pin startup/pageshow correction remains active.
- `mobile-shell-v234.js` remains the conditional mobile shell owner.

## Evidence carried forward from Ver.289

The Ver.289 audit served an otherwise-current runtime with only the V159 compatibility IIFE suppressed. Protocol, browser regression and Firebase Emulator suites were green. The browser audit proved:

- exact 861 -> 860 -> 861 transitions remain canonical;
- 860px mobile shell remains usable;
- a persisted pin preference survives the mobile boundary;
- persisted `pageshow` does not require the V159 listener set;
- mobile cold boot and 860 -> 861 -> 860 transitions remain canonical.

Ver.290 converts that suppression audit into a product contract: the active source must no longer contain or install V159 compatibility listeners, and the same boundary scenarios run against the unmodified product asset.

## Rollback and compatibility

The physical files `desktop-sidebar-compat-v159.js`, `desktop-sidebar-v158.js`, `sidebar-polish-v160.js` and consolidated rollback source `desktop-sidebar-v181.js` remain in the repository. They are not reactivated by the release manifest and remain available for cache/rollback compatibility.

Legacy CSS class names and the localStorage key `work-board-desktop-sidebar-pinned-v158` are unchanged.

## Release boundary

Release manifest and responsibility baseline advance from 266 to 267 so cached clients fetch the changed `desktop-sidebar-v242.js`.

No Firebase, task persistence, notification, workflow, or other business-data write path is changed by Ver.290.
