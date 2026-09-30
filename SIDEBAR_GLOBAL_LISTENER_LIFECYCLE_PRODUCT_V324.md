# Ver.324 desktop sidebar document-listener lifecycle productization

## Scope

Ver.323 measured the active `desktop-sidebar-v242.js` owner and proved that its document-level `keydown`, `dragend`, and `drop` listeners remained registered while the desktop sidebar was collapsed and even after leaving the desktop boundary.

Ver.324 promotes only the audited lifecycle candidate. The three document listeners now exist only while all of the following are true:

- the desktop media query matches (`min-width: 861px`),
- the sidebar is expanded,
- the sidebar is not pinned.

The lifecycle is synchronized from the existing `applyState()` owner. Named handlers are added when the transient expanded state begins and removed as soon as the sidebar collapses, becomes pinned, or crosses to 860px or below.

## Preserved behavior

The product change intentionally keeps the existing desktop sidebar semantics:

- pointer hover/focus/drag reveal,
- Escape collapse while unpinned,
- keyboard focus preservation after Escape,
- pointer navigation blur/collapse behavior,
- dragend/drop delayed collapse,
- pin/unpin persistence,
- pageshow state correction,
- exact 861px desktop / 860px mobile ownership boundary,
- mobile-shell handoff.

Ver.242 text-only pin presentation remains unchanged. Firebase paths, business-data writes, task persistence, and mobile-shell persistence are outside this change.

## Release decision

The runtime file itself changes, so Ver.324 advances the release cache key and `patch-responsibilities.json` baseline together to release 280. This ensures browsers do not retain the previous `desktop-sidebar-v242.js` under the release-279 asset URL.

## Regression gate

Productization is accepted only after:

1. Protocol/release-contract tests prove the lifecycle and release/baseline alignment.
2. Browser regression proves collapsed and mobile states do not retain the three transient document listeners.
3. Browser regression proves focus/Escape, dragend cleanup, pinning, and 861→860 release behavior.
4. Firebase Emulator regression stays green even though no Firebase write path changes.
5. PR exact-head CI is green before merge, followed by main Regression and Pages verification.
