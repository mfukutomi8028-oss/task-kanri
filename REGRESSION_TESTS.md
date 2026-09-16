# 回帰テスト基盤（Ver.210）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.210では、Ver.209で日付責務を `date-keyboard-fix-v127.js` へ単独所有化した後、`stable-fixes-v108.js` に残っていた非意味的なfull `applyFixes()` 発火を事前Browser監査で無効化しても挙動が維持されることを確認し、製品側から退役します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **210** であること。
- 基盤script順が `stable → date-keyboard → schedule lock → list sort → version display` のままであること。
- `app.js` が基本状態5種の削除保護を単独所有すること。
- `schedule-today-lock-v129.js` が `7日間` 表示とツールチップを単独所有すること。
- 状態タブの通常表示・横スクロールはmobileが所有し、stableは保護CSSだけを持つこと。
- Todayの状態除外・mine/group判定・最終markerはstableが所有すること。
- `date-keyboard-fix-v127.js` がnative sourceの1900〜9999 min/max、4桁年、実在日・時刻妥当性を所有すること。
- stableに日付責務・`#taskForm` Observer・BODY Observerが復活していないこと。
- stable Today Observerは `#todayView`、mobile Observerは `#boardView`、date-keyboardはdialog `open` 属性だけを監視すること。
- stableに状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull-pass triggerが復活していないこと。
- 初期起動、nav/filter click、user changeの明示的なstable更新経路は維持されること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

構造・契約テストは **73件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で主要画面、各ブレークポイント、sidebar、通知、アーカイブ、コメント、日付入力、Today、状態タブ、スケジュール、一覧ソート等を確認します。

通常Browser対象は **87件**です。`npm run test:ui` 上ではFirebase Emulator専用19件も収集されますが、通常Browser実行ではskipされます。

Ver.210で特に固定する内容は以下です。

1. **stable full-pass退役**
   - `.work-mobile-status-tab` clickでstable full passを実行しない。
   - `resize` / `orientationchange` / `pageshow` でstable full passを実行しない。
   - 起動後300ms / 1200msの遅延full passを実行しない。
   - それらを除いてもstable CSS・manifest連動version表示・状態タブactive切替を維持する。

2. **Today scoped更新**
   - `#todayView`へカードが追加された場合、専用Observerだけで `保留`、空き時間の`確認待ち`、mine他担当、group担当の最終可視性を反映する。
   - viewport/pageshowイベント後もToday最終可視性が崩れない。

3. **日付制約の単独所有**
   - Ver.209で確立したdate-keyboard単独所有テストは現行release番号に依存せず継続する。
   - date: `1900-01-01`〜`9999-12-31`、datetime-local: `1900-01-01T00:00`〜`9999-12-31T23:59`。
   - 表示年4桁、範囲外・存在しない日・24:00を拒否し、task dialog再openでもwrapperを二重生成しない。

4. **既存UI回帰**
   - mobile状態タブはmobile側の `scrollLeft` 実装で動作し、stableは保護CSSだけを維持。
   - Ver.208の未保存破棄確認、Star内部状態、固定機能、キャッシュ消去UI非表示、通知単品既読/未読を継続。

## Ver.210で変更するもの

- `stable-fixes-v108.js`
  - 状態タブclickからのfull `scheduleFixes()` を退役。
  - resize full passを退役。
  - orientationchange full passを退役。
  - pageshow full passを退役。
  - 300ms / 1200ms遅延full passを退役。
- `release-manifest.js` をVer.210へ更新。
- `tests/stable-full-pass-audit-v210.spec.mjs` を監査用変換から製品回帰契約へ更新。
- Ver.209日付契約のrelease番号依存を除去。
- 責務台帳・回帰記録をVer.210へ更新。

## Ver.210で変更しないもの

- Todayの状態除外・mine/group意味論。
- stableの `#todayView` Observer。
- 初期起動、nav/filter click、user changeのstable更新経路。
- `date-keyboard-fix-v127.js`、`mobile-fixes.js`、`version-display-lock.js` の製品実装。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込経路・revision・Transaction。
- dynamic CSS **21本** / dynamic JS **34本**とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.210は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver205-before-status-tab-css-retirement`
- `backup/ver208-user-ux-release`
- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`
- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`

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

Ver.210がmainでRegression / Pagesともにgreenになった後は、stableに残る `nav/filter click` と `user change` のfull passを監査します。

`installStyle()` と `setVersion()` は初期起動後に独立した所有者・冪等性があるため、これらのイベントでは `applyTodayFilters()` だけで十分かを実ブラウザで確認します。Today意味論そのものは変更しません。
