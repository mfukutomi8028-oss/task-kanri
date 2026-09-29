# Ver.327 Comment Mention Escape Listener Lifecycle

## Product change

Ver.326 proved that `comment-mentions-v191.js` kept a permanent document-level `keydown` listener alive even while the mention picker was closed. The audit candidate preserved all current behavior when Escape ownership existed only for the visible picker lifetime.

Ver.327 promotes that audited lifecycle into production.

- `openPicker()` binds one named document Escape handler after the picker becomes visible.
- `closePicker()` removes that handler before clearing picker state.
- repeated open/close calls are guarded by `mentionEscapeBoundV327`, so listener ownership cannot accumulate.
- cancel, close button, backdrop, apply, and Escape continue to converge through the existing `closePicker()` path.

## Preserved boundaries

The following behavior is intentionally unchanged:

- mention picker search and multi-select semantics;
- mention token insertion and caret restoration;
- textarea programmatic-focus guard;
- task-dialog top-layer mounting introduced by Ver.321;
- `#detailBody` MutationObserver and comment UI adoption;
- comment/reaction/reply persistence and Firebase write paths.

## Release

Release and responsibility baseline advance from 280 to 281 so clients fetch the updated `comment-mentions-v191.js` runtime under a new release URL.

## Regression

The Ver.327 browser regression measures the real product runtime rather than an injected candidate and verifies desktop/mobile idle ownership, open/close lifecycle, Escape, cancel/backdrop/apply cleanup, task-dialog mounting, and repeated cycles.

Rollback branch: `backup/ver326-before-comment-mention-escape-product-v327`.
