# 回帰テスト基盤（Ver.209）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.209では、事前監査で `stable-fixes-v108.js` を無効化しても `date-keyboard-fix-v127.js` 単独で日付制約が成立することを実ブラウザで確認したうえで、stable側の重複日付責務を退役します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **209** であること。
- 基盤script順が `stable → date-keyboard → schedule lock → list sort → version display` のままであること。
- `app.js` が基本状態5種の削除保護を単独所有すること。
- `schedule-today-lock-v129.js` が `7日間` 表示とツールチップを単独所有すること。
- 状態タブの通常表示・横スクロールはmobileが所有し、stableは保護CSSだけを持つこと。
- Todayの状態除外・mine/group判定・最終markerはstableが所有すること。
- `date-keyboard-fix-v127.js` がnative sourceの1900〜9999 min/max、4桁年、実在日・時刻妥当性を所有すること。
- `stable-fixes-v108.js` に `DATE_MIN / DATE_MAX / patchDateInputs / __stableDateV108 / scheduleDateInputs` が残っていないこと。
- stableに `#taskForm` MutationObserverが復活していないこと。
- stable Today Observerは `#todayView`、mobile Observerは `#boardView`、date-keyboardはdialog `open` 属性だけを監視すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

構造・契約テストは **72件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で主要画面、各ブレークポイント、sidebar、通知、アーカイブ、コメント、日付入力、Today、状態タブ、スケジュール、一覧ソート等を確認します。

通常Browser対象は **85件**です。`npm run test:ui` 上ではFirebase Emulator専用19件も収集されますが、通常Browser実行ではskipされます。

Ver.209で特に固定する内容は以下です。

1. **日付制約の単独所有**
   - `#taskDueDate`
   - `#timelineMoveDueDate`
   - `#scheduleStart`
   - `#scheduleEnd`
   - 動的 `#taskStartDateV167`

   について、stableをテスト内で無効化してもdate-keyboardだけで以下を維持します。

   - date: `1900-01-01`〜`9999-12-31`
   - datetime-local: `1900-01-01T00:00`〜`9999-12-31T23:59`
   - 表示年は4桁
   - 1899年を拒否
   - 10000相当入力を拒否
   - 存在しない日付を拒否
   - 24:00を拒否
   - 9999-12-31 / 23:59を受け入れる
   - task dialog再openでも開始日wrapperを二重生成しない

2. **Observer境界**
   - stableの `#taskForm` Observerが存在しない。
   - dynamic開始日はdate-keyboardのdialog open同期で取り込む。
   - Today再描画は `#todayView` Observerだけが処理する。
   - mobile状態タブ再計算は `#boardView` Observerだけが処理する。
   - unrelatedなBODY mutationをfoundation Observerが拾わない。

3. **Today最終可視性**
   - `保留` は非表示。
   - 「空き時間」の `確認待ち` は非表示。
   - mine時の他担当タスク/予定は非表示。
   - group担当は表示。
   - 複数理由の増減後も最終表示が崩れない。

4. **状態タブ**
   - mobile側で `display / gap / overflow-x / scrollbar / flex` を維持。
   - stable側はtouch/snap/user-select等の保護だけを維持。
   - `scrollIntoView()` を使わず `scrollLeft` で横移動。
   - activeボタン、`aria-pressed`、対応board列、ページ縦位置を維持。

5. **Ver.208 UX補正の継続**
   - 未保存タスク編集の破棄確認。
   - Star filter内部状態を残したまま左UIだけ非表示。
   - 固定機能は維持し、詳細の📌表示だけ除去。
   - キャッシュ消去UIを非表示。
   - 通知単品の既読/未読を可逆に更新。

## Ver.209で変更するもの

- `stable-fixes-v108.js`
  - `DATE_MIN / DATE_MAX` を退役。
  - `patchDateInputs()` を退役。
  - `__stableDateV108` listener安全網を退役。
  - `scheduleDateInputs()` を退役。
  - `#taskForm` MutationObserverを退役。
  - `applyFixes()` から日付処理を除外。
- `release-manifest.js` をVer.209へ更新。
- static contract / Observer Browser契約をdate-keyboard単独所有へ更新。
- 責務台帳・回帰テスト文書をVer.209へ更新。

## Ver.209で変更しないもの

- `date-keyboard-fix-v127.js` の実装本体。
- `app.js` のタスク・予定保存処理。
- `work-features-v167.js` の開始日保存処理。
- Firebase書込経路・revision・Transaction。
- Todayの状態除外・mine/group意味論。
- stableのToday Observer。
- mobile状態タブ実装。
- schedule lock / list sort / version display。
- dynamic CSS/JSの本数とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.209は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver203-before-status-tab-scroll-audit`
- `backup/ver203-with-status-tab-scroll-audit`
- `backup/ver204-before-status-tab-css-audit`
- `backup/ver205-before-status-tab-css-retirement`
- `backup/ver208-user-ux-release`
- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`

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

Ver.209がmainでgreenになった後は、`stable-fixes-v108.js` に残るfull `applyFixes()` の発火経路を監査します。

初期起動、nav/filter click、user change、resize、orientationchange、pageshow、遅延タイマーの各経路について、`installStyle()` / `applyTodayFilters()` / `setVersion()` を毎回まとめて呼ぶ必要があるかを計測します。監査工程ではTodayの意味論自体は変更しません。
