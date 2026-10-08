# Ver.368 — Favorite Observer narrow filter-row candidate audit

## Baseline and intent
- Ver.367 main: `e188f609f0f16285ed222b7847593549d336231a`; Release / baseline **296 / 296**.
- Restore: `backup/ver367-before-v368-favorite-semantic-refinement`.
- Product module `favorite-ui-v237.js` **unchanged**.

## Increment
The Ver.367 browser audit found that the general `label.check-row` selector matches unrelated filters. This test-only candidate replaces it with `label.check-row:has(#favoriteOnly)`, retaining wakeups for the actual favorite filter row and descendants while ignoring unrelated checkboxes. Candidate source continues to derive from Ver.366 and route only the favorite JS response inside Playwright, without changing production data paths.

The Ver.368 Playwright regression compares original and candidate at desktop, tests desktop/390px unrelated rows, favorite toggles and redraw on desktop/430px/390px, nested detail favorite replacement, sidebar filter re-insertion and obsolete cache-control removal, ARIA attributes and toast translation.

## Required gate
Protocol, Browser, and Firebase Emulator PR checks must all be green before exact-head merge. After merge, require main Regression and Pages. **Do not ship the semantic observer with this audit.** Verify support for `:has()` on the deployed browser matrix before adopting the selector as a production dependency; alternatively implement a selector-free DOM check in productization.
