# Ver.437 / Stage E — Historical implementation plans (immutable recovery)

Issue #292 — source is accepted Ver.436 main `f71e43928d54d41a8a01484f86e8b638063d049a`. This Ver.437 archive is a **candidate** until all independent exact-head and main CI checks succeed.

## Selection rationale and retained ownership

Ver.426 Git-index-based tracked text audit reported **zero exact literal filename owners** for each of these four root documents in Ver.436. Their project proposals have now been implemented and verified by active source and tests. We archive *historic proposals*, not the code, executable tests, or current operating instructions.

| Retired root Markdown | Git blob SHA-1 | Bytes | Fixed original |
| --- | --- | ---: | --- |
| `PAGES_RUNTIME_ARTIFACT_V382.md` | `387f6595dc392548187a5bbf8b71aede6c711c40` | 2,109 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/f71e43928d54d41a8a01484f86e8b638063d049a/PAGES_RUNTIME_ARTIFACT_V382.md) |
| `PAGES_PACKAGED_BROWSER_V383.md` | `f4c95806c2c609263a1449e46a1903a9c41fddfa` | 2,396 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/f71e43928d54d41a8a01484f86e8b638063d049a/PAGES_PACKAGED_BROWSER_V383.md) |
| `RELEASE_CHECK_BRIDGE_V386.md` | `1cf73ff838e02989ed38c8d650b30237ee93d886` | 2,730 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/f71e43928d54d41a8a01484f86e8b638063d049a/RELEASE_CHECK_BRIDGE_V386.md) |
| `ZERO_RESULTS_UX_V374.md` | `c0c7788fafd83f2879d3f4ace217c7bde07800ee` | 2,444 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/f71e43928d54d41a8a01484f86e8b638063d049a/ZERO_RESULTS_UX_V374.md) |

Originals: **4 files / 9,679 bytes**. Removing four root notes and adding this index gives three fewer Git tracked files before accounting for existing-test modifications. Git history does not shrink.

## Current owner retained

- **`PAGES_RUNTIME_ARTIFACT_V382.md`**: Pages配布対象の分離; retained as live owners: `test-harness/build-pages-runtime-v382.mjs と .github/workflows/pages.yml`.
- **`PAGES_PACKAGED_BROWSER_V383.md`**: 配布成果物のブラウザ検証; retained as live owners: `tests/pages-packaged-browser-v383.spec.mjs と test-harness/pages-runtime-v382.test.mjs`.
- **`RELEASE_CHECK_BRIDGE_V386.md`**: PowerShellリリースチェックをNode正本へ委譲; retained as live owners: `release-check.ps1 と test-harness/release-check-bridge-v386.test.mjs、現行README`.
- **`ZERO_RESULTS_UX_V374.md`**: 絞り込み0件時の初期実装計画; retained as live owners: `ZERO_RESULTS_UX_V374_PRODUCT.md と既存アプリ・回帰テスト`.

## Rules, non-goals and recovery

- No change to application HTML/JavaScript/CSS, Release304 manifest, Pages packaging and URL aliases, PNG/SVG, GitHub Actions CI, PowerShell wrapper, Firebase/Rules/auth, test runners or production data.
- Prior historical root audit indexes (V427/428/429/430/436) remain intact. Add this index to the Stage E fail-closed name guard; root file reintroduction or exact-name executable/test/config references must fail Protocol.
- Lack of static text owners is **not proof** of no dynamically built paths, external hyperlinks, offline browser caches or bookmarked `blob/main/` URLs. Those URLs may break: originals above remain retrievable at immutable commit SHA. Do not claim external-link compatibility.
- If new dependency is discovered, restore the old file byte-for-byte from the fixed commit link and rerun the full suite. Do not treat old proposed behavior as the current Release304 contract.
- Required gate: independent exact-head Protocol, two Browser shards, Firebase, regression gate all success; expected-head main merge; same-merge-SHA Regression and Pages success; then named checkpoint. Until this process ends, this is only a Draft candidate.
