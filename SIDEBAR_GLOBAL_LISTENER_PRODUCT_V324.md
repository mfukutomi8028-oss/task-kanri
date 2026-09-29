# Ver.324 Desktop Sidebar Global Listener Product

## Product change

Ver.323 measured three long-lived `document` listeners in `desktop-sidebar-v242.js`: Escape `keydown`, capture `dragend`, and capture `drop`. They stayed active while the sidebar was collapsed, pinned, and below the 861px desktop boundary.

Ver.324 promotes the audited lifecycle into the product runtime. The three listeners are now owned as one transient group and are present only while:

- the desktop media query matches;
- the sidebar is expanded;
- the sidebar is not pinned.

All state changes continue to converge through the existing `applyState()` path, so expansion/collapse, pin/unpin, media transitions, and pageshow recovery synchronize the listener lifecycle without a second state machine.

## Preserved behavior

The implementation deliberately leaves these existing contracts unchanged:

- pointer and keyboard reveal behavior;
- Escape collapse while keyboard focus remains on the navigation item;
- dragenter reveal and delayed dragend/drop collapse cleanup;
- pinned preference and pin/unpin persistence;
- exact desktop/mobile boundary at 861/860px;
- mobile-shell conditional loading and navigation ownership;
- Firebase and all business-data write paths.

## Regression ownership

`test-harness/sidebar-global-listener-product-v324.test.mjs` guards the source-level ownership boundary and retains the Ver.323 audit as evidence.

`tests/sidebar-global-listener-product-v324.spec.mjs` exercises the real product runtime and verifies:

1. collapsed desktop and mobile states own zero target document listeners;
2. keyboard expansion owns exactly the transient group until Escape collapse;
3. drag reveal keeps cleanup ownership until dragend and then releases it;
4. pinning and 861 -> 860 release transient ownership;
5. repeated expand/collapse cycles do not accumulate active listeners.

## Release and rollback

- Product release: 280
- Responsibility baseline: 280
- Rollback branch: `backup/ver323-before-sidebar-listener-product-v324`
- Product branch: `product/sidebar-global-listeners-v324`

The next cleanup step is a final cross-inventory audit. It should re-scan live dynamic/conditional assets and remaining long-lived listener, observer, and timer ownership before declaring the cleanup track complete.
