# Ver.448 — Immutable superseded product handoff notes

Issue #292 Stage E. Accepted base: Ver.447 main `09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b`; Regression #38343775865 and Pages #38343775839 success; checkpoint `backup/ver447-historical-file-retirement-notes-validated-checkpoint`. Ver.438's retained classification was a snapshot, not a permanent deletion ban. Ver.447 retired 2 of its 16; this review retires 3 more.

## Fixed originals

| Retired root Markdown | Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `BOOTSTRAP_CURRENT_ICONS_V380.md` | `7459c4a214f30e34e241e0ce0043763b526fd74d` | 3,036 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/BOOTSTRAP_CURRENT_ICONS_V380.md) |
| `COMMENT_MENTION_ESCAPE_PRODUCT_V327.md` | `e0d21d90493b32685e51bbf3965b14733bb42499` | 1,678 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/COMMENT_MENTION_ESCAPE_PRODUCT_V327.md) |
| `FAVORITE_OBSERVER_PRODUCT_V369.md` | `c304621bf4b462945a598dc5815093fc7e50b3bc` | 1,144 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/FAVORITE_OBSERVER_PRODUCT_V369.md) |

Originals: **3 files / 5,858 bytes**. Git history remains intact; only current root copies are removed.

## Verified live ownership

- **Ver.380 icons:** `index.html`, `release-manifest.js`, `test-harness/bootstrap-current-icons-v380.test.mjs`, and `tests/bootstrap-current-icons-v380.spec.mjs` enforce SVG first paint and legacy image/brand/version compatibility.
- **Ver.327 Escape:** `comment-mentions-v191.js`, `tests/comment-mention-escape-lifecycle-v327.spec.mjs`, and `test-harness/comment-mention-observer-v329.test.mjs` enforce picker-only Escape binding, cleanup, and workflow preservation.
- **Ver.369 favorite:** `favorite-ui-v237.js`, `test-harness/favorite-observer-product-v369.test.mjs`, `tests/favorite-observer-product-v369.spec.mjs`, and `tests/favorite-observer-target-v370.spec.mjs` enforce semantic wakeups, unrelated-noise exclusion, ARIA, redrawing, and unchanged writers.

The **other 11** ownerless root notes retain current design, write-safety, or CI/recovery value and stay. This archive does not remove current runtime/tests, Release304 assets, old PNG or URL aliases, snapshots, workflow definitions, Firebase/Rules/Auth, or business data. It neither authorizes future PNG deletion nor establishes that old clients have disappeared.

## Link risk, rollback, and gate

Old `blob/main/` or root-path external bookmarks to these notes may break; use the fixed-commit original URLs above to restore byte-for-byte if a hidden dependency appears. Extending the fail-closed Stage E guard protects against restored root paths and executable references; hash/size/URL and successor assertions run in Protocol. No assertion/retry relaxation.

Accept only after PR exact-head Protocol, Browser shards 1/2, Firebase, final Regression success; expected-head merge; same-SHA main Regression and Pages success; dedicated checkpoint ref/diff readback. Otherwise do not declare completion.
