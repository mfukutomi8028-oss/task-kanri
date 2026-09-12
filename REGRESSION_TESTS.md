# 回帰テスト基盤（Ver.193）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187〜192で整理済みの表示責務・書込責務境界
- Ver.193の `ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` が旧 `activity-dialog-v130.css` / `list-sort-v131.css` とbyte-for-byte同一であること
- Ver.193新2CSSだけがactive/requiredで、旧2CSSはinactiveだがキャッシュ互換用に物理保存されること
- Ver.193新2CSSがdynamicStylesの先頭2位置を維持すること
- `#activityDialog` の既存DOM契約と `list-sort-v131.js` の一覧ソート実行経路が維持されること
- Ver.193で新規JavaScript実行経路を追加していないこと
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.193では新規3件を追加し、構造・契約テストは **58件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で次を確認します。

- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360pxの主要表示
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログ、開始日、リロード
- sidebar collapsed / expanded / pinned、861/860px境界
- アイコン、タスクツールバー、サイドバーの視覚回帰
- Ver.185ブランド仕様
- 通知・アーカイブの1366 / 860 / 430 / 390px視覚回帰
- メンションpicker / タスク表示の860 / 430 / 390px視覚回帰
- Ver.188の画面密度・主要操作配置
- 同一オリジン404、JavaScript例外、動的資産読込失敗、横スクロール発生の検出

通常ブラウザではFirebase専用19件をskipし、**55件**の通常UI回帰を実行します。既存PNG基準は、意図したデザイン変更でない限り更新しません。

## Ver.193 基盤表示CSS責務整理

Ver.193では基盤グループに残っていた表示CSS2本だけを対象にします。

- `activity-dialog-v130.css` → `ui-activity-dialog-v193.css`
- `list-sort-v131.css` → `ui-task-list-sort-v193.css`

監査の結果、前者は `#activityDialog` のお知らせ一覧ダイアログ専用、後者は `list-sort-v131.js` が生成するタスク一覧列ソートUI専用でした。責務が明確に異なるため1本へ統合せず、機能所有名へ置換します。

新旧CSSはblob SHAまで一致する完全同一内容です。selector、media query、ロード位置、カスケードを変更しません。旧2CSSはactive/requiredから外しますが、旧manifestキャッシュ互換のため物理保存します。

この工程では `stable-fixes-v108.js` / `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` / `version-display-lock.js` を変更しません。

## Ver.192 ワークフロー・タスク詳細CSS責務整理

- `ui-v148.css` → `ui-workflow-insights-v192.css`
- `ui-v149.css` → `ui-task-prerequisites-comments-v192.css`
- `ui-v150.css` → `ui-task-relations-reminders-v192.css`
- `ui-v151.css` → `ui-task-detail-responsive-v192.css`
- `ui-v154.css` → `ui-task-detail-tools-v192.css`

新旧CSSは完全同一で、関連JavaScriptは変更していません。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。アーカイブ、通知、重複統合、ToDo、業務メモ、予約タスク、共有ユーザー追加、同名ユーザー競合、コメントリアクション追加/解除まで固定しています。Ver.193は書込JavaScriptを変更しませんが、安全網として19件すべてを継続実行します。

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
- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`

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

次工程は基盤・旧安定化JavaScriptの**振る舞いテスト追加**です。`stable-fixes-v108.js` / `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` / `version-display-lock.js` を監査し、DOM変更・入力補正・localStorage・列ソート・バージョン表示を個別に固定します。安全網が整うまでは基盤JSを統合・退役・改名しません。
