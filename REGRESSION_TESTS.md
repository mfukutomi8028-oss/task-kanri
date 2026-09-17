# 回帰テスト基盤（Ver.214）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.214では、Ver.213でToday最終可視性を `data-v108-hidden` + `ui-core-density-v188.css` へ整理した後に残っていたstableのnative `hidden` 書込2か所を、事前Browser監査で不要と確認して退役します。Todayの意味論・marker・Observerはそのまま維持し、表示の正本をmarker + core CSSへ一本化します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **214** であること。
- 基盤script順が `stable → date-keyboard → schedule lock → list sort → version display` のままであること。
- stableがTodayの状態除外・mine/group判定・`data-v108-hidden` markerだけを所有すること。
- stableに `card.hidden = shouldHide` が存在しないこと。
- `ui-core-density-v188.css` が `#todayView [data-v108-hidden] { display:none !important; }` を所有すること。
- stableに `installStyle()` / `applyFixes()` / `setVersion()` / native日付責務 / 状態タブCSSが復活していないこと。
- stable Today Observerは `#todayView`、mobile Observerは `#boardView`、date-keyboardはdialog `open` 属性だけを監視すること。
- version表示は `release-manifest.js` + `version-display-lock.js` が所有すること。
- 状態タブの通常表示・保護・横スクロールは `mobile-fixes.js` が所有すること。
- schedule `7日間` 表示は `schedule-today-lock-v129.js` が所有すること。
- 基本状態5種の削除保護は `app.js` が所有すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

通常Browser対象は **95件**です。Ver.214監査でタスク・予定のnative hidden非依存テスト2件を追加しました。Firebase Emulator専用19件は通常Browser実行ではskipされます。

Ver.214で特に固定する内容は以下です。

1. **タスクカードのToday表示**
   - 自分担当の保留はmarkerで非表示。
   - 他担当の保留は非表示。
   - mineによる他担当通常タスクは非表示。
   - group担当は表示。
   - 空き時間の確認待ちは非表示。
   - 状態変更やmine解除でmarkerが外れたカードは再表示される。
   - これらの各段階でfixtureのnative `hidden` はfalseのまま成立する。

2. **予定カードのToday表示**
   - 自分担当・group担当は表示。
   - mine時の他担当予定はmarkerで非表示。
   - mine解除後はmarkerが外れて再表示される。
   - native `hidden` に依存しない。

3. **Ver.213までの基盤整理を継続**
   - stable style elementは存在しない。
   - mobile状態タブは横scrollLeft、active、aria、active列、縦位置維持を継続。
   - native日付制約・segmented入力はdate-keyboard単独所有。
   - version表示はmanifest + version-display-lockだけで `Ver.214` に統一。
   - legacy version上書きもpageshow / focusで復旧する。

## Ver.214で変更するもの

- `stable-fixes-v108.js`
  - タスクカードの `card.hidden = shouldHide` を退役。
  - 予定カードの `card.hidden = shouldHide` を退役。
  - `data-v108-hidden` の付与・解除、Today意味論、Observerは維持。
- `release-manifest.js` をVer.214へ更新。
- Ver.214 native-hidden監査を一時変換から実製品回帰へ更新。
- static contract / version表示回帰 / 責務台帳 / 回帰記録をVer.214へ更新。

## Ver.214で変更しないもの

- Todayの保留 / 確認待ち / mine / group意味論。
- `ui-core-density-v188.css` の最終非表示ルール。
- stableの `#todayView` Observer。
- `mobile-fixes.js`、`date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js`、`version-display-lock.js` の製品実装。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込経路・revision・Transaction。
- dynamic CSS **21本** / dynamic JS **34本**とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.214は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver212-with-stable-style-audit`: `1954279ad1be0b663ec807b0942561b100b9efaa`
- `backup/ver213-before-native-hidden-audit`: `527b88042c69d0c326325d8e66510011f3f0953b`
- `backup/ver213-with-native-hidden-audit`: `43d96f8f6f44d5b13cea441813bf835c0e340338`

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

Ver.214がmainでRegression / Pagesともにgreenになった後は、stableに残るTodayデータ取得責務（localStorage fallback、room解決、current user解決、group担当判定）が現行描画経路と重複していないかを、まず製品コード無変更で監査します。Today意味論・marker・保存系は変更しません。
