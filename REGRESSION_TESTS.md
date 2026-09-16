# 回帰テスト基盤（Ver.212）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.212では、Ver.211でstableの起動後full `applyFixes()` を全廃した後、初期passに残っていたversion表示補正を事前Browser監査で不要と確認し、`stable-fixes-v108.js` の `setVersion()` を退役します。version表示は `release-manifest.js` + `version-display-lock.js` へ統一し、stable初期passは `installStyle()` + `applyTodayFilters()` の2責務だけを維持します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **212** であること。
- 基盤script順が `stable → date-keyboard → schedule lock → list sort → version display` のままであること。
- `app.js` が基本状態5種の削除保護を単独所有すること。
- `schedule-today-lock-v129.js` が `7日間` 表示とツールチップを単独所有すること。
- 状態タブの通常表示・横スクロールはmobileが所有し、stableは保護CSSだけを持つこと。
- Todayの状態除外・mine/group判定・最終markerはstableが所有すること。
- `date-keyboard-fix-v127.js` がnative sourceの1900〜9999 min/max、4桁年、実在日・時刻妥当性を所有すること。
- stableに日付責務・`#taskForm` Observer・BODY Observerが復活していないこと。
- stable Today Observerは `#todayView`、mobile Observerは `#boardView`、date-keyboardはdialog `open` 属性だけを監視すること。
- stableに状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull-pass triggerが復活していないこと。
- stableに `scheduleFixes()` と専用 `scheduled` フラグが復活していないこと。
- stableに `setVersion()`、`WORK_BOARD_RELEASE.version` 参照、`WORK_BOARD_VERSION` 書込が存在しないこと。
- 初期起動では `applyFixes()` が `installStyle()` + `applyTodayFilters()` だけを実行し、nav/filter clickとuser changeは `scheduleTodayFilters()` だけを呼ぶこと。
- version表示は `release-manifest.js` + `version-display-lock.js` が所有すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

構造・契約テストは **73件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で主要画面、各ブレークポイント、sidebar、通知、アーカイブ、コメント、日付入力、Today、状態タブ、スケジュール、一覧ソート等を確認します。

通常Browser対象は **91件**です。`npm run test:ui` 上ではFirebase Emulator専用19件も収集されますが、通常Browser実行ではskipされます。

Ver.212で特に固定する内容は以下です。

1. **version表示の単独所有**
   - stableに `setVersion()` が存在しない。
   - 初期表示はmanifest + version-display-lockだけで `Ver.212` になる。
   - `data-release-version=212`、title、`WORK_BOARD_VERSION=212` が成立する。
   - `.app-version` classが残らず `.workboard-version-display` に正規化される。
   - legacy版表示へ上書きしてもpageshow / focusで現行版へ復旧する。

2. **stable初期passの縮小**
   - 初期 `applyFixes()` は `installStyle()` と `applyTodayFilters()` だけを実行する。
   - stable保護styleは従来どおり存在する。
   - `#todayView`再描画、mine切替、利用者変更は `scheduleTodayFilters()` だけで反映する。
   - Ver.210/211で退役した起動後full passを復活させない。

3. **Today意味論の維持**
   - `保留` を非表示。
   - 空き時間の `確認待ち` を非表示。
   - mine有効時、現在ユーザー担当は表示、他担当は非表示、group担当は表示する。
   - current user変更後、担当者判定をToday専用更新だけで再評価する。

4. **既存契約の継続**
   - native日付制約・segmented入力はdate-keyboard単独所有。
   - mobile状態タブはmobile側 `scrollLeft` 実装で動作し、stableは保護CSSだけを維持。
   - 実navigationが成立し、stableの起動後full passは増えない。
   - Ver.208の未保存破棄確認、Star内部状態、固定機能、キャッシュ消去UI非表示、通知単品既読/未読を継続。

## Ver.212で変更するもの

- `stable-fixes-v108.js`
  - `setVersion()` を退役。
  - `applyFixes()` からversion補正を除外。
  - stableから `WORK_BOARD_RELEASE.version` 参照を除外。
  - 初期 `applyFixes()` を `installStyle()` + `applyTodayFilters()` の2責務へ縮小。
- `release-manifest.js` をVer.212へ更新。
- `tests/stable-version-display-audit-v212.spec.mjs` を監査用一時変換から実製品回帰へ更新。
- static contract / 責務台帳 / 回帰記録をVer.212へ更新。

## Ver.212で変更しないもの

- Todayの状態除外・mine/group意味論。
- stableの `#todayView` Observer。
- stable保護CSS。
- `version-display-lock.js` の製品実装。
- `date-keyboard-fix-v127.js`、`mobile-fixes.js`、`schedule-today-lock-v129.js` の製品実装。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込経路・revision・Transaction。
- dynamic CSS **21本** / dynamic JS **34本**とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.212は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`
- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`
- `backup/ver210-before-remaining-full-pass-audit`: `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- `backup/ver210-with-remaining-full-pass-audit`: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`
- `backup/ver211-before-version-display-audit`: `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
- `backup/ver211-with-version-display-audit`: `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6`

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・Browser・Firebase Emulatorを順番に実行します。

## 次の段階

Ver.212がmainでRegression / Pagesともにgreenになった後は、stableに残る `installStyle()` の保護CSSを監査します。

状態タブのtouch/snap/user-select保護、board高さ/overflow保護、`#todayView [data-v108-hidden]` の最終非表示ルールについて、既存active CSSとの重複とJavaScript注入の必要性を製品コード無変更で確認します。Today意味論と状態タブ挙動は変更しません。
