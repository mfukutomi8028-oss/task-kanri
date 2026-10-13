# Ver.448 — Superseded product handoff notes (fixed Git originals)

Issue #292 / Stage E. Starting point: formally accepted Ver.447 main `09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b`, same-SHA Regression #38343775865 and Pages #38343775839 success, checkpoint `backup/ver447-historical-file-retirement-notes-validated-checkpoint`. Ver.438's original 16 retained notes were a historical triage, not a permanent ban on a later evidence-based review; Ver.447 retired 2, this batch reviews 3 of the remaining 14.

## Immutable originals (no Git-history rewrite)

| Retired root Markdown | Git blob SHA-1 | Bytes | Fixed original |
| --- | --- | ---: | --- |
| `BOOTSTRAP_CURRENT_ICONS_V380.md` | `7459c4a214f30e34e241e0ce0043763b526fd74d` | 3,036 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/BOOTSTRAP_CURRENT_ICONS_V380.md) |
| `COMMENT_MENTION_ESCAPE_PRODUCT_V327.md` | `e0d21d90493b32685e51bbf3965b14733bb42499` | 1,678 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/COMMENT_MENTION_ESCAPE_PRODUCT_V327.md) |
| `FAVORITE_OBSERVER_PRODUCT_V369.md` | `c304621bf4b462945a598dc5815093fc7e50b3bc` | 1,144 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b/FAVORITE_OBSERVER_PRODUCT_V369.md) |

Total **3 files / 5,858 bytes**. These are historical productization notes describing already completed releases, not active source files or runtime configurations. Removing three root copies and adding this index reduces tracked file count by two; net byte savings must be measured with the guard/test additions included.

## Independent current owners checked before retirement

- **Bootstrap icons (Ver.380):** `index.html`, `release-manifest.js`, `test-harness/bootstrap-current-icons-v380.test.mjs` and `tests/bootstrap-current-icons-v380.spec.mjs` enforce canonical SVG first paint, brand/version bootstrap, and legacy cached image compatibility. The historical note's release candidate instructions are superseded; the old image bytes and alias URLs are still protected.
- **Mention Escape listener (Ver.327):** active `comment-mentions-v191.js`, `tests/comment-mention-escape-lifecycle-v327.spec.mjs`, and `test-harness/comment-mention-observer-v329.test.mjs` check transient document Escape listener binding/unbinding, repeated cycles, and preserved picker workflow.
- **Favorite semantic observer (Ver.369):** active `favorite-ui-v237.js`, `test-harness/favorite-observer-product-v369.test.mjs`, `tests/favorite-observer-product-v369.spec.mjs`, and `tests/favorite-observer-target-v370.spec.mjs` check semantic mutation wakeups, irrelevant-noise suppression, click/ARIA, UI replacement, and unchanged writer ownership.

## Non-goals, compatibility, and recovery

The **other 11** ownerless root notes retain design or operational/recovery value and are not deleted. No app JS/CSS/HTML, Release304, manifest, snapshots, `.github/workflows`, Pages builder, legacy PNG/SVG/URL aliases, Firebase/Rules/Auth or business-data path changes. No test assertion/retry relaxation. A prior `blob/main/` or external root Markdown link may now return 404; only fixed-SHA original URLs above are guaranteed by this Git archive method. It does not reduce historical Git storage and does not establish that no external bookmark exists.

Add this index to the Stage E fail-closed root-note guard; verify original hashes/byte counts, retained source/tests, and no reintroduced executable references. Acceptance: exact PR-head Protocol + both Browser shards + Firebase + final Regression success, expected-head merge, same-SHA main Regression/Pages success, then read-back-verified dedicated checkpoint. A failed or incomplete gate blocks formal acceptance.
