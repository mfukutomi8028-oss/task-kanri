# Ver.324 Desktop Sidebar Global Listener Lifecycle Productization

## Purpose

Productize the Ver.323 audit result by removing permanent document-level `keydown`, `dragend`, and `drop` ownership from the desktop sidebar when those callbacks cannot do useful work.

The sidebar only needs these global listeners while it is on the desktop side of the 861px boundary, expanded, and not pinned. Collapsed, pinned, and mobile states can remain entirely idle at the document level.

## Product change

- Add named Ver.324 document handlers for Escape, drag-end, and drop cleanup.
- Add one idempotent lifecycle synchronizer derived from `media.matches && !pinned && expanded`.
- Bind the three document listeners only when that predicate becomes true.
- Remove the same three listeners as soon as the sidebar collapses, becomes pinned, or leaves the desktop boundary.
- Keep sidebar-local pointer, focus, drag, click, timer, and pin listeners unchanged.

## Preserved responsibilities

The change does not alter:

- the exact 861px desktop / 860px mobile boundary;
- hover and pointer reveal/collapse behavior;
- keyboard-focus expansion and Escape collapse;
- focus preservation after keyboard Escape;
- drag reveal and post-drag collapse;
- pointer-navigation blur handling;
- pin/unpin persistence and presentation;
- pageshow state correction;
- delayed mobile-shell handoff;
- Firebase paths, task/ToDo/schedule/memo persistence, or canonical renderers.

## Regression promotion

The Ver.323 injected candidate is replaced by product regression against the real runtime. Ver.324 Browser regression instruments only the three named product handlers and verifies:

- a settled collapsed desktop sidebar owns zero Ver.324 document listeners;
- keyboard expansion binds exactly three listeners and Escape releases all three while preserving focus;
- drag reveal binds the same lifecycle and drag-end cleanup releases it after collapse;
- pinning releases transient document ownership;
- crossing 861 -> 860 releases transient document ownership;
- a mobile cold boot starts with zero Ver.324 document listener ownership.

Protocol regression additionally locks the source boundary so the old anonymous permanent document listeners cannot silently return.

## Release

Release and responsibility baseline advance from 279 to 280.

## Rollback

`backup/ver323-before-sidebar-listener-product-v324`

## Gate

Merge only the exact product branch head after Protocol, Browser, and Firebase Emulator regression checks are green. After merge, verify main Regression and GitHub Pages before recording the Ver.324 checkpoint.
