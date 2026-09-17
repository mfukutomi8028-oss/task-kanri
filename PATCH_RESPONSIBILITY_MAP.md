# パッチ責務マップ（Ver.213 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.213でも変更していません。

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
| 基盤・旧安定化ロジック | 高 | **Ver.213でstableのstyle注入を退役し、stableをToday意味論専用へ縮小** |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | Ver.192で旧世代CSSを機能所有名へ整理済み |
| ユーザー・コメント補助 | 高 | Ver.191で機能所有名へ整理済み |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | Ver.190で表示責務整理済み |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 書込整合性のため保留 |
| 画面密度・見出し整理 | 中 | Ver.213でToday最終非表示CSSを追加所有 |
| ユーザー指定UI補正 | 中 | Ver.208で追加、既存データモデルは維持 |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.194〜213 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一。
- Ver.195: stable/mobileの重複・近接責務を監査。
- Ver.196: stable側の `7日間` ラベル補正を `schedule-today-lock-v129.js` へ移管。
- Ver.197〜199: 基本状態5種の削除保護を `app.js` 単独正本へ整理。
- Ver.200: mobile側native date制約を退役。
- Ver.201〜202: Today最終可視性をstable単独正本へ整理。
- Ver.203: スケジュール `7日間` 表示をschedule lock単独正本へ整理。
- Ver.204〜205: 状態タブ横スクロール・通常CSSをmobile所有へ整理し、stableは保護CSSだけを残した。
- Ver.206: mobileのBODY MutationObserverを `#boardView` 限定へ縮小。
- Ver.207: stableのBODY MutationObserverを廃止し、日付は `#taskForm`、Todayは `#todayView` の限定Observerへ分離。
- Ver.208: ユーザー指定UX補正を追加。
- Ver.209: native日付制約とsegmented入力を `date-keyboard-fix-v127.js` 単独所有へ統一し、stableの日付処理と `#taskForm` Observerを退役。
- Ver.210: 状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull `applyFixes()` を事前監査後に退役。
- Ver.211: nav/filter clickとcurrent/startup user changeを `scheduleTodayFilters()` へ限定し、起動後full passと未使用schedulerを退役。
- Ver.212: stableの `setVersion()` とmanifest version参照を退役し、version表示をmanifest + version-display-lockへ統一。
- Ver.213監査: stableのstyle注入をテスト内だけで抑止し、Todayの `data-v108-hidden` 強制非表示CSSは必要、board保護CSSは不要、状態タブ保護はmobileへ移管可能と確認。
- Ver.213製品変更: stableの `installStyle()` / `applyFixes()` を退役。Todayの意味論と `data-v108-hidden` はstable、最終非表示CSSは `ui-core-density-v188.css`、状態タブの通常表示・保護・横スクロールは `mobile-fixes.js` へ単独所有化。

## `stable-fixes-v108.js` の現在境界

### 初期起動

初期起動では `applyTodayFilters()` を直接実行する。stableはCSSを注入しない。

### 起動後のToday専用更新

次の経路はすべて `scheduleTodayFilters()` だけを呼ぶ。

- `.nav-filter[data-filter="mine"]` click。
- `.nav-item[data-layout]` click。
- `#currentUserSelect` change。
- `#startupUser` change。
- `#todayView` childList/subtree MutationObserver。

### Today意味論

- `保留` を非表示。
- 「空き時間」の `確認待ち` を非表示。
- mine時に現在ユーザー担当を表示し、他担当を非表示。
- `システム課` / `システム担当` / `システム` / `全員` / `共通` はgroup担当として表示。
- stableは `data-v108-hidden` の付与・解除を最終意味論マーカーとして所有する。
- `ui-core-density-v188.css` の `#todayView [data-v108-hidden] { display:none !important; }` がauthor CSS競合に対する最終表示安全網を所有する。
- native `hidden` は補助的に更新するが、他描画経路から書き換えられる可能性があるため最終正本とはしない。

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

- Ver.212以降version表示責務なし。

## 他基盤資産の現在境界

- native日付制約・segmented入力: `date-keyboard-fix-v127.js`。
- 状態タブの通常レイアウト・touch/snap/user-select等の保護CSS・横スクロール・active列切替: `mobile-fixes.js`。
- Today最終非表示presentation: `ui-core-density-v188.css`。
- スケジュール `7日間` 表示とツールチップ: `schedule-today-lock-v129.js`。
- version表示: `release-manifest.js` + `version-display-lock.js`。
- 基本状態5種の削除保護: `app.js`。

## Ver.213の安全網

- static contract: **73件**。
- 通常Browser: **93件**（Firebase Emulator専用19件は通常Browser実行ではskip）。
- Firebase Emulator E2E: **19件**。
- Ver.213専用Browser契約で、`stableFixesV108Style` が存在しなくてもToday最終非表示、状態タブ横スクロール、active/aria/active列、縦位置維持、board縦伸長が成立することを確認する。
- version表示は `Ver.213` / `data-release-version=213` / `WORK_BOARD_VERSION=213` をmanifest + version-display-lockだけで成立させる。
- dynamic CSS 21本 / dynamic JS 34本とロード順は変更しない。

## 主な復旧地点

- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`
- `backup/ver210-before-remaining-full-pass-audit`: `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- `backup/ver210-with-remaining-full-pass-audit`: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`
- `backup/ver211-before-version-display-audit`: `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
- `backup/ver211-with-version-display-audit`: `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6`
- `backup/ver212-before-stable-style-audit`: `2784c0bdda190d6e44193e4d0dc4a5711e0160aa`
- `backup/ver212-with-stable-style-audit`: `1954279ad1be0b663ec807b0942561b100b9efaa`

## 次の候補

Ver.213がmainでRegression / Pagesともにgreenになった後は、stableが `data-v108-hidden` と併用しているnative `hidden` 書込について、他描画経路との重複・必要性を**製品コード無変更で監査**する。

`data-v108-hidden` + core CSSの最終安全網は維持し、Today意味論そのものは変更しない。