# パッチ責務マップ（Ver.196 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.196では動的CSS **21本**、動的JS **34本**の構成とロード順を維持したまま、`stable-fixes-v108.js` に混在していたスケジュール「7日間」ラベル補正だけを `schedule-today-lock-v129.js` へ移管します。バージョン番号の正本は引き続き `window.WORK_BOARD_RELEASE.version` です。

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
| 基盤・旧安定化ロジック | 高 | **Ver.195で重複責務を監査し、Ver.196で7日間ラベルだけをschedule側へ移管** |
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

### Ver.191〜193

- Ver.191: ユーザー登録・メンション・コメントリアクションを機能所有名へ整理。DOM hook・transaction・revision規則は維持
- Ver.192: ワークフロー・タスク詳細の旧世代CSS5本を内容・カスケード順を変えず機能所有名へ置換
- Ver.193: `ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` へ機能所有名で置換。旧CSSとbyte-for-byte同一、dynamicStyles順も維持

## Ver.194 バージョン正本整理

Ver.193後の基盤JavaScript安全網で、`stable-fixes-v108.js` の旧 `VERSION = "122"` と `version-display-lock.js` のmanifest参照が競合していることを確認しました。Ver.194ではこの競合だけを最小修正しました。

- `release-manifest.js` の `WORK_BOARD_RELEASE.version` を唯一の番号正本とする
- `stable-fixes-v108.js` から旧 `VERSION = "122"` と `WORK_BOARD_VERSION` 書込みを除去
- stable-fixes内の表示補正はmanifest版を参照
- `version-display-lock.js` はmanifestから表示と互換変数を同期する責務を維持

## Ver.195 stable-fixes監査

製品コードを変更せず、`stable-fixes-v108.js` と `mobile-fixes.js` の重複・近接責務を監査しました。通常ブラウザ回帰を **60→63件**へ拡張し、次を固定しています。

1. 後挿入されたdate/datetime-localへの1900〜9999制約
2. Todayフィルタの状態・mine/group判定マーカー
3. モバイル状態タブの横スクロール契約

この監査で、スケジュール「7日間」ラベル補正はstable側から切り出しても、既存のschedule専用Observerで維持できることを確認しました。

## Ver.196 スケジュール表示責務移管

Ver.196で変更するのは「7日間」ラベル補正の所有場所だけです。

- `stable-fixes-v108.js` から `patchScheduleRangeLabel()` を削除
- `schedule-today-lock-v129.js` に `normalizeWeekRangeLabel()` を追加
- 表示 `7日間` と tooltip `今日から7日間を表示します` は変更しない
- `schedule-today-lock-v129.js` の既存 `#scheduleView` 限定MutationObserverを使用し、新規Observerは追加しない
- `mobile-fixes.js` の互換補正は今回は変更しない
- dynamic CSS **21本** / JS **34本**とロード順を維持
- Firebase書込経路は変更しない

静的契約では、stable側にschedule range責務が残っていないこと、schedule lock側がラベル補正を所有しObserver数が増えていないことを固定します。

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
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`

## 次の工程

Ver.196がPRとmainの両方でgreenになった後は、**基本状態の削除保護**を次候補として監査します。`app.js` の状態管理を正本へ寄せられるかを先に契約化し、stable/mobileの二重ガードを一度に削除しません。日付制約、Todayフィルタ、body全体MutationObserverはそれぞれ別工程で扱います。
