# パッチ責務マップ（Ver.202 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.201では、Todayの重複責務を削除する前に最終可視性を専用ブラウザ契約で固定しました。その監査で、`stable-fixes-v108.js` が `toggleAttribute("data-v108-hidden", true)` により空値markerを付ける一方、CSSが `[data-v108-hidden="true"]` だけを対象としていた不整合を検出しました。CSS selectorを `[data-v108-hidden]` へ最小修正し、複数の非表示理由が重なる・解除される遷移でも最終表示が崩れないことを固定しています。

動的CSS **21本**、動的JS **34本**とロード順は変更していません。

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
| 基盤・旧安定化ロジック | 高 | **Ver.202でToday状態除外のmobile重複を退役し、最終可視性をstable単独所有へ統一** |
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

## Ver.194〜201 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一
- Ver.195: stable/mobileの重複・近接責務を監査し、通常UI安全網を60→63件へ拡張
- Ver.196: stable側の `7日間` ラベル補正だけを `schedule-today-lock-v129.js` へ移管
- Ver.197: 基本状態5種の削除保護が `app.js` / stable / mobileへ分散している状態を契約化
- Ver.198: `app.js` に削除保護専用predicateを追加し、stable側の重複削除ガードを退役
- Ver.199: mobile側の重複削除ガードも退役し、削除保護を `app.js` 単独所有へ整理
- Ver.200監査: Today・日付入力の近接責務をstatic/browser contractで固定
- Ver.200製品変更: mobile側のnative date制約・年clamp・旧markerを退役し、stableを共通日付制約の正本へ整理
- Ver.201: Todayの最終可視性と状態/mine理由の遷移を実ブラウザで固定。監査で発見した空値 `data-v108-hidden` markerとCSS selectorの不一致を `[data-v108-hidden]` へ修復
- Ver.202: mobile側のToday状態除外・snapshot読取・auto-hidden markerを退役し、状態除外＋mine/groupをstable単独所有へ統一

## 日付入力の所有境界

### `stable-fixes-v108.js`

- native `date` / `datetime-local` の1900〜9999 min/max
- `date` の `maxlength=10`
- 年4桁超過時のclamp
- `__stableDateV108` によるlistener二重登録防止
- body全体MutationObserverによる動的native inputへの追従

### `mobile-fixes.js`

Ver.200で日付責務を退役済み。`DATE_MIN` / `DATE_MAX`、datetime制約、`clampDateValue()`、`patchDateInputs()`、`__workBoardDateBoundV101` はactive責務ではない。

### `date-keyboard-fix-v127.js`

- 起動時に存在するnative sourceをsegmented UIへ変換
- segmented sourceのmin/max設定
- 年/月/日・時/分の妥当性検証
- dialog open時の同期

## Todayの現在境界

- stable: `保留`、空き時間の`確認待ち`、mine/group担当者判定、task/scheduleの最終可視性を単独所有
- stable CSS: `#todayView [data-v108-hidden]` がmarker存在中の最終非表示を保証
- mobile: Ver.202でToday状態除外、storage snapshot読取、status fallback、`data-workboard-auto-hidden` を退役

Ver.201で固定した最終可視性契約はVer.202でも維持し、mobile markerが存在しないことを追加で確認する。

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
- `backup/ver200-before-today-visibility-audit`: `e9e281ac1b5e7eaa31e02fcaabfe45c98cdf9325`
- `backup/ver201-before-today-owner`: `abeae4c79b887557a4077eb848173fce4b9a946e`

## 次の工程

Todayの重複所有はVer.202で解消した。次は `schedule-today-lock-v129.js` と `mobile-fixes.js` に残る7日間表示補正の重複を監査し、schedule側へ正本化できるかを安全網先行で確認する。モバイル状態タブ・ヘッダー・メニュー・body-wide Observerの整理は別工程とする。
