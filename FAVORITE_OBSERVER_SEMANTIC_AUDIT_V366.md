# Ver.366 — Favorite UI MutationObserver semantic scope audit

## Verified baseline
- Main: `446793181c59c4cb21417960def2bf540da35e50` (Ver.365).
- Restore: `backup/ver365-before-v366-favorite-observer-audit`.
- Active module: `favorite-ui-v237.js`. No product JS/CSS, Firebase, data write, or release/baseline changes.
- Release/baseline: **296 / 296**.

## Existing wakeup ownership
- A sidebar subtree childList observer, a main-content subtree childList observer, and a detail-body subtree childList observer each schedule `runPatch()` for **any** inserted or removed descendant, even when unrelated to favorites.
- The shared `patchScheduled`/`requestAnimationFrame` gate already coalesces updates within one frame, but unrelated changes on later frames repeat full-document label and hidden-control scans.
- A separate toast observer listens for child/text changes to translate legacy star messages.
- The document capture click fallback covers favorite toggles whose state changes through non-childList attributes.

## Audit experiment
- `test-harness/favorite-observer-semantic-v366.test.mjs` executes the **unchanged real module** under a controlled DOM/MutationObserver/animation-frame harness.
- It confirms the current broad scope and frames, then executes a **test-only injected semantic candidate** that limits childList wakeups to inserted/removed favorite controls, their containers/descendants and retired controls.
- Candidate checks irrelevant sidebar/main/detail childList mutations, direct and nested favorite insertion, favorite state via canonical click, removals, and toast message translations.
- Full PR Protocol, Browser and Firebase Emulator regression gates are required before merge.

## Findings and decision
The current observer scopes are broad enough to wake full-document patching on unrelated childList changes. A semantic childList filter appears promising as a **future product candidate**, but this audit does not authorize immediate retirement of the observers. Before productization, verify dynamic replacement of whole favorite-view containers, removed-control cleanup, accessibility labels after redraw and favorite toggle on actual desktop/mobile browser flows. Also confirm whether any canonical rendering changes favorite state via attribute-only updates without a click; neither the existing observer nor this candidate listens for attributes.

Do **not** change the product in Ver.366. Release and baseline stay **296 / 296**. After CI-green, exact-head merge and final main Regression + Pages, record the Ver.366 checkpoint.
