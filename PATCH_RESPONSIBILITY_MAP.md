# パッチ責務マップ（Ver.212 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.212でも変更していません。

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
| 基盤・旧安定化ロジック | 高 | **Ver.212でstableのversion表示責務を退役し、初期passをstyle + Todayへ限定** |
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

## Ver.194〜212 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一。
- Ver.195: stable/mobileの重複・近接責務を監査。
- Ver.196: stable側の `7日間` ラベル補正を `schedule-today-lock-v129.js` へ移管。
- Ver.197〜199: 基本状態5種の削除保護を `app.js` 単独正本へ整理。
- Ver.200: mobile側native date制約を退役。
- Ver.201〜202: Today最終可視性をstable単独正本へ整理。
- Ver.203: スケジュール `7日間` 表示をschedule lock単独正本へ整理。
- Ver.204〜205: 状態タブ横スクロール・通常CSSをmobile単独所有へ整理し、stableは保護CSSだけを残した。
- Ver.206: mobileのBODY MutationObserverを `#boardView` 限定へ縮小。
- Ver.207: stableのBODY MutationObserverを廃止し、日付は `#taskForm`、Todayは `#todayView` の限定Observerへ分離。
- Ver.208: ユーザー指定UX補正を追加。
- Ver.209: native日付制約とsegmented入力を `date-keyboard-fix-v127.js` 単独所有へ統一し、stableの日付処理と `#taskForm` Observerを退役。
- Ver.210: 状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull `applyFixes()` を事前監査後に退役。
- Ver.211: nav/filter clickとcurrent/startup user changeを `scheduleTodayFilters()` へ限定し、起動後full passと未使用schedulerを退役。
- Ver.212監査: stableの初期 `setVersion()` 呼び出しをテスト内だけで外し、manifest + version-display-lockだけで初期表示・継続復旧・Today・styleが成立することを確認。
- Ver.212製品変更: `setVersion()` とstable内のmanifest version参照を退役。初期 `applyFixes()` は `installStyle()` + `applyTodayFilters()` の2責務だけを維持。

## `stable-fixes-v108.js` の現在境界

### 初期起動

`applyFixes()` は初期起動時だけ直接実行し、次の2責務だけを保証する。

- `installStyle()` — stable保護CSSを1回注入。
- `applyTodayFilters()` — 初回Today最終可視性を適用。

Ver.212で `setVersion()` は退役し、stableは `WORK_BOARD_RELEASE.version` / `WORK_BOARD_VERSION` を扱わない。

### 起動後のToday専用更新

次の経路はすべて `scheduleTodayFilters()` だけを呼ぶ。

- `.nav-filter[data-filter="mine"]` click。
- `.nav-item[data-layout]` click。
- `#currentUserSelect` change。
- `#startupUser` change。
- `#todayView` childList/subtree MutationObserver。

`function scheduleFixes()` と専用 `scheduled` フラグはVer.211で退役済み。

### Today意味論

- `保留` を非表示。
- 「空き時間」の `確認待ち` を非表示。
- mine時に現在ユーザー担当を表示し、他担当を非表示。
- `システム課` / `システム担当` / `システム` / `全員` / `共通` はgroup担当として表示。
- `#todayView [data-v108-hidden]` が最終非表示を保証。

Ver.212でもこの意味論自体は変更していない。

## version表示の現在境界

### `release-manifest.js`

- `WORK_BOARD_RELEASE.version` の正本。
- first-paint時のversion文字列を現行版へ補正。
- `WORK_BOARD_RELEASE_VERSION` / 初期 `WORK_BOARD_VERSION` を公開。

### `version-display-lock.js`

- manifest版を参照してversion表示を正規化。
- `.app-version` を `.workboard-version-display` へ統一。
- text / title / `data-release-version` / `WORK_BOARD_VERSION` を現行版へ補正。
- pageshow / focus / 遅延補正でlegacy上書きを復旧。

### `stable-fixes-v108.js`

- Ver.212以降、version表示責務なし。

## 他基盤資産の現在境界

- native日付制約・segmented入力: `date-keyboard-fix-v127.js`。
- 状態タブの通常レイアウト・横スクロール・active列切替: `mobile-fixes.js`。
- stable: 状態タブのtouch/snap/user-select等の保護CSSのみ。
- スケジュール `7日間` 表示とツールチップ: `schedule-today-lock-v129.js`。
- version表示: `release-manifest.js` + `version-display-lock.js`。
- 基本状態5種の削除保護: `app.js`。

## Ver.212の安全網

- static contract: **73件**。
- 通常Browser: **91件**（Firebase Emulator専用19件は通常Browser実行ではskip）。
- Firebase Emulator E2E: **19件**。
- Ver.212専用Browser契約では、実製品stableにversion責務がなくても初期 `Ver.212`、title、`data-release-version`、`WORK_BOARD_VERSION` が成立することを確認。
- legacy版表示への上書きがpageshow / focusで現行版へ戻ることを確認。
- stable保護styleとTodayの状態除外・group担当表示を同時に確認。
- Ver.211のToday専用更新契約、Ver.210のfull pass退役契約、Ver.209の日付所有契約を継続。

## 主な復旧地点

- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`
- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`
- `backup/ver210-before-remaining-full-pass-audit`: `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- `backup/ver210-with-remaining-full-pass-audit`: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`
- `backup/ver211-before-version-display-audit`: `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
- `backup/ver211-with-version-display-audit`: `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6`

## 次の工程

Ver.212がmainでRegression / Pagesともにgreenになった後、stableに残る `installStyle()` の保護CSSを監査する。

対象は、状態タブ保護、board高さ/overflow保護、`#todayView [data-v108-hidden]` の最終非表示ルール。既存active CSSと重複していないか、JavaScriptでstyleを注入し続ける必要があるかを、製品コード無変更の実ブラウザ監査で確認する。

**Today意味論、状態タブ横スクロール、レスポンシブ挙動はこの監査では変更しない。**
