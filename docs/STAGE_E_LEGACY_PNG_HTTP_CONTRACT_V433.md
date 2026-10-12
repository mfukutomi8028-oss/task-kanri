# Ver.433 / Stage E: legacy PNG and cached image URL contract

Issue #292. The dependency baseline is Ver.432 merged main `8b02acf635d9e7d654573cb085a03362e831ca0f`. This is a separate **Draft** quality-gate candidate while the same-SHA main Regression / Pages acceptance is being checked.

## Rationale

Ver.380 validates current first-paint SVG selection, Ver.382 validates the Pages file inventory, and Ver.383 probes some cached URLs. However, there was no single browser HTTP check covering **all twelve** historical `legacyIconMap` source URLs, the `brand-v184.png` alias, and the exact original bytes of the heavyweight PNGs.

## Added safeguards

- A test-only immutable inventory for 12 old first-paint image paths plus the additional brand PNG alias.
- Protocol checks that the packaged Pages tree serves all 13 paths, the first-paint mapping still lists the original 12, and 11 PNG URLs (8 heavyweight PNGs and 3 brand/today originals or aliases) retain the pinned Git blob SHA-1.
- Browser checks all 13 `/task-kanri/assets/...` HTTP URLs with historical `?v=143` query strings, status 200, matching MIME and valid PNG signatures, plus original blob SHA-1 for each PNG.
- Checks operate on **published output**. They do not require that the original PNG must permanently remain as a separate tracked Git file, so later archive/reconstruction work can be evaluated independently.

All app HTML/JS/CSS, Pages builder, release manifest, asset blobs, Firebase/Rules/auth/data and Release304 are unchanged. The existing Playwright and Protocol entrypoints pick up these tests; there is no new workflow or runner configuration.

## Scope and limits

This does **not** remove, compress, replace or republish any PNG. Passing a local packaged HTTP test does not prove external bookmarks, cache lifetimes, CDN behaviour, offline storage, or production-domain requests work. Do not infer deletion readiness from this guard alone.

Acceptance order: finish Ver.432 same-SHA main Regression + Pages + checkpoint; Ver.433 independent exact-head Protocol / Browser / Firebase / Regression; expected-head main merge; same-SHA main Regression + Pages; Ver.433 checkpoint. If any gate fails, retain the Draft branch without modifying main.
