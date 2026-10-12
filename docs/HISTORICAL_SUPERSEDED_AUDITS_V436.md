# Ver.436 / Stage E — superseded root audit notes, immutable recovery

Issue #292. Verified source main: `bd843e4eb27775fa9ad4e9b50362ae636b6f6209`, after Ver.435 accepted independent and same-SHA Regression / Pages. This batch is a **candidate** until independent exact-head CI and merged-main checks pass.

## Selection and limits

Ver.426's tracked-file text scan reported zero exact-name owners for these three historical audit notes, reconfirmed with repository code search before proposing deletion. Each covers a decision now reflected in current product code/tests or CI. Zero literal matches do **not** prove the absence of dynamic references, external links, bookmarks, or cached old `blob/main/` URLs. The originals remain unchanged in immutable Git history; do not rewrite historical findings as current operating advice.

| Retired root Markdown | Original Git blob SHA | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `BRAND_BOOTSTRAP_AUDIT_V280.md` | `fd47dd9c21b17a85f9d17532a4e2560fa1f4d313` | 6,826 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd843e4eb27775fa9ad4e9b50362ae636b6f6209/BRAND_BOOTSTRAP_AUDIT_V280.md) |
| `INSIGHTS_POLLING_SCOPE_AUDIT_V356.md` | `c3f215bfc0c8967bdb8d04a808951025ef56331c` | 2,328 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd843e4eb27775fa9ad4e9b50362ae636b6f6209/INSIGHTS_POLLING_SCOPE_AUDIT_V356.md) |
| `REGRESSION_PARALLEL_V381.md` | `72f1bfed98b6499a592d0ffa365fec77f9cf95ac` | 2,529 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/bd843e4eb27775fa9ad4e9b50362ae636b6f6209/REGRESSION_PARALLEL_V381.md) |

Original file count: **3**; original bytes: **11,683**. Git history does not shrink. Net tracked file count falls by two (three deleted, one new index), not including modifications to existing tests.

## Retained successors and rationale

- `BRAND_BOOTSTRAP_AUDIT_V280.md`: Ver.281でブランド初期化責務を製品化。現役brandとテストを保持
- `INSIGHTS_POLLING_SCOPE_AUDIT_V356.md`: Ver.357の可視状態連動型ポーリングへ製品化。現役コードとテストを保持
- `REGRESSION_PARALLEL_V381.md`: Ver.381並列CI提案はVer.435の2-shard構成へ継承。現役CI設定と検査を保持

## Acceptance boundary

- Delete exactly these three root `.md` files; retain all current operational runbooks, source code, runtime assets, archived copies, rollback points, and test suites.
- Extend the existing V431/V432 Stage E guard with this index, keeping original Git blob SHA and fixed commit URLs. Any new executable/test/config exact-name reference, reintroduced root file, unreadable source, duplicate row, or broken index shape must block Protocol.
- Use the existing Protocol registration and browser matrix CI. No changes to `package.json`, HTML/JS/CSS runtime, Pages builder/output, PNG/SVG assets, Firebase/Rules/auth, Release304, or production data.
- Recheck independent exact-head Protocol / Browser (both shards) / Firebase / Regression; only then expected-head merge. Verify merged-main same-SHA Regression / Pages and create a named recovery checkpoint.
- Fixed links preserve the content but cannot automatically repair third-party references to `blob/main/`. Restore using this pinned commit if a live dependency is discovered.
