# パッチ責務マップ（Ver.209 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.209でも変更していません。

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
| 基盤・旧安定化ロジック | 高 | **Ver.209でnative日付制約をdate-keyboardへ単独所有化** |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | Ver.192で旧世代CSSを機能所有名へ整理済み |
| ユーザー・コメント補助 | 高 | Ver.191で機能所有名へ整理済み |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | Ver.190で表示責務整理済み |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 書込整合性のため保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |
| ユーザー指定UI補正 | 中 | Ver.208で追加、既存データモデルは維持 |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.194〜209 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一。
- Ver.195: stable/mobileの重複・近接責務を監査。
- Ver.196: stable側の `7日間` ラベル補正を `schedule-today-lock-v129.js` へ移管。
- Ver.197: 基本状態5種の削除保護境界を契約化。
- Ver.198: `app.js` を削除保護の正本にし、stable側重複ガードを退役。
- Ver.199: mobile側重複削除ガードも退役。
- Ver.200: mobile側のnative date制約・年clamp・旧markerを退役し、当時はstableへ統一。
- Ver.201: Today最終可視性を実ブラウザで固定し、`[data-v108-hidden]` selector不整合を修復。
- Ver.202: mobile側Today状態除外・snapshot fallback・auto-hidden markerを退役し、stableをToday単独正本へ統一。
- Ver.203: mobile側 `7日間` ラベル補正を退役し、schedule lockを単独正本へ統一。
- Ver.204: stable側状態タブscrollIntoView補正を退役し、横スクロールをmobile単独所有へ統一。
- Ver.205: 状態タブCSS完全重複をstableから退役し、通常表示をmobile単独所有へ統一。
- Ver.206: mobileのBODY MutationObserverを `#boardView` 限定へ縮小。
- Ver.207: stableのBODY MutationObserverを廃止し、日付は `#taskForm`、Todayは `#todayView` の限定Observerへ分離。
- Ver.208: ユーザー指定UX補正を追加。既存のスター・固定・通知データモデルは変更していない。
- Ver.209監査: stableを無効化した実ブラウザで、date-keyboard単独でも静的date/datetime、動的開始日、dialog再open、1900〜9999、4桁年、実在日・時刻制約が成立することを確認。
- Ver.209製品変更: stableの `patchDateInputs()`、`DATE_MIN/DATE_MAX`、日付用scheduler、`#taskForm` Observerを退役。native日付制約とsegmented入力を `date-keyboard-fix-v127.js` 単独所有へ統一。

## 日付入力の現在の所有境界

### `date-keyboard-fix-v127.js` — 正本

- `input[type="date"]` / `input[type="datetime-local"]` をsegmented UIへ変換。
- native sourceに1900〜9999のmin/maxを設定。
- 表示年inputを4桁に制限。
- 年/月/日、時/分の妥当性を検証。
- 1899年、10000相当、存在しない日、24:00を拒否。
- dialogの `open` 属性だけを監視し、開いた時に `patchAll()` / `syncAll()` を実行。
- `work-features-v167.js` が後から追加する `#taskStartDateV167` もtask dialog open時に取り込む。

### `stable-fixes-v108.js`

Ver.209で日付責務を退役。以下は存在しないことを契約化する。

- `DATE_MIN` / `DATE_MAX`
- `patchDateInputs()`
- `__stableDateV108`
- `scheduleDateInputs()`
- `#taskForm` MutationObserver

### `mobile-fixes.js`

Ver.200で日付責務を退役済み。日付定数・clamp・native制約を持たない。

## Todayの現在境界

`stable-fixes-v108.js` が引き続きToday最終可視性を所有する。

- `保留` を非表示。
- 「空き時間」の `確認待ち` を非表示。
- mine時の担当者判定。
- `システム課` / `システム担当` / `システム` / `全員` / `共通` をgroup担当として扱う。
- `#todayView [data-v108-hidden]` が最終非表示を保証。
- `#todayView` 限定MutationObserverだけを維持。

Ver.209ではTodayの意味論を変更していない。

## 状態タブ・スケジュールの現在境界

- 状態タブの通常レイアウト・横スクロール: `mobile-fixes.js`。
- stable: flex-wrap / touch / snap / user-select等の保護CSSのみ。
- スケジュール `7日間` 表示とツールチップ: `schedule-today-lock-v129.js`。
- 基本状態5種の削除保護: `app.js`。

## Ver.209の安全網

- static contract: **72件**。
- 通常Browser: **85件**（Firebase Emulator専用19件は通常Browser実行ではskip）。
- Firebase Emulator E2E: **19件**。
- Ver.209専用日付監査はstableを無効化して5経路を確認。
- Observer監査はstableの `#taskForm` Observerが復活していないこと、Todayは `#todayView`、mobileは `#boardView` に限定されることを確認。

## 主な復旧地点

- `backup/ver203-before-status-tab-scroll-audit`
- `backup/ver203-with-status-tab-scroll-audit`
- `backup/ver204-before-status-tab-css-audit`
- `backup/ver205-before-status-tab-css-retirement`
- `backup/ver208-user-ux-release`
- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`

## 次の工程

Ver.209がmainでRegression / Pagesともにgreenになった後、`stable-fixes-v108.js` に残るfull `applyFixes()` の発火経路を監査する。

対象は初期起動、nav/filter click、user change、resize、orientationchange、pageshow、遅延タイマー。`installStyle()`、`applyTodayFilters()`、`setVersion()` を毎回まとめて呼ぶ必要があるかを計測し、責務分離できる箇所だけを次工程で扱う。

**Todayの状態除外・mine/group意味論そのものは次の監査では変更しない。**
