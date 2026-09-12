# 回帰テスト基盤（Ver.202）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.202ではVer.201で固定したToday最終可視性を維持したまま、mobile側の重複状態除外を退役し、stableをToday可視性の単独正本にします。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- release versionが **202** であること
- `app.js` の5基本状態削除保護が単独正本であること
- `stable-fixes-v108.js` と `mobile-fixes.js` の双方から基本状態削除ガードが除去済みであること
- `schedule-today-lock-v129.js` が `7日間` 表示を所有すること
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- native date/datetime-localの共通制約はstableが所有し、mobileから日付補正が退役していること
- `date-keyboard-fix-v127.js` はsegmented sourceのmin/maxと妥当性検証を維持すること
- Todayの状態除外・mine/group担当者判定・最終markerをstableが単独所有し、mobileにはTodayフィルタが残っていないこと
- `data-v108-hidden` は `toggleAttribute()` の空値markerでもCSS非表示安全網が有効になること
- stable/mobileはbody全体Observer、date-keyboardはdialog open同期であり、監視範囲が同一ではないこと
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

構造・契約テストは **67件**です。Ver.202では既存Today所有境界テストをstable単独所有契約へ更新し、件数は増やしません。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.202では430px幅の最終可視性契約を維持し、mobileの旧 `data-workboard-auto-hidden` markerが付かないことも確認します。

1. **Today初期表示**
   - `保留` は非表示
   - 「空き時間」の `確認待ち` は非表示
   - mine有効時の他担当通常タスクは非表示
   - `システム課` 等のgroup担当は表示

2. **複数非表示理由の遷移**
   - `保留 + 他担当` → `未着手 + 他担当` では、状態除外が外れてもmine非表示を維持
   - `保留 + 自分担当` → `未着手 + 自分担当` では表示へ戻る
   - mine解除後も状態除外が残るカードは非表示を維持

3. **Ver.200の日付所有境界を継続**
   - native date/datetime-localはstable単独所有
   - segmented UIは1回だけ構築
   - 旧mobile日付markerは付かない

通常UI件数は **67件**です。

## Ver.202で変更するもの

- `mobile-fixes.js` のToday専用状態定数・storage snapshot読取・status fallback・`patchTodayView()` を退役
- `data-workboard-auto-hidden` markerを退役
- stableをToday状態除外＋mine/group＋最終可視性の単独正本へ統一
- `release-manifest.js` をVer.202へ更新
- static/browser契約と責務台帳をVer.202へ更新

## Ver.202で変更しないもの

- `stable-fixes-v108.js` のToday判定意味論
- mine/group担当者ルール
- `date-keyboard-fix-v127.js`
- モバイル状態タブ・ヘッダー・メニュー・スケジュール表示
- dynamic CSS/JSの個数とロード順
- Firebase書込経路
- body-wide MutationObserver

つまりVer.202は、**Todayの重複状態除外を退役し、既存の最終可視性意味論をstable単独所有へ整理する版**です。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.202でもFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

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

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・ブラウザ・Emulatorを順番に実行します。

## 次の段階

Ver.202がgreenになった後は、`schedule-today-lock-v129.js` と `mobile-fixes.js` に残る7日間表示補正の重複を監査します。Todayと日付は正本化済みなので、body-wide MutationObserver削減はさらにその後の独立工程とします。
