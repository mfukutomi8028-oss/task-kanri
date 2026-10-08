# Ver.369 — Favorite UI semantic MutationObserver productization

- Baseline: Ver.368 main `97d9b39e987c7fb23279fb6ccb65c53c02e707b0`, Release/baseline 296/296.
- Restore: `backup/ver368-before-v369-favorite-semantic-product`.
- Active file: `favorite-ui-v237.js` (same filename and load order).
- Semantic childList filter handles added/removed favorite controls, descendants, hidden favorite row and retired UI. Ignores unrelated sidebar/task/filter DOM. Click fallback, four observer roots, ARIA and toast recovery remain.
- No `:has()` dependency; row ownership uses `closest()` and `querySelector()`. Firebase, data writes, CSS and other app features unchanged.
- Release/baseline **296 → 297**.
- Ver.366–368 historical tests run against frozen `test-harness/fixtures/favorite-ui-v237-pre-v369.js`. New Ver.369 browser suite instruments active product runPatch count only and verifies desktop/mobile favorite toggle/filter, redraw, detail replacement, text/ARIA, obsolete control cleanup and irrelevant noise suppression.
- Gate: PR Protocol, Browser, Firebase Emulator green; exact-head merge; main Regression + Pages; checkpoint.
