# パッチ責務マップ（Ver.199 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.199では動的CSS **21本**、動的JS **34本**とロード順を維持したまま、`mobile-fixes.js` に残っていた基本状態5種の重複削除ガードを退役しました。削除保護の正本はVer.198で移管済みの `app.js` だけです。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction等は対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. 基盤JavaScriptは現在の振る舞いを個別テストで固定してから、1責務ずつ最小変更する。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| お知らせダイアログ・一覧ソート表示 | 低 | Ver.193で機能所有名へ整理済み |
| 基盤・旧安定化ロジック | 高 | **Ver.199で基本状態削除保護をapp.js単独所有へ整理** |
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

## Ver.194〜198 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一
- Ver.195: stable/mobileの重複・近接責務を監査し、通常UI安全網を60→63件へ拡張
- Ver.196: stable側の `7日間` ラベル補正だけを `schedule-today-lock-v129.js` へ移管
- Ver.197: 基本状態5種の削除保護が `app.js` / stable / mobileへ分散している状態を契約化
- Ver.198: `app.js` に削除保護専用predicateを追加し、stable側の重複削除ガードを退役

## Ver.199 モバイル削除ガード退役

Ver.199では `mobile-fixes.js` から削除保護に関係する次の責務だけを除去しました。

- `isProtectedDeleteStatus()`
- `patchStatusManager()`
- `[data-delete-status]` をcapture phaseで阻止するclick guard
- `patchAll()` からの `patchStatusManager()` 呼出し

削除保護そのものは `app.js` が引き続き担当します。

- `未着手` / `対応中` / `確認待ち` / `保留` / `完了` は削除不可
- 5状態の削除ボタンはapp自身がdisabled、`aria-disabled="true"`、削除不可titleを付与
- `deleteStatus()` を直接呼んでも5基本状態を拒否
- `未着手`〜`保留` の名称編集は可能
- `完了` のみ名称固定
- カスタム状態は削除可能

`PROTECTED_DELETE_STATUSES` 配列は名称に旧責務名が残っていますが、現在は `readStatusFromTaskCard()` がTodayカードの状態を読み取る補助として参照しているため、この工程では削除・改名していません。Today表示の責務まで同時に変更しないためです。

また、以下のモバイル責務は変更していません。

- モバイルヘッダー / メニュー
- 状態タブと横スクロール
- Today表示補正
- 日付入力補正
- `7日間` 表示補正
- body MutationObserver

## 復旧地点

- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`
- `backup/ver197-before-status-delete-canonicalization`: `a2365af90d95add7b76ac4726be96af3f92e2d70`
- `backup/ver198-before-mobile-status-delete-retirement`: `5250ab9c551507588f329c5f0feab118fee9659c`

## 次の工程

Ver.199完了後は、`stable-fixes-v108.js` と `mobile-fixes.js` に残る **Today・日付入力などの近接責務を再監査**します。次の製品移管も専用の安全網を先に置き、1責務ずつ進めます。body-wide Observer削減を先行して行いません。
