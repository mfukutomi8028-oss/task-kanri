# 回帰テスト基盤（Ver.189）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187で退役した `ui-v157.css` と各所有CSSへのモバイル補正移管
- Ver.188で退役した `workspace-density-v176.js` / `ui-v176.css` と現行density責務
- Ver.189の `ui-todo-light-v189.css` / `ui-task-light-v189.css` / `ui-schedule-mobile-v189.css` の責務境界
- 旧 `ui-v144.css`〜`ui-v147.css` がactive/requiredへ戻っていないこと、かつキャッシュ互換用に物理保存されること
- ToDo/タスク補助JS 5本が引き続きactiveで、ToDoタスク化のrevision整合性が `app.js` / `todo-sync-v136.js` に残ること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.189の構造・契約テストは **44件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で次を確認します。

- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360pxの主要表示
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログ、開始日、リロード
- sidebar collapsed / expanded / pinned、861/860px境界
- sidebar hover/focus/drag/Escape/localStorage永続化
- アイコン、タスクツールバー、サイドバーの視覚回帰
- Ver.185ブランド仕様
- 通知・アーカイブの1366 / 860 / 430 / 390px視覚回帰
- メンションpicker / タスク表示の860 / 430 / 390px視覚回帰
- Ver.188の今日 / ToDo / スケジュール / 業務メモの密度・主要操作配置
- 同一オリジン404、JavaScript例外、動的資産読込失敗、横スクロール発生の検出

通常ブラウザではFirebase専用15件をskipし、**55件**の通常UI回帰を実行します。既存PNG基準は、意図したデザイン変更でない限り更新しません。

## Ver.189 ToDo・タスク軽量UI整理

Ver.189では旧 `ui-v144.css`〜`ui-v147.css` の表示責務を次の3本へ分離します。

- `ui-todo-light-v189.css`
  - ToDo完了ボタン
  - ToDo検索・完了済み折りたたみ
  - 直近7日完了履歴
  - Today ToDoプレビュー
  - ToDoモバイル表示
- `ui-task-light-v189.css`
  - タスク画面のモバイルツールバー
  - タスク詳細のクイック状態変更表示
- `ui-schedule-mobile-v189.css`
  - モバイルカレンダーの横スクロールと固定セル幅

旧 `ui-v144.css`〜`ui-v147.css` はactive/requiredから外しますが、旧manifestキャッシュ互換のため物理保存します。

JS側は今回統合しません。

- `todo-controls-v144.js`
- `todo-tools-v145.js`
- `todo-history-v146.js`
- `task-ux-v146.js`
- `todo-preview-v147.js`

これらは既存責務のままactiveを維持し、ToDo追加・編集・タスク化・revision整合性の書込本体は `app.js` / `todo-sync-v136.js` に残します。

## 既存の視覚・操作回帰

- `tests/icon-visual.spec.mjs`: ナビ/サマリーアイコン
- `tests/task-toolbar-visual.spec.mjs`: 1920/1720/1719/1450/1449/1366pxのタスクツールバー
- `tests/sidebar-visual.spec.mjs`: sidebar geometry、861/860px境界、Ver.185ブランド表示仕様とfavicon
- `tests/sidebar-js-behavior.spec.mjs`: hover/focus/drag/Escape/pinned永続化/reload
- `tests/ui-smoke.spec.mjs`: 主要画面幅と主要導線
- `tests/workflow-inbox-archive-visual.spec.mjs`: 通知・アーカイブ4画面幅
- `tests/mobile-regression-v187.spec.mjs`: メンションpickerとタスク表示のモバイル回帰
- `tests/workspace-density-v188.spec.mjs`: 今日 / ToDo / スケジュール / 業務メモの1366 / 980 / 860 / 390px回帰

## Firebase Emulator E2E

本番RTDBではなく、次の隔離環境だけを使用します。

- project: `demo-task-kanri`
- Realtime Database Emulator: `127.0.0.1:9000`
- test用roomのみ
- `firebaseio.com` / `firebasedatabase.app` へのブラウザ通信を遮断

書込系はブラウザ/WebSocket/sidecarの後処理が次ケースへ干渉しないよう、**1ケース＝1 Playwrightプロセス**で実行します。Emulator本体は同一プロセス内で維持します。

現在の15ケース:

1. Emulator接続で共同編集ONまで到達
2. 完了タスクのアーカイブ／復元
3. 通知保存・未読／既読状態
4. 担当者変更から通知イベント自動生成
5. 2ブラウザ同一通知IDの冪等保存
6. 重複タスク統合とarchive/duplicateメタデータ
7. ToDo＋メモ新規追加とcanonical record/revision保存
8. Ver.144完了操作とcompletedAt/revision更新
9. ToDo件名・メモ編集とrevision更新
10. ToDo→正式タスク化、メモ引継ぎ、元ToDo完了
11. Firebase同期済み過去完了ToDoの7日履歴表示
12. 業務メモ追加とcanonical record/revision保存
13. 業務メモ編集とrevision更新
14. 業務メモ削除とRTDB/UIからの消去
15. 未来開始日の予約タスク保存と予約タスクUI表示

ToDo 5ケースはPR #17で先行追加し、Ver.189の本体整理前にmainで成功を確認しています。業務メモ・予約タスク4ケースは、次の責務整理前に書込契約を固定するため追加します。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`

## 実行方法

通常回帰:

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

Firebase Emulator:

```bash
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・ブラウザ・Emulatorを順番に実行します。失敗時だけPlaywright/Firebaseログをartifactへ保存します。

## 次の段階

業務メモ・予約タスクの書込安全網を15ケースまで拡張した後、`ui-v167.css` / `ui-v168.css` / `ui-v173.css` / `work-features-v167.js` / `work-features-ui-v168.js` の責務を棚卸しします。書込本体・revision transaction・開始日保存契約は維持したまま、表示/UI補助の混在と重複を先に特定し、分離可能な責務だけを次バージョンで整理します。
