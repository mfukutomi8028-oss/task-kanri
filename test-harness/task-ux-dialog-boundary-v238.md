# Ver.238 task UX ownership audit

- Product runtime remains Ver.237; this checkpoint adds audit evidence only.
- `app.js` owns task editor open/save/explicit close and primary task sorting.
- `list-column-sort-v229.js` owns secondary list-column sort state and its clear control.
- `task-ux-v146.js` still uniquely owns quick-status UI, generic dialog backdrop close, unsaved-task discard confirmation, and the clear-column-sort → primary-sort redraw bridge.
- Therefore `task-ux-v146.js` must not be retired until those four responsibilities are moved to their canonical owners and browser/Firebase regression remains green.
