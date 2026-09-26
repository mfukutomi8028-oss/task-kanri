# Ver.289 Desktop Sidebar Compatibility Audit

## Baseline

- Ver.288 checkpoint: `fa2e2f543770f3df21e6032af573f4f3a4a5a109`
- release: `266`
- Pages #447: green
- Regression #696: green

## Audit target

`desktop-sidebar-v242.js` still contains the preserved `desktop-sidebar-compat-v159` IIFE in addition to the current V158 core.

The V158 core already owns the canonical desktop boundary with `(min-width: 861px)`, applies/removes desktop sidebar classes in `applyState()`, reacts to the media-query `change` event, and reapplies state on `pageshow`.

The V159 compatibility layer separately owns `(max-width: 860px)` and repeats mobile cleanup from additional media-change, `resize`, `orientationchange`, `pageshow`, and startup callbacks.

Ver.289 is an audit-only change. It does not remove V159 from production. Browser tests serve a temporary copy of `desktop-sidebar-v242.js` with only the V159 compatibility IIFE suppressed and verify the current behavior through the exact 860/861 boundary.

## Required evidence

With V159 suppressed only inside the audit browser:

1. 861px desktop cold boot still reaches canonical collapsed state.
2. 861 → 860 removes desktop runtime classes and `data-desktop-sidebar-state`.
3. Mobile shell still activates at 860 and remains usable.
4. 860 → 861 restores canonical desktop state.
5. A real pinned preference survives 861 → 860 → 861 and is restored when returning to desktop.
6. `pageshow` on mobile does not reintroduce desktop state.
7. Existing production runtime, release value, Firebase, and business-data write paths remain unchanged.

## Decision gate

Promote removal of the V159 compatibility IIFE only if the audit proves all boundary and pin-persistence behavior without it. If any independent compatibility value appears, keep the layer and record that result instead of forcing cleanup.
