# Ver.370 — Favorite Observer target-boundary regression audit

## Baseline
- Ver.369 main: `9ea5bc0590ef6761d04b937b77815fb09f66f33f`; Release / baseline **297 / 297**.
- Ver.369 main Regression / Pages: green.
- Restore: `backup/ver369-before-v370-favorite-target-audit`.
- **No product runtime, CSS, Firebase, or data-write changes.**

## Scope
Use a route-only instrumented copy of the **current** `favorite-ui-v237.js` to measure full-document repair runs while executing the real app in Chromium (desktop 1366 px, mobile viewport 390 px).

Audit:
- Unrelated label.check-row mutations in sidebar: no favorite repair.
- Unrelated nested sidebar mutations: no favorite repair.
- Nested child mutation within the favorite navigation control: existing `favoriteHostV369(record.target)` preserves recovery but also wakes for otherwise irrelevant nested child changes.
- Favorite checkbox row replacement: hidden/aria-hidden recovery still operates.

## Decision
The explicit `record.target` ownership fallback can awaken on mutations inside canonical favorite controls. This is a **deliberate conservative boundary**, not yet proof of a product defect. Any further reduction must prove that text/child replacement within existing controls still receives accessibility/terminology repair. Do not remove fallback or change the product in this audit.

Gate: PR Protocol + Browser + Firebase Emulator, exact-head merge, main Regression + Pages, backup checkpoint.
