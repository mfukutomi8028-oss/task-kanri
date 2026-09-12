# 回帰テスト基盤（Ver.192）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187で退役した `ui-v157.css` と各所有CSSへのモバイル補正移管
- Ver.188のdensity責務、Ver.189のToDo/タスク/スケジュール責務、Ver.190の業務メモ/予約タスク責務
- Ver.191のユーザー登録・メンション・リアクション責務と旧資産とのbyte同一性
- Ver.192のワークフロー・タスク詳細5CSSが旧 `ui-v148/v149/v150/v151/v154.css` とbyte-for-byte同一であること
- Ver.192新5CSSだけがactive/requiredで、旧5CSSはinactiveだがキャッシュ互換用に物理保存されること
- Ver.192の5CSSが旧カスケード位置を維持し、`ui-workflow-detail-v186.css` / `ui-inbox-archive-v186.css` との相対順を変えないこと
- `saved-views-v148.js` / `insights-v148.js` / `dependencies-v149.js` / `comments-tabs-v149.js` / `workflow-core-v150.js` / `completion-unpin-v150.js` / `workflow-v152.js` / `relationships-v152.js` / `reminders-v152.js` / `detail-layout-v154.js` がそのままactiveであること
- Ver.192で新規 `v192.js` 実行経路を追加していないこと
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.192では新規3件を追加し、構造・契約テストは **55件**です。

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

通常ブラウザではFirebase専用19件をskipし、**55件**の通常UI回帰を実行します。既存PNG基準は、意図したデザイン変更でない限り更新しません。

## Ver.192 ワークフロー・タスク詳細CSS責務整理

Ver.192は表示CSSだけを対象とし、旧世代5ファイルを機能所有名へ置換します。

- `ui-v148.css` → `ui-workflow-insights-v192.css`
- `ui-v149.css` → `ui-task-prerequisites-comments-v192.css`
- `ui-v150.css` → `ui-task-relations-reminders-v192.css`
- `ui-v151.css` → `ui-task-detail-responsive-v192.css`
- `ui-v154.css` → `ui-task-detail-tools-v192.css`

新旧CSSはblob SHAまで一致する完全同一内容です。DOM hook、class名、メディアクエリ、カスケード位置は変更しません。旧5CSSはactive/requiredから外しますが、旧manifestキャッシュ互換のため物理保存します。

この工程ではJavaScriptを変更しません。特に前提タスク、コメントタブ、関連タスク、リマインダー、詳細レイアウト、通知、アーカイブ、保存処理の実行経路は既存のままです。

## Ver.191 ユーザー・コメント責務整理

Ver.191では、19件のFirebase Emulator安全網を先に固定したうえで、ユーザー登録・メンション・リアクションを機能所有名へ整理しました。

- `ui-v156.css` → `ui-comment-mentions-v191.css`
- `ui-v165.css` → `ui-comment-reactions-v191.css`
- `user-add-fix-v155.js` → `user-registration-v191.js`
- `mention-picker-v156.js` → `comment-mentions-v191.js`
- `comment-reactions-v165.js` → `comment-reactions-v191.js`

新旧本体はbyte-for-byte同一で、ユーザー登録transaction、revision更新、リアクションtask transaction、メンション表示責務を変更していません。

## 既存の視覚・操作回帰

- `tests/icon-visual.spec.mjs`: ナビ/サマリーアイコン
- `tests/task-toolbar-visual.spec.mjs`: タスクツールバー
- `tests/sidebar-visual.spec.mjs`: sidebar geometry、861/860px境界、ブランド表示
- `tests/sidebar-js-behavior.spec.mjs`: hover/focus/drag/Escape/pinned永続化/reload
- `tests/ui-smoke.spec.mjs`: 主要画面幅と主要導線
- `tests/workflow-inbox-archive-visual.spec.mjs`: 通知・アーカイブ4画面幅
- `tests/mobile-regression-v187.spec.mjs`: メンションpickerとタスク表示のモバイル回帰
- `tests/workspace-density-v188.spec.mjs`: 今日 / ToDo / スケジュール / 業務メモの1366 / 980 / 860 / 390px回帰

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。アーカイブ、通知、重複統合、ToDo、業務メモ、予約タスク、共有ユーザー追加、同名ユーザー競合、コメントリアクション追加/解除まで固定しています。Ver.192は書込JavaScriptを変更しませんが、安全網として19件すべてを継続実行します。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`
- `backup/ver189-with-work-features-emulator-e2e`: `2d64ee501b63968cd6e71129e131d09d16ca4de4`
- `backup/ver190-before-user-comment-write-tests`: `7abf2ad9d56789219ff0b593ca0dabe12e8f144a`
- `backup/ver190-with-user-comment-emulator-e2e`: `b5f50d4fd0f8ae6d293d3ce82b3522009417d624`
- `backup/ver191-before-workflow-detail-css`: `821612c3de5b5cd7c620b3e1ac529c886ad2b2a5`

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

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・ブラウザ・Emulatorを順番に実行します。

## 次の段階

次候補は `activity-dialog-v130.css` / `list-sort-v131.css` の表示責務監査です。JavaScriptは変更せず、現行のダイアログ・一覧表示の視覚回帰を維持したまま、機能所有名へ整理できるかを先に判定します。
