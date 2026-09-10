# 回帰テスト基盤

このテストは、既存の業務管理ボードを安全に整理・改修するための最低限の安全網です。

## 自動確認する内容

- 既存の削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産欠落、重複、読込順
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

## 本番Firebaseを触らない仕組み

ブラウザテストでは、ページ読込前に `window.firebaseConfig` をテスト側で無効化します。またFirebase SDKおよびFirebase Databaseホストへの通信をブラウザ側で遮断します。

そのため、このSmokeテストは本番ルームのタスク・予定・ToDo・コメント・業務メモを読み書きしません。UIと配信資産の回帰確認に限定しています。

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

main向けPull Requestとmainへのpushでは `.github/workflows/regression-checks.yml` が自動実行します。ブラウザテスト失敗時はPlaywrightレポートをActions artifactとして7日間保存します。

## 次の段階

この基盤が安定した後、Firebase Emulator専用ルームで以下を追加します。

- タスク新規作成 / 編集 / 単品削除
- 一括削除 / 一括担当者・状態・分類変更
- コメント / メンション / リアクション
- ToDo作成・完了・タスク化
- 予約タスクの開始日変更 / 今日から開始
- スケジュール作成・タスク関連付け
- 業務メモ作成・編集・削除
- 2ブラウザを使ったrevision / Transaction競合試験

本番Firebaseを使った自動テストは行わず、書込系は必ずEmulator内で検証します。
