# Ver.323 Desktop Sidebar Global Listener Audit

## Scope

Ver.318 completed the semantic takeover for `desktop-sidebar-v242.js`. The remaining cleanup candidate is the lifetime of the three document-level listeners still owned by the preserved V158 desktop sidebar core:

- `document.keydown` for Escape collapse
- capture `document.dragend` for drag-reveal cleanup
- capture `document.drop` for drag-reveal cleanup

This Ver.323 checkpoint is audit-only. It does not change production runtime, release inventory, Firebase behavior, or task/schedule data paths.

## Current product observation

The current owner binds all three listeners once during sidebar startup and never removes them. Because the sidebar element exists at every width, the listeners remain active:

1. while the desktop sidebar is collapsed and idle;
2. while the sidebar is pinned, where Escape/drag cleanup cannot collapse it;
3. after crossing below the 861px desktop boundary.

`tests/sidebar-global-listener-audit-v323.spec.mjs` instruments the real loaded `desktop-sidebar-v242.js` and verifies that unrelated keydown / dragend / drop events still wake these callbacks in those idle states.

## Candidate lifecycle

The audit also injects a non-product candidate implementation into the fetched runtime. The candidate binds the same three document listeners only while all of the following are true:

- desktop media query matches;
- sidebar is not pinned;
- sidebar is expanded.

`applyState()` is the synchronization boundary because all existing expand/collapse, pin/unpin, and media-change paths already converge there.

The candidate intentionally keeps all three listeners as one lifecycle group rather than splitting keyboard and drag ownership further. This is the smaller and safer first reduction: it removes idle/background wake-ups without introducing an additional drag-session state machine.

## Required behavior held by the audit

The candidate must preserve these existing contracts before productization:

- collapsed desktop sidebar has zero document-listener wake-ups;
- keyboard focus expands the sidebar;
- Escape collapses an unpinned expanded sidebar without discarding keyboard focus;
- dragenter reveals the sidebar and document dragend still permits delayed collapse outside the sidebar;
- pinning removes transient document ownership and Escape does not collapse pinned state;
- crossing 861 -> 860 releases any active document ownership;
- non-desktop startup has no desktop-sidebar document listener traffic.

## Decision

If the Ver.323 PR regression remains green, the lifecycle reduction is considered safe enough for a separate product checkpoint. The next product step should move the three existing document listeners behind the audited `media.matches && !pinned && expanded` lifecycle, add a protocol ownership guard, then run the full Browser + Firebase Emulator regression before merging.

No product runtime is changed in Ver.323 itself. This keeps the audit evidence independent from the subsequent implementation and preserves a clean rollback boundary.
