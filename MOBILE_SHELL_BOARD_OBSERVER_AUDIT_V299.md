# Ver.299 Mobile Shell Board Observer Audit

## Baseline

- Ver.298 main: `f0b5c4652001542f2b1b584c52cdca5bb9738dc3`
- release / responsibility baseline: `270`
- production runtime remains unchanged during this audit.

## Target

`mobile-shell-v234.js` currently observes `#boardView` with:

```js
new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true, subtree: true });
```

The observer exists only to re-run `patchMobileBoardTabs()` when the canonical board changes. `app.js` renders the task board by replacing `elements.boardView.innerHTML`, so a canonical board render changes direct children of `#boardView`.

Ver.299 measures whether `subtree: true` has independent value or merely wakes for unrelated descendant child-list mutations whose board-column labels and task-card counts did not change.

## Safety boundary

- Do not change production `mobile-shell-v234.js`.
- Do not change release / baselineRelease from 270.
- Do not change resize reconciliation, startup `patchAll()`, conditional loading, navigation synchronization, schedule retry, Firebase, or business-data paths.
- Test a direct-child observer only in the Playwright-served audit copy.

## Browser evidence

The audit compares the current subtree observer with a test-only direct-child observer.

It must establish:

1. an unrelated descendant child-list mutation wakes the current subtree observer even though status-tab signature/counts do not change;
2. the direct-child candidate ignores that unrelated descendant mutation;
3. a real application board redraw still wakes the direct-child candidate because `renderBoard()` replaces `#boardView` direct children;
4. seeded task counts and status-tab labels/counts remain canonical after a real application redraw;
5. navigation away from and back to the task board still removes/recreates mobile tabs correctly;
6. release 270 and all existing product behavior remain unchanged.

## Product decision gate

Only promote Ver.300 if the audit proves the direct-child observer preserves canonical application redraw/count behavior while eliminating descendant-only wake-ups. Synthetic arbitrary mutation of a task-card subtree is not by itself a product requirement; the deciding boundary is the application's canonical render path.
