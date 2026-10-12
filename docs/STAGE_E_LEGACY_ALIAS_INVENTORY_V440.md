# Ver.440 / Stage E — published legacy alias source protection

Issue #292. Candidate based on Ver.439 merged main `4d83faf42f76d85762277ab03cb00990cad1f0b4`. Ver.439 remains pending final same-SHA main Regression/Pages acceptance and checkpoint at PR creation.

## Why

The read-only asset inventory correctly recognizes all five manifest loading lists after Ver.439. But a file may also be needed **only** as a physical source for a historical URL reconstructed by the Pages builder's `LEGACY_RUNTIME_ALIASES`, even if it is absent from the current release manifest and has zero direct runtime text owners.

Examples: `assets/summary-today.png` is published from `assets/nav-today-v87.png`; `assets/brand-v184.png` is published from `assets/brand.png`. These cached URLs and bytes are already protected by Ver.433; the new guard improves inventory classification rather than production behavior.

## Change

- Build a reverse `physicalTarget -> cached URL(s)` index from the current Pages builder alias map, not from a duplicated independent list.
- Mark targets without manifest declarations as `published-alias-target` before literal runtime/test references or manual deletion candidates.
- Keep `declared-active` priority where an alias target is also in the current manifest.
- Add `legacyAliasUrls` evidence on each result row and count published alias targets separately; show the URL count in the read-only Markdown report.
- In minimal fixture tests, confirm that two alias sources with no manifest declaration and no runtime text reference remain protected; unrelated unreferenced assets remain manual-review candidates.
- In the product fixture, verify `assets/nav-today-v87.png` remains tied to the published old `assets/summary-today.png` URL.

## Boundaries and acceptance

This is not a complete live-dependency oracle: other cached HTML URLs, frozen archive payloads, dynamically generated paths, CDN caches and external bookmarks need separate checks. Nothing in this report grants automatic deletion authority.

No product HTML/JS/CSS, Release304, Pages builder/aliases, image blob, workflow, Firebase/Rules/Auth, user data, or retired documentation is modified.

Prerequisite: Ver.439 same-SHA main Regression and Pages success, plus recovery checkpoint. Then Ver.440 independent exact-head Protocol/Browser 2 shards/Firebase/Regression all success; expected-head merge; main same-SHA Regression/Pages all success; dedicated checkpoint. Keep PR Draft until eligible.
