# 回帰テスト基盤（Ver.191）

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
- Ver.190の `ui-work-memo-v190.css` / `ui-reserved-task-v190.css` / `work-features-ui-v190.js` の責務境界
- Ver.191の `ui-comment-mentions-v191.css` / `ui-comment-reactions-v191.css` / `user-registration-v191.js` / `comment-mentions-v191.js` / `comment-reactions-v191.js` の責務境界
- Ver.191新資産が旧v155/v156/v165資産とbyte-for-byte同一で、既存DOM hook・書込仕様を維持すること
- メンションhelperにFirebase書込責務が混入していないこと
- ユーザー登録のmeta transactionと3つのrevision更新が残ること
- コメントリアクションのtask transaction、`revision + 1`、非飢餓型patch予約が残ること
- 旧ユーザー・コメント5資産がactive/requiredへ戻っていないこと、かつキャッシュ互換用に物理保存されること
- 旧業務メモ関連資産がactive/requiredへ戻っていないこと、かつキャッシュ互換用に物理保存されること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.191では新規4件を追加し、構造・契約テストは **52件**です。

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

## Ver.191 ユーザー・コメント責務整理

Ver.191では、19件のFirebase Emulator安全網を先に固定したうえで、ユーザー登録・メンション・リアクションを機能所有名へ整理します。

- `ui-v156.css` → `ui-comment-mentions-v191.css`
- `ui-v165.css` → `ui-comment-reactions-v191.css`
- `user-add-fix-v155.js` → `user-registration-v191.js`
- `mention-picker-v156.js` → `comment-mentions-v191.js`
- `comment-reactions-v165.js` → `comment-reactions-v191.js`

挙動変更を避けるため、新資産の本体は確認済み旧資産と **byte-for-byte同一** にします。既存の `v155/v156/v165` DOM class、data属性、内部関数名も互換性のため変更しません。

静的契約で次を固定します。

- 新5資産のみがactive/requiredであること
- 旧5資産はactive/requiredではないが物理保存されること
- メンションCSSとリアクションCSSが互いのselectorを所有しないこと
- メンションJSにFirebase書込がないこと
- ユーザー登録は `rooms/{room}/meta` transaction、`users/userColors/usersUpdatedAt` のrevision更新を維持すること
- リアクションはtask transaction、`revision + 1`、`if (patchTimer) return` のcoalescingを維持すること

## Ver.190 業務メモ・予約タスク表示責務整理

Ver.190では書込本体を変更せず、旧3本のCSSを機能所有単位へ分離しました。

- `ui-work-memo-v190.css`: 業務メモ画面・ツールバー・カード・ダイアログ
- `ui-reserved-task-v190.css`: 未来開始タスク・開始日UI・予約タスク一覧/ダイアログ
- `work-features-ui-v190.js`: 表示補助のみ。再描画監視を `#workMemoViewV167` に限定

`work-features-v167.js` の業務メモ/開始日revision transaction、新規タスク保存後の開始日保存フローは変更していません。

## Ver.190後 ユーザー・コメント安全網

ユーザー・コメント補助の責務整理前に、共有書込をFirebase Emulatorで固定しました。

- 実ユーザー管理フォームからの共有ユーザー追加
- 2ブラウザ同時同名追加時の重複防止とmeta revision整合性
- 実コメントリアクションpickerからのリアクション追加
- 既存リアクションから現在ユーザーのみ解除し、他ユーザーを保持する更新

検証中、`comment-reactions-v165.js` の表示patchが詳細画面の連続DOM変更で何度もキャンセルされ、リアクションUIが生成されない既存不具合を検出しました。Firebase transaction・保存パス・reactionデータ形式・task revision更新規則は変更せず、patch予約だけを「毎回キャンセルするdebounce」から「最初の予約を必ず実行するcoalescing」へ変更しています。

## Ver.189 ToDo・タスク軽量UI整理

Ver.189では旧 `ui-v144.css`〜`ui-v147.css` の表示責務を次の3本へ分離しました。

- `ui-todo-light-v189.css`: ToDo完了・検索・履歴・Todayプレビュー・モバイル表示
- `ui-task-light-v189.css`: タスク画面モバイルツールバー・詳細クイック状態変更
- `ui-schedule-mobile-v189.css`: モバイルカレンダー横スクロール・固定セル幅

ToDo追加・編集・タスク化・revision整合性の書込本体は `app.js` / `todo-sync-v136.js` に残します。

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

現在の19ケース:

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
16. ユーザー管理フォームから共有ユーザー追加とmeta revision更新
17. 2ブラウザ同時同名ユーザー追加の冪等性
18. コメントリアクション追加とtask revision更新
19. コメントリアクション解除と他ユーザー反応保持

ユーザー・コメント4ケースはPR #21でmainへ追加し、Ver.191責務整理の直前にPR側・main側とも19件すべてgreenを確認済みです。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`
- `backup/ver189-with-work-features-emulator-e2e`: `2d64ee501b63968cd6e71129e131d09d16ca4de4`
- `backup/ver190-before-user-comment-write-tests`: `7abf2ad9d56789219ff0b593ca0dabe12e8f144a`
- `backup/ver190-with-user-comment-emulator-e2e`: `b5f50d4fd0f8ae6d293d3ce82b3522009417d624`

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

次候補はワークフロー・タスク詳細に残る旧世代の表示CSSです。`ui-v148.css` / `ui-v149.css` / `ui-v150.css` / `ui-v151.css` / `ui-v154.css` のカスケード順とDOM hookを維持しながら、書込JavaScriptには触れずに機能所有単位へ整理します。
