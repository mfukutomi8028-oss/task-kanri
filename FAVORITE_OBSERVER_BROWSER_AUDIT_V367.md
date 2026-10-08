# Ver.367 — Favorite UI semantic observer real-browser audit

## Baseline
- Ver.366 main `df1bbe1811872a5436224e106bbd0207d2a04a94`.
- Restore: `backup/ver366-before-v367-favorite-browser-audit`.
- **No production JS, CSS, Firebase, write-path or release changes.** Release/baseline stay 296/296.

## Verification strategy
New Playwright suite `tests/favorite-observer-browser-audit-v367.spec.mjs` loads the unchanged application and routes *only* the `favorite-ui-v237.js` resource to a test-only transformed copy. Candidate predicate is extracted directly from the Ver.366 audited source, avoiding a drifted second implementation. The original copy is compared with the candidate using a bounded `runPatch()` call-count instrument, never by instrumenting production assets.

Checks:
- Desktop baseline/candidate: unrelated DOM insertions and favorite label/ARIA preservation.
- Desktop and 430/390px mobile candidate: canonical favorite toggling, real render replacement, task favorite filtering, and user toast text.
- Replacement of nested detail favorite controls, sidebar retired-cache cleanup and hidden filter semantics.
- Deliberate counterexample: the Ver.366 candidate selector `label.check-row` still responds to unrelated filter rows. **This is a measured limitation rather than product-ready scope.**

## Decision gate
The Ver.367 audit does not ship the candidate. Passing browser, Protocol, and Firebase Emulator regressions is required before exact-head merge; after merge, verify main Regression and Pages. Reassess overly broad `label.check-row` and any confirmed failures before Ver.368 productization. For an enhancement, retain both state-change coverage and UI accessibility, rather than deleting observers on an assumption.
