# Ver.514 — Long-lived UI responsibility audit archive (Issue #292)

Base: accepted Ver.513 main `df12626f5a5d5d4088be7b24eabac745f323f7a3`. The original audit documents remain recoverable from the pinned Git commit; only root copies retire.

| Retired root Markdown | Original blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_LONG_LIVED_RESPONSIBILITY_AUDIT_V313.md` | `845c4e4980a3b48257802a426b6b6bef2b92e617` | 3,647 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/df12626f5a5d5d4088be7b24eabac745f323f7a3/MOBILE_SHELL_LONG_LIVED_RESPONSIBILITY_AUDIT_V313.md) |
| `SIDEBAR_GLOBAL_LISTENER_AUDIT_V323.md` | `54f1800d36fb47d65498aa620337f40947e3ea30` | 3,076 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/df12626f5a5d5d4088be7b24eabac745f323f7a3/SIDEBAR_GLOBAL_LISTENER_AUDIT_V323.md) |
| `WORK_FEATURES_LONG_LIVED_AUDIT_V316.md` | `9fae12caa3a91782749ed12448e6258068c54b04` | 3,502 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/df12626f5a5d5d4088be7b24eabac745f323f7a3/WORK_FEATURES_LONG_LIVED_AUDIT_V316.md) |

Originals: **3 files / 10,225 bytes**. Git history retains their original bytes. External `blob/main/` links and root-level bookmarks may break after retirement. Recover via the fixed links above.

## Ver.313 mobile shell: deliberate keep decision

Ver.313 was audit-only: Product runtime is not changed in this audit. The historical Ver.295〜302 resize, board and observer responsibilities were already optimized. Ver.310/312 narrowed menu and Escape listeners to transient ownership. The remaining persistent `.nav` delegated click listener was justified because mobile navigation can occur throughout the session, including dynamic Work Memo insertion and 861/860px late loading. Avoid introducing per-item binding or an unnecessary rebind lifecycle without measured benefit. Retain `mobile-shell-v234.js` and `test-harness/mobile-shell-long-lived-responsibility-v313.test.mjs` as current contracts.

## Ver.323 desktop sidebar: group transient document listeners

The historical Ver.323 audit measured `keydown`, `dragend` and `drop` document-level listeners during collapsed/pinned/mobile-idle states. The candidate bound the three together only when desktop media matched and sidebar was expanded but not pinned. Escape collapse, keyboard focus, drag reveal and the 861/860px boundary had to survive. Ver.324 promoted the scoped lifecycle without weakening these behaviors. Current owners include `SIDEBAR_GLOBAL_LISTENER_PRODUCT_V324.md`, `desktop-sidebar-v242.js`, `test-harness/sidebar-global-listener-lifecycle-v324.test.mjs`.

## Ver.316 work features: retained necessary owners

Ver.316 was a responsibility audit, not a deletion target: Product runtime is not changed in this audit. The `#taskDialog` observer watches only the `open` attribute and repopulates the start-date field on canonical task dialog opening. The separate one-shot local-midnight timer refreshes reserved/future task visibility at approximately 00:00:02. The audit demonstrated why the two narrowly owned paths cannot be deleted merely because they are long-lived; they should be removed only if a proven replacement preserves both contracts. Current owners remain `work-features-v167.js`, `test-harness/work-features-long-lived-v316.test.mjs`, and their Browser regressions.

## Acceptance and non-changes

Retire only the three root historical notes above, redirect existing historical text assertions without changing their test bodies, register the archive in the Stage E fail-closed guard, and add exact original hash/byte/recovery URL checks. No product JavaScript, HTML, CSS, release/manifest, GitHub Pages payload, Firebase data/Auth/Rules/writers, CI workflow, or deferred security scope changes. Require exact-head PR Protocol, Browser shards, Firebase and final Regression; then same-SHA main Regression, Pages fingerprint and identical rollback checkpoint.
