# 回帰テスト基盤（Ver.213）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.213では、Ver.212でstableのversion表示責務まで退役した後に残っていた `installStyle()` を事前Browser監査し、必要なpresentationだけを正しい所有先へ移します。Today意味論と `data-v108-hidden` の付与・解除は `stable-fixes-v108.js`、最終非表示CSSは `ui-core-density-v188.css`、状態タブの通常表示・保護CSS・横スクロールは `mobile-fixes.js` が所有します。stableはCSS注入を行わず、初期・起動後ともToday専用更新だけを担当します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **213** であること。
- 基盤script順が `stable → date-keyboard → schedule lock → list sort → version display` のままであること。
- `app.js` が基本状態5種の削除保護を単独所有すること。
- `schedule-today-lock-v129.js` が `7日間` 表示とツールチップを単独所有すること。
- 状態タブの通常表示・touch/snap/user-select等の保護CSS・横スクロールをmobileが所有し、stableには状態タブCSSが残っていないこと。
- Todayの状態除外・mine/group判定・`data-v108-hidden` markerはstableが所有すること。
- `ui-core-density-v188.css` が `#todayView [data-v108-hidden] { display:none !important; }` を所有すること。
- `date-keyboard-fix-v127.js` がnative sourceの1900〜9999 min/max、4桁年、実在日・時刻妥当性を所有すること。
- stableに `installStyle()` / `applyFixes()` / `stableFixesV108Style` / `MOBILE_QUERY` が存在しないこと。
- stableに日付責務・`#taskForm` Observer・BODY Observerが復活していないこと。
- stable Today Observerは `#todayView`、mobile Observerは `#boardView`、date-keyboardはdialog `open` 属性だけを監視すること。
- stableに状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull-pass triggerが復活していないこと。
- stableに `scheduleFixes()`、`setVersion()`、`WORK_BOARD_RELEASE.version` 参照、`WORK_BOARD_VERSION` 書込が存在しないこと。
- 初期起動では `applyTodayFilters()` を直接実行し、nav/filter clickとuser changeは `scheduleTodayFilters()` だけを呼ぶこと。
- version表示は `release-manifest.js` + `version-display-lock.js` が所有すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

構造・契約テストは **73件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で主要画面、各ブレークポイント、sidebar、通知、アーカイブ、コメント、日付入力、Today、状態タブ、スケジュール、一覧ソート等を確認します。

通常Browser対象は **93件**です。`npm run test:ui` 上ではFirebase Emulator専用19件も収集されますが、通常Browser実行ではskipされます。

Ver.213で特に固定する内容は以下です。

1. **stable style注入の退役**
   - `#stableFixesV108Style` が存在しない。
   - stableに `installStyle()` が存在しない。
   - stableの初期処理は `applyTodayFilters()` だけで成立する。

2. **Today最終可視性の責務分離**
   - `保留` を非表示。
   - 空き時間の `確認待ち` を非表示。
   - mine有効時、現在ユーザー担当は表示、他担当は非表示、group担当は表示する。
   - stableがdurable marker `data-v108-hidden` を付与・解除する。
   - native `hidden` の最終値に依存せず、`ui-core-density-v188.css` がmarkerを確実に非表示化する。

3. **状態タブのmobile単独所有**
   - rowはflex / nowrap / horizontal overflow / vertical hidden / snap none / touch protectionを維持する。
   - buttonはtouch / snap / user-select保護を維持する。
   - タブclickは `tabs.scrollLeft` だけで横位置を更新し、ページ縦位置を変更しない。
   - active button / `aria-pressed` / active columnを維持する。
   - stable側board高さ/overflow保護なしでもcolumn headとtask-listの縦レイアウトが成立する。

4. **version表示の継続**
   - 初期表示はmanifest + version-display-lockだけで `Ver.213` になる。
   - `data-release-version=213`、title、`WORK_BOARD_VERSION=213` が成立する。
   - `.app-version` classが残らず `.workboard-version-display` に正規化される。
   - legacy版表示へ上書きしてもpageshow / focusで現行版へ復旧する。

5. **既存契約の継続**
   - native日付制約・segmented入力はdate-keyboard単独所有。
   - スケジュール7日間ラベルはschedule lock単独所有。
   - Ver.208の未保存破棄確認、Star内部状態、固定機能、キャッシュ消去UI非表示、通知単品既読/未読を継続。
   - 保存処理・Firebase書込・revision・Transactionは変更しない。

## Ver.213で変更するもの

- `stable-fixes-v108.js`
  - `installStyle()` を退役。
  - `applyFixes()` wrapperを退役。
  - 初期起動を `applyTodayFilters()` 直接実行へ縮小。
  - Today意味論と `data-v108-hidden` markerは維持。
- `ui-core-density-v188.css`
  - `#todayView [data-v108-hidden] { display:none !important; }` を最終表示安全網として所有。
- `mobile-fixes.js`
  - stableに残っていた状態タブtouch/snap/user-select/overflow等の保護宣言を既存状態タブルールへ統合。
  - 横スクロールロジック自体は変更しない。
- `release-manifest.js` をVer.213へ更新。
- Ver.213 Browser/static contract、責務台帳、回帰記録を新境界へ更新。

## Ver.213で変更しないもの

- Todayの状態除外・mine/group意味論。
- stableの `#todayView` Observer。
- `version-display-lock.js` の製品実装。
- `date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js` の製品実装。
- mobileの状態タブclickロジック・`scrollLeft` 計算。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込経路・revision・Transaction。
- dynamic CSS **21本** / dynamic JS **34本**とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.213は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`
- `backup/ver210-before-remaining-full-pass-audit`: `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- `backup/ver210-with-remaining-full-pass-audit`: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`
- `backup/ver211-before-version-display-audit`: `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
- `backup/ver211-with-version-display-audit`: `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6`
- `backup/ver212-before-stable-style-audit`: `2784c0bdda190d6e44193e4d0dc4a5711e0160aa`
- `backup/ver212-with-stable-style-audit`: `1954279ad1be0b663ec807b0942561b100b9efaa`

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

Ver.213がmainでRegression / Pagesともにgreenになった後は、stableが `data-v108-hidden` と併用しているnative `hidden` 書込について、他描画経路との重複・必要性を**製品コード無変更で監査**します。

`data-v108-hidden` + `ui-core-density-v188.css` の最終安全網は維持し、Today意味論は変更しません。