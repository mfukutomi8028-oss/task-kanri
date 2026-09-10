# 回帰テスト基盤

このテストは、既存の業務管理ボードを安全に整理・改修するための安全網です。

## 自動確認する内容

- 既存の削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産欠落、重複、読込順
- `patch-responsibilities.json` が動的CSS/JSを1対1で漏れなく分類していること
- 責務グループの重複、存在しないパッチ参照、整理優先順位の不整合
- ルート直下JavaScriptの構文エラー
- GitHub PagesデプロイWorkflowの二重化
- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360px の初期表示
- 861px以上のPCサイドバー折りたたみ
- hover展開時にメイン画面を押し動かさないこと
- 固定時のみ左側276px程度を確保すること
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログと開始日フィールド
- F5後も現行リリースと新アイコンが維持されること
- 同一オリジンの404やJavaScript例外
- 動的CSS/JSの読込失敗
- PC 1366pxのcollapsed/expandedナビゲーションのPNG視覚差分
- スマホ390pxのナビゲーションとタスクサマリーのPNG視覚差分

パッチ整理の責務・リスク・統合順は `PATCH_RESPONSIBILITY_MAP.md` と `patch-responsibilities.json` を正本として管理します。

## 視覚回帰

`tests/icon-visual.spec.mjs` と `tests/icon-visual.spec.mjs-snapshots/` は、Ver.177の統合前表示をGitHub Actions上のChromiumで撮影した基準です。

Ver.178では `ui-v169.css` / `ui-v170.css` / `ui-v171.css` を `ui-icon-system-v178.css` へ統合しています。通常のSmokeだけでなく、このPNG基準と比較することで、アイコン寸法・余白・フレームなどの意図しない表示差を検出します。

基準画像の更新は通常の改修で自動実行しません。デザイン変更として見た目を意図的に変える場合だけ、差分内容を確認してから基準を更新します。

## 本番Firebaseを触らない仕組み

ブラウザテストでは、ページ読込前に `window.firebaseConfig` をテスト側で無効化します。またFirebase SDKおよびFirebase Databaseホストへの通信をブラウザ側で遮断します。

そのため、このSmoke/視覚テストは本番ルームのタスク・予定・ToDo・コメント・業務メモを読み書きしません。UIと配信資産の回帰確認に限定しています。

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

main向けPull Requestとmainへのpushでは `.github/workflows/regression-checks.yml` が自動実行します。ブラウザテスト失敗時はPlaywrightレポートをActions artifactとして7日間保存します。

## 次の段階

次の低～中リスク整理候補は `ui-v162.css` / `ui-v163.css` のタスクツールバーです。collapsed/expanded/pinned、詳細パネルopen/closed、1366/980/861pxの視覚回帰を追加してから統合します。

書込系については、その後Firebase Emulator専用ルームで以下を追加します。

- タスク新規作成 / 編集 / 単品削除
- 一括削除 / 一括担当者・状態・分類変更
- コメント / メンション / リアクション
- ToDo作成・完了・タスク化
- 予約タスクの開始日変更 / 今日から開始
- スケジュール作成・タスク関連付け
- 業務メモ作成・編集・削除
- 2ブラウザを使ったrevision / Transaction競合試験

本番Firebaseを使った自動テストは行わず、書込系は必ずEmulator内で検証します。
