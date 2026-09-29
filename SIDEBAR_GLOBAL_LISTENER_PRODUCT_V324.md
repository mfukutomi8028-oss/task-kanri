# Ver.324 Desktop Sidebar Global Listener Lifecycle

## Product change

Ver.323 proved that the preserved desktop-sidebar V158 core kept three document-level listeners alive even while the sidebar was collapsed, pinned, or below the 861px desktop boundary. The same audit also proved a narrower lifecycle candidate in a real browser.

Ver.324 promotes that audited lifecycle into `desktop-sidebar-v242.js`.

The following listeners are now registered as one transient lifecycle group only while the desktop sidebar is expanded and unpinned:

- `document.keydown` for Escape collapse
- capture `document.dragend` for drag-reveal cleanup
- capture `document.drop` for drag-reveal cleanup

`applyState()` remains the synchronization boundary. Every existing expand/collapse, pin/unpin, pageshow, and media-query transition already converges there, so listener ownership now follows the same canonical sidebar state without adding another state machine.

## Preserved behavior

The product regression verifies that:

- collapsed desktop state has no active Ver.324 document listeners;
- mobile/non-desktop state has no active Ver.324 document listeners;
- keyboard focus expands the sidebar and binds one listener group;
- Escape collapses the sidebar, preserves keyboard focus, and releases the group;
- drag reveal keeps `dragend` available until cleanup has been scheduled, then releases the group after collapse;
- pinning releases transient ownership and pinned Escape remains inert;
- 861 -> 860 releases any active desktop listener ownership;
- existing sidebar interaction, pin persistence, responsive behavior, semantic labels, and text-only pin presentation remain owned by their current code paths.

## Release boundary

This is a scoped maintenance change inside the existing Release 279 asset set. No asset is added, removed, or renamed, so the release manifest and responsibility baseline remain 279, consistent with the Ver.319-Ver.323 maintenance checkpoints.

Firebase configuration, Firebase write paths, task/schedule persistence, and business data semantics are unchanged.

## Rollback

Rollback branch: `backup/ver323-before-v324-sidebar-listener-product`.
