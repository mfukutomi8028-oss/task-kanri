# パッチ責務マップ（Ver.200 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.200では動的CSS **21本**、動的JS **34本**とロード順を維持したまま、`mobile-fixes.js` に残っていたnative date / datetime-localの重複制約を退役しました。共通の日付制約は `stable-fixes-v108.js` が正本です。`date-keyboard-fix-v127.js` はsegmented UIと妥当性検証を引き続き担当します。

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
| 基盤・旧安定化ロジック | 高 | **Ver.200でnative日付制約をstableへ正本化。Today重複は未整理** |
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

## Ver.194〜200 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一
- Ver.195: stable/mobileの重複・近接責務を監査し、通常UI安全網を60→63件へ拡張
- Ver.196: stable側の `7日間` ラベル補正だけを `schedule-today-lock-v129.js` へ移管
- Ver.197: 基本状態5種の削除保護が `app.js` / stable / mobileへ分散している状態を契約化
- Ver.198: `app.js` に削除保護専用predicateを追加し、stable側の重複削除ガードを退役
- Ver.199: mobile側の重複削除ガードも退役し、削除保護を `app.js` 単独所有へ整理
- Ver.200監査: Today・日付入力の近接責務をstatic/browser contractで固定
- Ver.200製品変更: mobile側のnative date制約・年clamp・旧markerを退役し、stableを共通日付制約の正本へ整理

## Ver.200 日付入力の所有境界

### `stable-fixes-v108.js`

- native `date` / `datetime-local` の1900〜9999 min/max
- `date` の `maxlength=10`
- 年4桁超過時のclamp
- `__stableDateV108` によるlistener二重登録防止
- body全体MutationObserverによる動的native inputへの追従

### `mobile-fixes.js`

Ver.200で日付責務を退役した。以下は存在しない。

- `DATE_MIN` / `DATE_MAX`
- `DATETIME_MIN` / `DATETIME_MAX`
- `clampDateValue()`
- `patchDateInputs()`
- `__workBoardDateBoundV101`

モバイルヘッダー、状態タブ、Today状態除外、レイアウト補正、body-wide Observer等の日付以外の責務は維持する。

### `date-keyboard-fix-v127.js`

- 起動時に存在するnative sourceをsegmented UIへ変換
- segmented sourceのmin/max設定
- 年/月/日・時/分の妥当性検証
- dialog open時の同期

起動後に任意追加されたnative dateをbody全体監視でsegmented UIへ自動変換する責務は持たない。

## Todayの残存境界

- stable: `保留`、空き時間の`確認待ち`に加えてmine/group担当者判定を所有し、`data-v108-hidden` を付与
- mobile: `保留`、空き時間の`確認待ち`だけを所有し、`data-workboard-auto-hidden="true"` を付与

状態除外は重複していますが、mine/group担当者判定はstable固有です。Ver.200ではTodayを変更しません。

## 復旧地点

- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`
- `backup/ver197-before-status-delete-canonicalization`: `a2365af90d95add7b76ac4726be96af3f92e2d70`
- `backup/ver198-before-mobile-status-delete-retirement`: `5250ab9c551507588f329c5f0feab118fee9659c`
- `backup/ver199-before-foundation-overlap-reaudit`: `e7fc50cd92af7e4ebf24cabbcfdb5e6963550880`
- `backup/ver199-with-foundation-overlap-audit`: `d040061607947974a69309ce850c4885ad8b9e4a`

## 次の工程

Todayの状態除外を整理する場合は、先に **最終 `hidden` 状態の専用ブラウザ契約** を追加する。現状はstable/mobile双方がカード状態へ作用するため、マーカー契約だけを根拠に片方を削除しない。

body-wide MutationObserverの削減は、Today等の残存責務を分離した後に行う。
