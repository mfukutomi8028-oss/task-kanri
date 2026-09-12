# パッチ責務マップ（Ver.190 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.190では動的CSSを **21本**、動的JSを **34本**ロードします。Ver.190では旧 `ui-v167.css` / `ui-v168.css` / `ui-v173.css` をactive/requiredから外し、業務メモ表示を `ui-work-memo-v190.css`、開始日・予約タスク表示を `ui-reserved-task-v190.css` へ分離しました。旧CSSと旧 `work-features-ui-v168.js` は旧manifestキャッシュ互換のため物理保存します。

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
| 基盤・旧安定化 | 高 | 保留 |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | Ver.182〜187で段階整理 |
| ユーザー・コメント補助 | 高 | **共有書込E2E 19件を固定済み。次の責務整理対象** |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | **Ver.190で表示責務整理済み** |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜190 の主な整理

### Ver.182〜183

- `archive-duplicate-v153.js` → `archive-ui-v182.js` / `duplicate-merge-v182.js`
- `inbox-v153.js` → `inbox-ui-v183.js` / `inbox-events-v183.js`

旧ファイルはキャッシュ互換用に保持します。

### Ver.186〜187

- `ui-v152.css` / `ui-v153.css` の責務を `ui-workflow-detail-v186.css` / `ui-inbox-archive-v186.css` へ分離
- `ui-v157.css` に混在していたモバイル補正を各所有CSSへ戻し、`ui-v157.css` をactiveから退役

### Ver.188

旧 `workspace-density-v176.js` / `ui-v176.css` をactiveから退役しました。ToDo・業務メモのコンパクトUIは所有機能へ戻し、今日／スケジュールの残余責務だけを `core-view-density-v188.js` / `ui-core-density-v188.css` に限定しました。

### Ver.189

旧 `ui-v144.css`〜`ui-v147.css` に跨っていた軽量UIを次の3責務へ分離しました。

- `ui-todo-light-v189.css`: ToDo完了・検索・履歴・Todayプレビュー・モバイル表示
- `ui-task-light-v189.css`: タスク画面モバイルツールバー・詳細クイック状態変更
- `ui-schedule-mobile-v189.css`: モバイルカレンダーの横スクロール・固定セル幅

ToDo追加・編集・タスク化・revision整合性は `app.js` と `todo-sync-v136.js` が正本のままです。

### Ver.190

業務メモ・予約タスクの書込安全網をFirebase Emulator **15件**まで拡張した後、表示側だけを整理しました。

- `ui-v167.css` / `ui-v168.css` / `ui-v173.css`
  - → `ui-work-memo-v190.css`
  - → `ui-reserved-task-v190.css`
- `work-features-ui-v168.js`
  - → `work-features-ui-v190.js`
  - document.body全体のMutationObserverを廃止し、再描画される `#workMemoViewV167` のみを監視
  - ToDo/メモのアイコン置換責務を削除。アイコン寸法は `ui-icon-system-v178.css`、旧アイコン置換は `release-manifest.js` が正本

**変更していないもの:** `work-features-v167.js` の `businessMemos/{id}` / `taskStarts/{taskId}`、revision、`runTransaction`、予約タスク開始日保存フロー。Ver.190では共有書込本体を変更していません。

### Ver.190後：ユーザー・コメント安全網

次候補を触る前にFirebase Emulatorを **19件**へ拡張しました。

- ユーザー管理フォームから共有ユーザー追加
- 2ブラウザ同時同名追加時の重複防止とmeta revision整合性
- コメントリアクション追加とtask revision更新
- コメントリアクション解除と他ユーザー反応保持

検証中、`comment-reactions-v165.js` の表示patchが詳細画面の連続DOM変更でキャンセルされ続け、リアクションUIが生成されない既存不具合を検出しました。Firebase transaction・保存パス・reactionデータ構造・task revision更新規則は変更せず、patch予約だけを「毎回キャンセルするdebounce」から「最初の予約を必ず実行するcoalescing」へ変更しています。

## Ver.185 ブランド仕様（現行）

- 現行制御: `brand-v185.js`, `ui-brand-v185.css`
- 現行画像本体: `assets/brand-v184.svg`, `assets/brand-v184.png`
- 旧コード互換: `assets/brand.png`
- 旧制御コード: `brand-v184.js`（Ver.185で置換済み）

`assets/brand-v184.*` は名称がv184でも現行資産です。全参照移行とテスト確認が完了するまでは、古い名前だけを理由に削除しません。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`
- `backup/ver189-with-work-features-emulator-e2e`: `2d64ee501b63968cd6e71129e131d09d16ca4de4`
- `backup/ver190-before-user-comment-write-tests`: `7abf2ad9d56789219ff0b593ca0dabe12e8f144a`

Ver.190本体へ戻す必要がある場合は `backup/ver190-before-user-comment-write-tests` を基準にできます。

## 次の工程

ユーザー・コメント補助の共有書込安全網19件を基準に、`ui-v156.css` / `ui-v165.css` / `user-add-fix-v155.js` / `mention-picker-v156.js` / `comment-reactions-v165.js` の表示専用責務と共有書込責務を段階的に整理します。メンションpickerのモバイル表示回帰は既存試験を維持し、書込本体は一度に大きく書き換えません。
