# 回帰テスト基盤（Ver.211）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.211では、Ver.210で非意味的な状態タブ・viewport・pageshow・遅延timerのfull `applyFixes()` を退役した後、残っていたnav/filter clickとuser changeも事前Browser監査でToday専用更新だけで成立することを確認し、製品側を `scheduleTodayFilters()` に限定します。初期 `applyFixes()` は維持します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- Firebase Emulator設定がlocalhost・demo project・test roomへ限定されること。
- release versionが **211** であること。
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
- 初期起動では `applyFixes()` を直接実行し、nav/filter clickとuser changeは `scheduleTodayFilters()` だけを呼ぶこと。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

構造・契約テストは **73件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で主要画面、各ブレークポイント、sidebar、通知、アーカイブ、コメント、日付入力、Today、状態タブ、スケジュール、一覧ソート等を確認します。

通常Browser対象は **89件**です。`npm run test:ui` 上ではFirebase Emulator専用19件も収集されますが、通常Browser実行ではskipされます。

Ver.211で特に固定する内容は以下です。

1. **起動後full passの退役**
   - 初期起動では従来どおり `installStyle()` / `applyTodayFilters()` / `setVersion()` を含む `applyFixes()` を1回以上実行する。
   - `.nav-filter[data-filter="mine"]` / `.nav-item[data-layout]` clickではfull passを増やさず、Today passだけを実行する。
   - `#currentUserSelect` / `#startupUser` changeでもfull passを増やさず、Today passだけを実行する。
   - Ver.210で退役した状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerのfull passも復活させない。

2. **Today scoped更新**
   - mine有効時、現在ユーザー担当は表示、他担当は非表示、group担当は表示する。
   - current user変更後、担当者判定をToday専用更新だけで再評価する。
   - `#todayView`再描画は専用Observerだけで状態除外・mine/group判定を反映する。
   - Todayの `保留`、空き時間の `確認待ち` 除外意味論は変更しない。

3. **navigationと基盤表示**
   - 実際の「タスク」→「今日」navigationが成立する。
   - navigation中もstable full passは増えない。
   - stable保護styleとmanifest連動version表示を維持する。
   - Ver.210回帰テストは現行release番号に依存せず、旧退役経路を継続監視する。

4. **既存契約の継続**
   - native日付制約・segmented入力はdate-keyboard単独所有。
   - mobile状態タブはmobile側 `scrollLeft` 実装で動作し、stableは保護CSSだけを維持。
   - Ver.208の未保存破棄確認、Star内部状態、固定機能、キャッシュ消去UI非表示、通知単品既読/未読を継続。

## Ver.211で変更するもの

- `stable-fixes-v108.js`
  - nav/filter clickの `scheduleFixes()` を `scheduleTodayFilters()` へ置換。
  - current/startup user changeの `scheduleFixes()` を `scheduleTodayFilters()` へ置換。
  - 呼び出し元がなくなる `scheduleFixes()` と `scheduled` フラグを退役。
  - 初期 `applyFixes()` と `#todayView` Observerは維持。
- `release-manifest.js` をVer.211へ更新。
- `tests/stable-remaining-full-pass-audit-v211.spec.mjs` を監査用変換から製品回帰契約へ更新。
- `tests/stable-full-pass-audit-v210.spec.mjs` を現行release番号とVer.211 navigation意味論へ追従できる恒久契約へ更新。
- static contract / 責務台帳 / 回帰記録をVer.211へ更新。

## Ver.211で変更しないもの

- Todayの状態除外・mine/group意味論。
- stableの `#todayView` Observer。
- stable保護CSS。
- 初期 `applyFixes()` 内の `installStyle()` / `applyTodayFilters()` / `setVersion()`。
- `date-keyboard-fix-v127.js`、`mobile-fixes.js`、`version-display-lock.js` の製品実装。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込経路・revision・Transaction。
- dynamic CSS **21本** / dynamic JS **34本**とロード順。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

現在は **19件**です。Ver.211は書込コードを変更しませんが、全件を継続実行します。

## 主な復旧地点

- `backup/ver208-with-date-constraint-audit`: `4062f9acc62b6135faec194fe4bb663c18c7e6a6`
- `backup/ver209-before-stable-full-pass-audit`: `db740a19bd07358b3cb96005c9015125e6d44423`
- `backup/ver209-with-stable-full-pass-audit`: `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`
- `backup/ver210-before-remaining-full-pass-audit`: `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- `backup/ver210-with-remaining-full-pass-audit`: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`

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

Ver.211がmainでRegression / Pagesともにgreenになった後は、初期 `applyFixes()` に残る `setVersion()` を監査します。

初回表示は `release-manifest.js`、継続補正は `version-display-lock.js` がすでに担当しているため、stableの `setVersion()` が重複責務かを製品コード無変更で確認します。Today意味論とstable保護styleは変更しません。
