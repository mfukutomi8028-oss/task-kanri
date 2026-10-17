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
- **`ZERO_RESULTS_UX_V374.md`**: 絞り込み0件時の初期実装計画。Ver.488から現役オーナーは `app.js` と `test-harness/task-zero-guidance-v374.test.mjs`、`tests/task-zero-guidance-v374.spec.mjs`。旧製品化記録の原本も下表で固定コミットから復元できる。

## Rules, non-goals and recovery

- No change to application HTML/JavaScript/CSS, Release304 manifest, Pages packaging and URL aliases, PNG/SVG, GitHub Actions CI, PowerShell wrapper, Firebase/Rules/auth, test runners or production data.
- Prior historical root audit indexes (V427/428/429/430/436) remain intact. Add this index to the Stage E fail-closed name guard; root file reintroduction or exact-name executable/test/config references must fail Protocol.
- Lack of static text owners is **not proof** of no dynamically built paths, external hyperlinks, offline browser caches or bookmarked `blob/main/` URLs. Those URLs may break: originals above remain retrievable at immutable commit SHA. Do not claim external-link compatibility.
- If new dependency is discovered, restore the old file byte-for-byte from the fixed commit link and rerun the full suite. Do not treat old proposed behavior as the current Release304 contract.
- Required gate: independent exact-head Protocol, two Browser shards, Firebase, regression gate all success; expected-head main merge; same-merge-SHA Regression and Pages success; then named checkpoint. Until this process ends, this is only a Draft candidate.

## Ver.488追加：Ver.374製品化候補の履歴原本（Issue #292 Stage D）

検証済みVer.487 main `83aee80c59d58411fe4fd231a11a8c5fb981b679` のGit管理root Markdownは47件で、Ver.426のGit-index静的参照監査では文書15件が文書オーナーのみだった。下記の旧製品化記録のファイル名を言及する独立したソースは本履歴索引1件だけで、`test_or_tool=0 / runtime_or_config=0`。これは読取専用の事前選別であり、動的参照・外部URLの不存在を保証しない。

Ver.374の0件表示案内は現在の `app.js` に実装済み。条件表示/HTMLエスケープ/ボード・一覧での解除/データ不変のProtocol検査は `test-harness/task-zero-guidance-v374.test.mjs`、1366pxと390pxの実ブラウザ検査は `tests/task-zero-guidance-v374.spec.mjs` が担う。旧文書に記された「PR候補・当時のCI未完了」は現在のRelease304の受入状態ではなく、歴史情報として保存する。

| Retired root Markdown | Git blob SHA-1 | Bytes | Fixed original |
| --- | --- | ---: | --- |
| `ZERO_RESULTS_UX_V374_PRODUCT.md` | `435860040a9542e306be90b52a79aa22bb6cda25` | 4,897 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/83aee80c59d58411fe4fd231a11a8c5fb981b679/ZERO_RESULTS_UX_V374_PRODUCT.md) |

**削除は現行Git treeの旧root文書1件のみ**。新しい製品機能、テスト、HTML/JS/CSS、manifest、Release304、Firebase/Rules/Auth、業務データ、Pages配布物、旧キャッシュ互換資産を変更しない。Gitの履歴容量は縮小しない。古い `blob/main/` ブックマークは参照できなくなる可能性がある。必要な場合は上記コミット・blob SHAから元の4,897バイトを同じパスへ復元し、全CIを再実行する。

既存Ver.431 Stage Eガードが本索引から退役名を自動収集し、root再登場・現役実行/テストソースへの文字列再参照・不正な原本リンクを検出する。Ver.488では、既存ProtocolテストのV437元4件の厳密照合を維持したまま新1件のSHA/バイト数/URL/現役オーナー存在検査を加える。**診断のため追加した一時Protocolテストは最終差分から削除する。**

最終PR exact-head Protocol・Browser(1)/(2)・Firebase Emulator・Regression全成功後のみexpected-headでmainへマージし、main同一SHAのRegression・Pages build/deploy成功および復旧ブランチの一致確認で正式完了とする。
