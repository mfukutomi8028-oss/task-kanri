# Ver.511 — Mobile navigation and create-menu audit originals (Issue #292)

Baseline: accepted Ver.510 main `531d42495cd36897e3077b5cd441dc97d357d188` (Regression 39523212776, Pages 39523212743, identical checkpoint). This is a retrospective **archive index**, not a change to product behavior, current UI semantics, or security.

## Immutable originals

| Retired root Markdown | Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md` | `4c56bb9f92ffba154605486023c0ad900bde6590` | 3,766 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/531d42495cd36897e3077b5cd441dc97d357d188/MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md) |
| `MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_AUDIT_V309.md` | `199088e48f75d8cb877a2f8611c2462090d0e1ea` | 2,841 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/531d42495cd36897e3077b5cd441dc97d357d188/MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_AUDIT_V309.md) |

The originals total **2 files / 6,607 bytes**. Git history retains exact original bytes; only the current root copies retire. External `blob/main/` links and root-relative bookmarks to these files may become 404. Use the fixed original commit links above to restore either path if an unknown dependency is found.

## Ver.307 — navigation delegation: red finding and successful replacement

The first direct binding candidate missed late-created Work Memo navigation: there are eight `.nav-item` elements, not seven after runtime loading. Therefore the initial direct-target proposal is rejected.

The successful approach was container-scoped delegation: attach one guarded, bubble-phase click listener to the stable sidebar navigation container `.nav`, while preserving `event.target?.closest?.('.nav-item')`. This covers seven initial targets and the eighth dynamic Work Memo target, maintains canonical navigation in `app.js`, immediate header/board reconciliation and the 861px -> 860px conditional mobile-shell load. Schedule create handoff remains intact.

At the historical audit gate, release manifest and `baselineRelease` remain 274 during audit. The next product version may replace document-wide navigation delegation with `.nav`-scoped delegation. The retained `MOBILE_SHELL_NAV_SCOPE_V308.md`, `mobile-shell-v234.js`, `test-harness/mobile-shell-nav-scope-v308.test.mjs` and corresponding Browser tests own current behavior.

## Ver.309 — create-menu outside-click lifecycle

Ver.309 found a long-lived document-level `click` listener, although the create-menu outside-click behavior was needed only while the menu was open. The candidate registered exactly one document listener when opening, unregistered it on outside click, Escape or create action, did not dismiss on header clicks, and did not accumulate callbacks across open/close cycles. It also preserved Schedule dialog handoff, mobile drawer, responsive loading at 860/861px and desktop behavior.

Ver.310 promoted only that listener lifecycle narrowing. The retained `MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_V310.md`, `mobile-shell-v234.js`, `test-harness/mobile-shell-create-menu-outside-click-v310.test.mjs` and Browser tests verify that behavior.

## Scope and fail-closed acceptance

- Redirect existing historical Protocol assertions to this index; retain their test names, assertion patterns, and current product-contract checks. No test skip, threshold relaxation or reduced coverage.
- Add both retired names to the Stage E archived-reference guard and a fixed SHA/byte/URL restoration test. Fail on reintroduction or active-code references.
- Do not change product HTML/JS/CSS, manifest/Release304, old runtime URLs, Pages build/distribution, CI workflow, Firebase Authentication/Rules/writers, stored business data or security configuration.
- Accept only after PR exact-head Protocol, both Browser shards, Firebase, Regression all success; expected-head main merge; same-SHA main Regression + Pages success and original Pages SHA-256 unchanged; then dedicated identical rollback checkpoint.
