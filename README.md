# 業務管理ボード

病院のシステム課などで、日常業務のタスク・予定・個人ToDo・申し送りを整理する静的Webアプリです。GitHub Pagesで配布し、Firebase Realtime Databaseへの接続時に共有データを同期します。現行実装は認証・閲覧権限の安全な境界を保証していないため、**患者情報、要配慮個人情報、パスワードなどの機密情報を入力しないでください**。

本READMEは**現行構成の入口**です。過去Ver.1〜143の詳細な更新履歴は[旧README（Ver.383時点の履歴）](https://github.com/mfukutomi8028-oss/task-kanri/blob/244fb55479a16789e85c3acdd3e2ada4eae976cb/README.md)およびGit履歴に残しています。

## 主な機能

- 今日の確認画面、個人ToDo、タスクのボード・一覧・タイムライン表示
- 予定登録と繰り返し・複数日コピー、状態・担当者・期限による検索・絞り込み
- 業務メモ、コメント・返信・リアクション、通知・リマインダー、ワークフロー補助
- PC・スマートフォンへの対応、ローカル保存フォールバックと共有データ同期

実装の詳細は現行ソースと回帰テストを正本とします。画面・保存動作の仕様を旧版リリースノートだけで判断しないでください。

## 構成と公開

| パス | 役割 |
| --- | --- |
| index.html | 画面の初期DOMとエントリ |
| release-manifest.js | 現行Release番号・必要なJS/CSS/画像資産の正本 |
| config.js | ブラウザ側Firebase設定、必要な資産のロードとバージョン同期 |
| app.js | タスク・予定などのアプリ本体 |
| その他のルートJS/CSS・assets/ | 機能別コード・デザイン・旧ブラウザ互換資産 |
| patch-responsibilities.json | 実装責務とbaselineReleaseの管理 |
| test-harness/・tests/ | Protocol・Playwright・Firebase Emulatorテスト |
| .github/workflows/regression-checks.yml | Protocol・Browser・Firebaseを独立実行し最終ゲートで判定 |
| .github/workflows/pages.yml | mainの配布資産を検査・ステージングしてPagesへ公開 |

2026年10月9日時点の現行Releaseは **304** です。正式な公開バージョンを確認する場合は、release-manifest.js の version と patch-responsibilities.json の baselineRelease が一致するかを確認してください。将来のリリースではこのREADMEの数字を基準にしないでください。

GitHub Pagesは test-harness/build-pages-runtime-v382.mjs が生成する .pages-runtime/ を公開します。実行用のルートHTML/JS/CSSとassets/を残し、テストコード・開発設定・監査文書はWeb公開から除外します。互換用の過去JS/CSS/画像には、キャッシュ済みの旧HTMLが参照する可能性があるため、参照調査なしに削除しないでください。

Ver.390では、現行CSSと完全同一の旧CSS 7件をGitから退役し、Pagesのステージング時だけ同一バイトで旧URLを生成します。旧URLの公開を維持しながら重複ファイルを削減する仕組みです。互換マップと退役前の内容ハッシュはテストで保護します（[整理台帳](docs/LEGACY_RUNTIME_ASSET_RETIREMENT_V389.md)）。
Ver.391では旧JS・CSS・画像の重複3件にも同じ公開互換方式を拡張し、公開URLを保ちつつGit内の重複を除きます。

## 開発環境と検証

GitHub ActionsではNode.js 24を使用します。実行環境でNode.js、npm、Chromium、Firebase Emulatorが動くことを確認してください。

~~~bash
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
npm run test:protocol
npm run test:ui
npm run test:firebase
~~~

- Protocol: source/保存契約・リリース整合・資産存在・退役条件などを検査
- UI: Playwrightでデスクトップ/モバイルの操作、画面表示、配布パッケージの実起動を検査
- Firebase Emulator: 本番DBを使用せず、ローカルで競合・保存・復元を検証

Windowsでは `powershell -NoProfile -File .\release-check.ps1`、PowerShell 7環境では `pwsh -NoProfile -File ./release-check.ps1` を使い、現行のNodeリリース契約テストを同じ基準で確認できます（Node.jsが必要です）。

変更の受入は、PRの**exact-head**で3系統のテストと最終regressionゲートを全成功させることです。マージ後もmainのRegressionとPagesの同SHA成功を確認し、復旧用checkpointを作成します。CI成功と実運用環境の利用者確認は別のものです。

npmの直接devDependenciesはpackage.jsonで管理しています。2026年10月に依存先Express 5系の配布エラーが発生したため限定overrideを適用しています。間接依存全体のlockfile固定は未実施であり、再現性改善の継続課題です。

## データとセキュリティ

- Firebase Realtime Databaseのアプリ設定はconfig.jsに配置されています。ブラウザ向け設定値を秘匿認証と誤解しないでください。
- リポジトリの firebase-rules.json は rooms 配下に .read:true / .write:true を許可する**認証なしの簡易設定**です。表示名やルームID、共有URLは認証・アクセス権限の代替になりません。
- 当該設定のまま、患者情報・医療記録・個人識別情報・秘密情報を保存してはいけません。正式な医療機関運用にはFirebase Authentication、最小権限のDatabase Rules、利用者管理、監査、バックアップ/復旧の設計と独立したセキュリティ検証が必要です。
- 本番接続の操作やRules変更は、既存業務データの閲覧・書込範囲へ影響するため、十分な検証と責任者判断を経てください。通常の自動テストはEmulatorで実施します。

## 変更履歴・整理計画

- [履歴へ移した旧版監査・リリース文書（Ver.145〜214）](docs/HISTORICAL_NOTES_ARCHIVE_V387.md)
- [回帰テストの詳細](REGRESSION_TESTS.md)
- [現行責務と旧コード互換](PATCH_RESPONSIBILITY_MAP.md)
- [物理ファイル整理ロードマップ（Issue #292）](https://github.com/mfukutomi8028-oss/task-kanri/issues/292)
- [GitHub Pull Requests](https://github.com/mfukutomi8028-oss/task-kanri/pulls)
- [過去READMEの正本（Ver.383時点）](https://github.com/mfukutomi8028-oss/task-kanri/blob/244fb55479a16789e85c3acdd3e2ada4eae976cb/README.md)

昔のリリースノートや作業結果はGit履歴に残ります。このREADMEには現行の使い方・安全境界・開発入口だけを維持し、詳細な監査結果は変更PRや個別文書へ記録します。
