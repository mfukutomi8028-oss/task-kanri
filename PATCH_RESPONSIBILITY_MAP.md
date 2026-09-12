# パッチ責務マップ（Ver.192 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.192では動的CSSを **21本**、動的JSを **34本**ロードします。今回、旧 `ui-v148.css` / `ui-v149.css` / `ui-v150.css` / `ui-v151.css` / `ui-v154.css` をactive/requiredから外し、ワークフロー・タスク詳細の機能所有名へ置換しました。旧資産は旧manifestキャッシュ互換のため物理保存します。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction、コメント、関連タスク、予約タスク等は、対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は、旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. ブランド画像はファイル名だけで不要判定しない。`assets/brand-v184.*` はVer.185以降も現行画像本体である。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| 基盤・旧安定化 | 高 | 保留。次候補は表示CSS2本のみ |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | **Ver.192で旧世代CSSを機能所有名へ整理済み** |
| ユーザー・コメント補助 | 高 | Ver.191で機能所有名へ整理済み |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | Ver.190で表示責務整理済み |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜192 の主な整理

### Ver.182〜183

- `archive-duplicate-v153.js` → `archive-ui-v182.js` / `duplicate-merge-v182.js`
- `inbox-v153.js` → `inbox-ui-v183.js` / `inbox-events-v183.js`

旧ファイルはキャッシュ互換用に保持します。

### Ver.186〜187

- `ui-v152.css` / `ui-v153.css` の責務を `ui-workflow-detail-v186.css` / `ui-inbox-archive-v186.css` へ分離
- `ui-v157.css` に混在していたモバイル補正を各所有CSSへ戻し、`ui-v157.css` をactiveから退役

### Ver.188

旧 `workspace-density-v176.js` / `ui-v176.css` をactiveから退役し、今日／スケジュールの残余責務だけを `core-view-density-v188.js` / `ui-core-density-v188.css` に限定しました。

### Ver.189

旧 `ui-v144.css`〜`ui-v147.css` に跨っていた軽量UIを次の3責務へ整理しました。

- `ui-todo-light-v189.css`
- `ui-task-light-v189.css`
- `ui-schedule-mobile-v189.css`

ToDo追加・編集・タスク化・revision整合性は `app.js` と `todo-sync-v136.js` が正本のままです。

### Ver.190

業務メモ・予約タスクの書込安全網をFirebase Emulator **15件**まで拡張した後、表示側を `ui-work-memo-v190.css` / `ui-reserved-task-v190.css` / `work-features-ui-v190.js` へ整理しました。共有保存・revision transaction・開始日保存の `work-features-v167.js` は変更していません。

その後、ユーザー・コメント整理前にFirebase Emulatorを **19件**へ拡張し、ユーザー追加・同名競合・リアクション追加/解除を固定しました。検証中に見つかったリアクションpatch飢餓のみ、transaction仕様を変えずcoalescingへ最小修正しました。

### Ver.191

ユーザー登録・メンション・コメントリアクションを機能所有名へ整理しました。

- `ui-v156.css` → `ui-comment-mentions-v191.css`
- `ui-v165.css` → `ui-comment-reactions-v191.css`
- `user-add-fix-v155.js` → `user-registration-v191.js`
- `mention-picker-v156.js` → `comment-mentions-v191.js`
- `comment-reactions-v165.js` → `comment-reactions-v191.js`

新旧資産はbyte-for-byte同一とし、DOM hook・Firebase transaction・revision規則を変更していません。

### Ver.192

ワークフロー・タスク詳細に残っていた旧世代CSS5本を、**内容とカスケード順を一切変えず**機能所有名へ置換しました。

- `ui-v148.css` → `ui-workflow-insights-v192.css`
- `ui-v149.css` → `ui-task-prerequisites-comments-v192.css`
- `ui-v150.css` → `ui-task-relations-reminders-v192.css`
- `ui-v151.css` → `ui-task-detail-responsive-v192.css`
- `ui-v154.css` → `ui-task-detail-tools-v192.css`

新旧5CSSはblob SHAが一致する完全同一内容です。`saved-views-v148.js` / `insights-v148.js` / `dependencies-v149.js` / `comments-tabs-v149.js` / `workflow-core-v150.js` / `completion-unpin-v150.js` / `workflow-v152.js` / `relationships-v152.js` / `reminders-v152.js` / `detail-layout-v154.js` などのJavaScriptは変更していません。

旧5CSSはactive/requiredから外しますが、旧manifestキャッシュ互換のため物理保存します。

## Ver.185 ブランド仕様（現行）

- 現行制御: `brand-v185.js`, `ui-brand-v185.css`
- 現行画像本体: `assets/brand-v184.svg`, `assets/brand-v184.png`
- 旧コード互換: `assets/brand.png`
- 旧制御コード: `brand-v184.js`（Ver.185で置換済み）

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

## 次の工程

次候補は基盤グループに残る**表示CSSのみ**です。`activity-dialog-v130.css` / `list-sort-v131.css` の現在の所有責務と重複を監査し、JavaScriptを変更せずに機能所有名へ整理できるか判定します。`stable-fixes-v108.js` / `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` / `version-display-lock.js` はこの工程では触れません。
