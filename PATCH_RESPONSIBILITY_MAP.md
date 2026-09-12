# パッチ責務マップ（Ver.194 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.194では動的CSS **21本**、動的JS **34本**の構成を維持したまま、`stable-fixes-v108.js` と `version-display-lock.js` のバージョン責務競合だけを解消します。バージョン番号の正本は `window.WORK_BOARD_RELEASE.version` です。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction、コメント、関連タスク、予約タスク等は、対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は、旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. 基盤JavaScriptは、現在の振る舞いを個別テストで固定してから、1責務ずつ最小変更する。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| お知らせダイアログ・一覧ソート表示 | 低 | Ver.193で機能所有名へ整理済み |
| 基盤・旧安定化ロジック | 高 | **Ver.194でバージョン正本競合を解消。残る複数責務は次工程で監査** |
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

### Ver.193

基盤グループに残っていた表示CSS2本を監査し、`ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` へ機能所有名で置換しました。新旧CSSはbyte-for-byte同一、dynamicStylesの先頭2位置も維持しています。

## Ver.193後 基盤JavaScript安全網

製品JavaScriptを変更せず、`tests/foundation-js-behavior-v194.spec.mjs` で次の5挙動を固定しました。

1. manifest版の画面表示復元
2. 基本状態削除保護と「7日間」ラベル補正
3. 分割日付入力の正常値反映と不正日付拒否
4. 「今日」表示中の前後移動抑止
5. 一覧列ソート、昇降順、localStorage永続化、基本ソート変更時の解除

この監査で、`stable-fixes-v108.js` の旧 `VERSION = "122"` と `version-display-lock.js` のmanifest参照が競合していることを確認しました。

## Ver.194 バージョン正本整理

Ver.194では上記競合だけを最小修正します。

- `release-manifest.js` の `WORK_BOARD_RELEASE.version` を唯一の番号正本とする
- `stable-fixes-v108.js` から旧 `VERSION = "122"` を除去
- `stable-fixes-v108.js` は `WORK_BOARD_VERSION` を書き込まない
- stable-fixes内の表示補正はmanifest版を参照
- `version-display-lock.js` はmanifestから表示と互換変数を同期する責務を維持
- `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` は変更しない
- 基本状態保護、日付制約、Todayフィルタ、モバイル補正等のstable-fixes既存責務は維持

静的契約 `test-harness/version-source-v194.test.mjs` を3件追加し、Protocolは **61件**。通常UI **60件**、Firebase Emulator **19件**を継続します。

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
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`

## 次の工程

Ver.194完了後は `stable-fixes-v108.js` に残る複数責務を**まず監査だけ**します。モバイル補正・基本状態保護・日付制約・Todayフィルタのうち、機能所有側へ安全に移せるものを洗い出し、必要な追加安全網を先に作成します。即時分割は行いません。
