# Ver.300 Mobile Shell Board Observer Productization

## Scope

Ver.300 promotes the Ver.299 audit result into the active mobile-shell runtime.

The `#boardView` MutationObserver is narrowed from subtree child-list observation to direct-child child-list observation:

```js
new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true });
```

## Why this boundary is safe

Ver.299 proved that the previous subtree observer woke for irrelevant descendant mutations inside task cards. The direct-child candidate ignored that noise while still observing the application-owned board reconstruction boundary.

`app.js` performs canonical board rendering by replacing `#boardView` contents through `renderBoard()`. The audit verified that direct-child observation still preserves:

- filtered board redraws;
- status-tab count changes from 1 to 0 and back to 1;
- navigation away from Tasks and back to Tasks;
- reconstruction of the mobile status tabs;
- existing active-column behavior.

## Preserved responsibilities

Ver.300 does not change:

- `scheduleBoardTabs()` requestAnimationFrame deduplication;
- `patchMobileBoardTabs()` signature/count calculation;
- Ver.298 resize reconciliation for board/title/menu;
- startup `patchAll()`;
- conditional mobile-shell loading;
- navigation synchronization;
- `openNewSchedule()` 80/220/500ms retries;
- Firebase or business-data write paths.

## Release boundary

Release manifest and responsibility baseline advance from 270 to 271 so cached clients fetch the narrowed mobile-shell asset.

## Next audit

Ver.301 may measure whether direct-child observer callbacks can be further filtered by the semantic identity of added/replaced nodes, without changing the canonical board redraw contract.
