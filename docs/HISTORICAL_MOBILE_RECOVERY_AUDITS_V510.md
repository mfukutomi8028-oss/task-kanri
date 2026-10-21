# Ver.510 — Legacy mobile-shell recovery audits archived (Issue #292)

Baseline: Ver.509 main `95f008796ecf48a5e42afb1c394a6c352cd36641`. This consolidates historical audit conclusions while retaining the live Ver.292/294 product regressions. The two originals remain recoverable byte-for-byte at immutable Git commits, not by relying on a moving `blob/main/` link.

## Retired root audit originals

| Retired root Markdown | Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_STARTUP_REPATCH_AUDIT_V291.md` | `44c35ecdc24656a393e8599344d210079d131650` | 5,469 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/95f008796ecf48a5e42afb1c394a6c352cd36641/MOBILE_SHELL_STARTUP_REPATCH_AUDIT_V291.md) |
| `MOBILE_SHELL_ORIENTATION_RECOVERY_AUDIT_V293.md` | `e623bd66cf2a316e4cea85826f26aa73bb7cece0` | 2,537 | [original](https://github.com/mfukutomi8028-oss/task-kanri/blob/95f008796ecf48a5e42afb1c394a6c352cd36641/MOBILE_SHELL_ORIENTATION_RECOVERY_AUDIT_V293.md) |

The two original files total **2 files / 8,006 bytes**. Only current root copies retire. Original content is retained in Git history. The existing product-retirement notes remain at their original paths.

## Ver.291 — startup repatch evidence, preserved verbatim as independent assertions

- No tested behavior required a delayed full-shell `patchAll()` at 300ms or 1000ms.
- Protocol and release-contract tests: success
- Browser regression smoke tests: success
- Firebase Emulator write tests: success

The retained `MOBILE_SHELL_STARTUP_REPATCH_RETIREMENT_V292.md` and `test-harness/mobile-shell-startup-repatch-v291.test.mjs` continue to verify the absence of the startup 300ms/1000ms fallback without removing resize, board-scoped observer, navigation synchronization or data-writer boundaries.

## Ver.293 — orientation recovery evidence, preserved verbatim as independent assertions

- portrait -> landscape and landscape -> portrait device-metric transitions emit `resize`
- The Ver.293 browser audit served a temporary copy with the `orientationchange` listener suppressed.
- mobile -> desktop-width -> mobile rotation-style transition
- Ver.294 may retire only the delayed orientation listener

The retained `MOBILE_SHELL_ORIENTATION_RECOVERY_RETIREMENT_V294.md` and `test-harness/mobile-shell-orientation-recovery-v293.test.mjs` continue to verify that resize remains and the retired orientationchange listener does not return. This is a historical Chromium test observation, not a claim about every real-world device.

## Safety and restoration

- Product `mobile-shell-v234.js`, other JS/CSS/HTML, Release304, manifest, Firebase Auth/Rules, saved data, old URLs, workflows and Pages distribution are unchanged.
- Existing Protocol checks keep all historical statement assertions; their audit source becomes this immutable-source index. The Stage E guard must reject root-file reintroduction and executable references to either retired name.
- External root-path bookmarks, especially `blob/main/` links, may 404 after merge. For restoration use the exact original commit links above with their pinned Git blob SHA-1 and byte counts.
- Acceptance: exact PR-head Protocol, Browser(1)/(2), Firebase, final Regression success; expected-head merge; same-SHA main Regression and Pages success; checkpoint identical. No tests skipped or expectations weakened.
