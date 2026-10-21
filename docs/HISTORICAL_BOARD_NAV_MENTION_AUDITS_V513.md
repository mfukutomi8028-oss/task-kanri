# Ver.513 — Historical board observer, mobile navigation, and mention observer audits (Issue #292)

Baseline: formally accepted Ver.512 main `8c306b084081ca700320995c0c525c5bb7d9a289`. Regression #39527275311, Pages #39527275279 and the identical rollback branch `backup/ver512-mobile-resize-schedule-audit-archive-validated-checkpoint` were verified.

This file preserves the findings and rejected design paths of three superseded audit documents. It does not define new runtime behavior, supersede current product contracts, or rewrite the originals.

## Original root Markdown and immutable restoration

| Retired root audit | Original Git blob SHA-1 | Original bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md` | `b04232de9cfaa15ab4b910ad0ee6a6131e2c128e` | 2,280 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/8c306b084081ca700320995c0c525c5bb7d9a289/MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md) |
| `MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md` | `105fdc451175070e35d76275d5fd8f8df1b4d9e7` | 3,491 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/8c306b084081ca700320995c0c525c5bb7d9a289/MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md) |
| `COMMENT_MENTION_OBSERVER_AUDIT_V328.md` | `5536b5cc4b55a630ea43a398e803a46be2c77d76` | 2,689 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/8c306b084081ca700320995c0c525c5bb7d9a289/COMMENT_MENTION_OBSERVER_AUDIT_V328.md) |

**3 files / 8,460 bytes** of original Markdown are retired from the live root. The exact originals remain in Git history at the fixed commit links above; Git history is not reduced. External `blob/main/` or root-relative bookmarks to them may return 404. Restore from the original SHA/URL if an unknown dependency is discovered.

## Ver.299: board observer scope — historical experiment and limits

At Release 270, the board observer used `{ childList: true, subtree: true }` on `#boardView`. Ver.299 established these distinct observations:

- an unrelated descendant child-list mutation wakes the current subtree observer, even when board counts and labels are unchanged;
- the direct-child candidate ignores that unrelated descendant mutation;
- a real application board redraw still wakes the direct-child candidate, because canonical `renderBoard()` replaces the direct children of `#boardView`.

The Ver.299 direct-child proposal was tested in a temporary Playwright-served copy, not silently applied to production. Direct-child observation became a Ver.300 product behavior. Later Ver.301/302 narrowed which direct-child changes schedule board-tab repair to actual `.board-column` changes. This distinction matters: direct-child scope alone is **not** an assertion that every direct-child mutation needs a full rescan.

Preserved owners: `mobile-shell-v234.js`, `app.js`, `test-harness/mobile-shell-board-observer-semantic-v302.test.mjs`, and `tests/mobile-shell-board-observer-semantic-v302.spec.mjs`. Any other observer and resize/canonical board-render contracts remain intact.

## Ver.305: navigation capture-to-bubble handoff

The earlier mobile listener ran in the document capture phase before the canonical `app.js` navigation target handler, so it deferred drawer/title/tab reconciliation via `setTimeout(..., 0)`. The Ver.305 candidate moved the delegated listener to normal document bubble phase, letting the target handler synchronously call `syncNavigationUi()` and `render()` before mobile reconciliation, in the same click task.

Browser evidence included immediate Tasks/Today navigation and title/tab recovery, and a conditional 861px -> 860px mobile-shell load, without changing canonical `app.js` or Firebase/business-data writers. **Regression #784** documented Protocol, Browser and Firebase Emulator success on the audit head.

Ver.306 promoted the synchronous document-bubble handoff; later Ver.307/308 scoped delegation to the stable `.nav` container to accommodate dynamically inserted Work Memo navigation. Do not revive an old document-wide listener or a deferred timer based on this historical description. Current owners: `mobile-shell-v234.js`, `app.js`, `MOBILE_SHELL_NAV_SCOPE_V308.md`, and `test-harness/mobile-shell-nav-scope-v308.test.mjs`.

## Ver.328: mention observer semantic filter without narrowing its root

The audit of `comment-mentions-v191.js` found that unrelated `#detailBody` descendant changes were scheduling unnecessary `patch()` scans. However, the root and subtree observation remain important because the canonical comment form and the whole panel can be reconstructed.

The candidate may receive the broad observer callback but does not schedule or execute `patch()` for unrelated mutations. Only added or removed nodes matching or containing semantic comment surfaces should cause a mention rescan: `.task-comments-panel-v149`, `#commentForm`, `.comment-form`, and `textarea#commentText`.

Ver.328 was audit-only at Release 281, preserving mention-picker Escape behavior and all comment/reply/reaction and Firebase writer paths. Ver.329 promoted only the semantic filter at Release 282, without narrowing the `#detailBody` root or `{ childList: true, subtree: true }`. Current owners: `comment-mentions-v191.js`, `COMMENT_MENTION_OBSERVER_PRODUCT_V329.md`, `test-harness/comment-mention-observer-v329.test.mjs` and `tests/comment-mention-observer-v329.spec.mjs`.

## Scope, verification, and rollback rules

- Remove only the three historical root Markdown copies in the table and redirect their three active Protocol suites' *audit-text* reads to this index. Keep all existing assertions, product runtime checks, test case names and the 99 Protocol source files unchanged.
- Add this index to the fail-closed Stage E historical-name guard and verify exactly these original blob SHA-1 hashes, original byte counts, immutable source URLs, missing root copies, preserved successors, and the negative/boundary findings.
- Product JavaScript/HTML/CSS, release and manifest, Pages builder/distribution, old runtime URLs, workflows, Firebase Auth/Rules/writers, stored user data, and deferred security work are outside this change.
- Acceptance requires exact PR-head Protocol / both Browser shards / Firebase / final Regression success, guarded merge to main, same-SHA main Regression / Pages success with unchanged runtime fingerprint, and a verified identical rollback checkpoint.
