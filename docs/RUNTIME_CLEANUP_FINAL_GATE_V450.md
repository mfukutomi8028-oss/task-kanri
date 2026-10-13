# Ver.450 — Stage C/E実行コード・公開配布・残存資産の整理判断

**Issue #292 / 基準:** Ver.449正式main `ee7b404bacdceddc0e862a8f98058e9a3d1e3250`、同SHA Regression #38357248356 / Pages #38357248336成功、復旧branch `backup/ver449-firebase-access-boundary-audit-validated-checkpoint`一致。今回はコード/公開配布整理に戻り、別件のSecurity Issue #368は未着手のままにする。各数字はこの起点のGit tree/配布ログに対応する。

## 1. 実行ファイル責務の突合と実作業

- ルートの `.js` / `.css` は **66ファイル**。`release-manifest.js` の `requiredAssets` / `optionalAssets` / `dynamicStyles` / `dynamicScripts` / `mobileScripts` の5リストの和集合により、現役の**65ファイル**が宣言済み。唯一の非宣言ルートJSは開発者向け `config.example.js` (481 bytes) で、`index.html` / `config.js` / manifest のランタイム読込には含まれない。
- `patch-responsibilities.json` と `test-harness/patch-responsibility.test.mjs` はdynamicScripts/dynamicStylesの各資産について責務groupを**ちょうど一つ**要求している。これは重複ファイルの存在を自動検知する完全な意味解析ではない。`app.js` (344,122 bytes)・`style.css` (208,601 bytes)の内部責務重複を完全に否定するものでもない。大規模な一括分割は本工程ではしない。
- 従来の `test-harness/build-pages-runtime-v382.mjs` はルートのhtml/js/cssをmanifest未宣言でも配布していた。**Ver.450は配布元を宣言済み資産に限定**し、`config.example.js`はGit管理の設定サンプルとして残しつつPages配布から除外する。新たな未宣言webルート資産が追加された場合は、黙って公開せずビルドを失敗させる（fail closed）。
- `config.example.js` の旧公開URLは今回から404となる可能性がある。現行manifest/初期HTML/loaderに利用経路はないが、外部の独自参照がゼロである証明はない。現役 `config.js`・release304配布資産・旧キャッシュ用JS/CSS/画像のURL生成は変更しない。
- `test-harness/pages-runtime-v382.test.mjs` で、非宣言JS拒否、開発者サンプル非配布、誤ってmanifestに追加した場合の拒否、および源ファイルの存続を検証。`tests/pages-packaged-browser-v383.spec.mjs` では1366/390pxのHTTP404を追加して実配布物を検査する。既存の全PNG SHA / legacy CSS/JS byte契約を一切緩めない。

## 2. Stage E 残存11文書：すべて意図した保持（Ver.450では削除しない）

| Root Markdown | 今残す理由 |
| --- | --- |
| `AUTO_ARCHIVE_CLOCK_AUDIT_V364.md` | 書込競合・6時間周期と複数タブ |
| `COMPLETION_UNPIN_LIFECYCLE_AUDIT_V365.md` | 完了解除のtransaction/再試行 |
| `COMPLETED_BOARD_SCOPE_V373_PRODUCT.md` | 完了ボードのスコープ・画面適合 |
| `INBOX_KEYBOARD_FOCUS_V372.md` | 個人Inboxのキーボード・フォーカス |
| `MOBILE_SHELL_BOARD_OBSERVER_V300.md` | モバイルボード監視境界 |
| `MOBILE_SHELL_KEYDOWN_LIFECYCLE_PRODUCT_V312.md` | Escape/keydownリスナーの寿命 |
| `MOBILE_SHELL_NAVIGATION_HANDOFF_V306.md` | モバイルナビゲーション引継ぎ |
| `TODAY_SIDEBAR_FILTERS_V375.md` | Todayフィルター挙動の正本 |
| `CI_NPM_EXPRESS_RECOVERY_V384.md` | 依存取得障害時のCI復旧 |
| `LEGACY_WORKFLOW_RETIREMENT_V384.md` | 旧writer再導入の予防 |
| `VER375_EMULATOR_RECONNECT_CI_RECOVERY.md` | Emulator再接続試験の障害履歴 |

Ver.438の当時の未参照16件からVer.447で2件、Ver.448で3件が固定原本へ退役し、**残り11件**を再確認した結果。文字列ownerが0であっても、事故復旧や仕様判断の根拠を削除する証拠にはならない。退役文書31件には既存Stage Eの再参照防止テストがある。URL移転・削除は別工程で承認を伴わせる。

## 3. 旧PNGの物理保持：8ファイル

次の資産は合計 **10,302,485 bytes**。現行画面がSVGへ移行済みでも、古いHTML/ブラウザキャッシュの直URLとPagesの互換性契約が存在する。現在の利用者キャッシュが消滅した証明がないため、Ver.450では削除しない。

- `assets/nav-done.png`
- `assets/nav-schedule-v87.png`
- `assets/nav-star-menu.png`
- `assets/nav-task-v87.png`
- `assets/nav-today-v87.png`
- `assets/summary-mine.png`
- `assets/summary-open.png`
- `assets/summary-overdue.png`

Pagesは過去配布のJS/CSS/画像のimmutable byte保持・alias/frozen asset生成を今後も必要とする。`assets/nav-memo-v167.svg` は現役実装から直接参照されるため残す。旧PNG 8件を削除したい場合は、互換期間、旧HTMLの通信実測、404許容範囲、復元試験を別に評価する。

## 4. 受入条件・今後の整理

- 変更はPages staging builder、既存Protocol検査、既存packaged Browser検査とこの台帳の**4ファイル**。Git管理rootのコード・設定サンプルは削除しない。業務処理、保存/Firebase/Rules/Auth、Release番号/manifest、旧画像やキャッシュ用frozen archive、CI workflowに変更なし。
- baseline Pages #38357248336の**157 files / 13,078,221 bytes**から開発用サンプル1件（481 bytes）だけ減り、**156 files / 13,077,740 bytes**になることを期待する。実測の最終判定はPages Actions実行結果とBrowser 404/200を優先。Git treeのファイル数は台帳追加分だけ増えるため、Pagesの公開削減とGit履歴削減を混同しない。
- exact PR headのProtocol/Browser 2 shard/Firebase/最終Regression全success → expected-headでmain統合 → main同SHA RegressionとPages成功 → 同SHA checkpoint作成・Git ref再取得/compare一致。いずれか失敗した場合は承認せず調査する。
- 次の判断は `app.js` と `style.css` の内部責務分離の費用対効果を機能単位で評価し、変更する場合は回帰保証できる最小単位にする。旧PNG8件と残存11文書は**保留理由が明示された保持資産**として管理する。Stage C/Eを完了したと断定するには、重複責務の残件・保持資産の判定基準・Issue #292の終了条件を別に確認する。
