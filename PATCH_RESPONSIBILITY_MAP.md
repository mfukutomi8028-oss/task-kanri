# パッチ責務マップ（Ver.189 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.189では動的CSSを **22本**、動的JSを **34本**ロードします。Ver.189では旧 `ui-v144.css`〜`ui-v147.css` をactive/requiredから外し、混在していた表示責務を `ui-todo-light-v189.css` / `ui-task-light-v189.css` / `ui-schedule-mobile-v189.css` に分離しました。旧4ファイルは旧manifestキャッシュ互換のため物理保存します。

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
| ToDo軽量操作 | 中 | **Ver.189でCSS責務整理済み** |
| タスク軽量操作 | 中 | **Ver.189でCSS責務整理済み** |
| スケジュール・モバイル表示 | 低 | **Ver.189でCSS責務整理済み** |
| ワークフロー・タスク詳細 | 高 | Ver.182〜187で段階整理 |
| ユーザー・コメント補助 | 高 | 表示補正整理済み、共有書込を含むJS整理は保留 |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | **次候補。書込E2E追加が前提** |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜189 の主な整理

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

旧 `ui-v144.css`〜`ui-v147.css` に跨っていた軽量UIを次の3責務へ分離します。

- `ui-todo-light-v189.css`
  - ToDo完了表示
  - ToDo検索・完了済み折りたたみ
  - 直近7日完了履歴
  - TodayビューのToDoプレビュー
  - ToDoのモバイル表示
- `ui-task-light-v189.css`
  - タスク画面のモバイルツールバー
  - タスク詳細のクイック状態変更表示
- `ui-schedule-mobile-v189.css`
  - モバイルのカレンダー横スクロールと固定セル幅

JSは統合しません。`todo-controls-v144.js` / `todo-tools-v145.js` / `todo-history-v146.js` / `task-ux-v146.js` / `todo-preview-v147.js` の既存責務分離を維持します。

特にToDo追加・編集・タスク化・revision整合性は `app.js` と `todo-sync-v136.js` が正本です。Ver.189では書込本体を変更しません。事前にFirebase EmulatorでToDo追加・完了・編集・タスク化・履歴表示を固定済みです。

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

Ver.189で問題が見つかった場合は `backup/ver188-with-todo-emulator-e2e` を基準に戻せます。

## 次の工程

次候補は業務メモ・予約タスクです。`ui-v167.css` / `ui-v168.css` / `ui-v173.css` / `work-features-v167.js` / `work-features-ui-v168.js` を整理する前に、**業務メモ追加・編集・削除と予約タスク開始日保存／表示のFirebase Emulator E2E** を先に追加します。
