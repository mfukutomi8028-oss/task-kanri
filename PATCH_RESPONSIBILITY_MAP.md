# パッチ責務マップ（Ver.193 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.193では動的CSSを **21本**、動的JSを **34本**ロードします。今回、基盤グループに残っていた表示CSS `activity-dialog-v130.css` / `list-sort-v131.css` をactive/requiredから外し、`ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` へ機能所有名で置換しました。旧CSSは旧manifestキャッシュ互換のため物理保存します。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction、コメント、関連タスク、予約タスク等は、対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は、旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. 基盤JavaScriptは、現在の振る舞いを個別テストで固定する前に統合・改変しない。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| お知らせダイアログ・一覧ソート表示 | 低 | **Ver.193で機能所有名へ整理済み** |
| 基盤・旧安定化ロジック | 高 | 保留。次工程は振る舞い安全網の追加 |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | Ver.192で旧世代CSSを機能所有名へ整理済み |
| ユーザー・コメント補助 | 高 | Ver.191で機能所有名へ整理済み |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | Ver.190で表示責務整理済み |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜193 の主な整理

### Ver.182〜183

- `archive-duplicate-v153.js` → `archive-ui-v182.js` / `duplicate-merge-v182.js`
- `inbox-v153.js` → `inbox-ui-v183.js` / `inbox-events-v183.js`

### Ver.186〜187

- `ui-v152.css` / `ui-v153.css` → `ui-workflow-detail-v186.css` / `ui-inbox-archive-v186.css`
- `ui-v157.css` のモバイル補正を各所有CSSへ戻し、activeから退役

### Ver.188〜190

- Ver.188: density責務を `core-view-density-v188.js` / `ui-core-density-v188.css` に限定
- Ver.189: `ui-v144.css`〜`ui-v147.css` の軽量UIをToDo・タスク・スケジュールへ分離
- Ver.190: 業務メモ・予約タスクの書込安全網をFirebase Emulator 15件へ拡張後、表示責務を整理
- Ver.190後: ユーザー・コメント安全網をFirebase Emulator **19件**へ拡張

### Ver.191

ユーザー登録・メンション・コメントリアクションを機能所有名へ整理しました。新旧資産はbyte-for-byte同一とし、DOM hook・Firebase transaction・revision規則を変更していません。

### Ver.192

ワークフロー・タスク詳細の旧世代CSS5本を、内容とカスケード順を変えず機能所有名へ置換しました。

- `ui-v148.css` → `ui-workflow-insights-v192.css`
- `ui-v149.css` → `ui-task-prerequisites-comments-v192.css`
- `ui-v150.css` → `ui-task-relations-reminders-v192.css`
- `ui-v151.css` → `ui-task-detail-responsive-v192.css`
- `ui-v154.css` → `ui-task-detail-tools-v192.css`

関連JavaScriptは変更していません。

### Ver.193

基盤グループに残っていた表示CSS2本を監査した結果、それぞれ単一責務であることを確認しました。無理に1本へ統合せず、**機能所有名への置換だけ**を行います。

- `activity-dialog-v130.css` → `ui-activity-dialog-v193.css`
  - `#activityDialog` / お知らせ一覧ダイアログ専用
- `list-sort-v131.css` → `ui-task-list-sort-v193.css`
  - `list-sort-v131.js` が生成するタスク一覧列ソートUI専用

新旧2CSSはblob SHAが一致する完全同一内容です。dynamicStylesの先頭2位置も維持し、selector・media query・カスケードを変更していません。

**変更していないもの:** `stable-fixes-v108.js` / `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` / `version-display-lock.js`。Ver.193では新しいJavaScript実行経路も追加しません。

旧2CSSはactive/requiredから外しますが、旧manifestキャッシュ互換のため物理保存します。

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

## 次の工程

次工程は基盤・旧安定化JavaScriptの**改修ではなく安全網作成**です。`stable-fixes-v108.js` / `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` / `version-display-lock.js` の現在責務を監査し、DOM変更、入力補正、localStorage、ソート、バージョン表示の振る舞いを個別テストで固定します。安全網が整うまでは統合・退役・ファイル名変更を行いません。
