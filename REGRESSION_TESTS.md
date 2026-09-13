# 回帰テスト基盤（Ver.203）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.203ではmobile側の重複 `7日間` ラベル補正を退役し、`schedule-today-lock-v129.js` をスケジュール範囲ラベルの単独正本にします。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- release versionが **203** であること
- `app.js` の5基本状態削除保護が単独正本であること
- `stable-fixes-v108.js` と `mobile-fixes.js` の双方から基本状態削除ガードが除去済みであること
- `schedule-today-lock-v129.js` が `7日間` 表示とツールチップを単独所有し、`mobile-fixes.js` に `patchScheduleRangeButtons()` が残っていないこと
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- native date/datetime-localの共通制約はstableが所有し、mobileから日付補正が退役していること
- `date-keyboard-fix-v127.js` はsegmented sourceのmin/maxと妥当性検証を維持すること
- Todayの状態除外・mine/group担当者判定・最終markerをstableが単独所有し、mobileにはTodayフィルタが残っていないこと
- `data-v108-hidden` は `toggleAttribute()` の空値markerでもCSS非表示安全網が有効になること
- stable/mobileはbody全体Observer、date-keyboardはdialog open同期であり、監視範囲が同一ではないこと
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

構造・契約テストは **67件**です。Ver.203では既存schedule所有契約にmobile側退役確認を追加し、件数は増やしません。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.203ではVer.202のToday最終可視性契約を維持したうえで、430px幅で `7日間` 文言と「今日から7日間を表示します」ツールチップがschedule正本だけで復元される専用契約を追加します。あわせて、schedule密度の画像回帰は実行日を跨いでも基準画像が変わらないよう、スクリーンショット直前の表示日だけを固定して比較します。製品側の日時処理は変更しません。

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

通常UI件数は **68件**です。

## Ver.203で変更するもの

- `mobile-fixes.js` の `patchScheduleRangeButtons()` と `patchAll()` からの呼出しを退役
- `schedule-today-lock-v129.js` を `7日間` 文言・ツールチップの単独正本として維持
- `release-manifest.js` をVer.203へ更新
- 430pxのscheduleラベル実ブラウザ契約と責務台帳をVer.203へ更新

## Ver.203で変更しないもの

- `stable-fixes-v108.js` のToday判定意味論とnative日付制約
- mine/group担当者ルール
- `date-keyboard-fix-v127.js`
- `schedule-today-lock-v129.js` のToday固定・prev/next制御
- モバイル状態タブ・ヘッダー・メニュー
- `resetScheduleAnchorBeforeRollingWeek()` の扱い（別責務として今回は変更しない）
- dynamic CSS/JSの個数とロード順
- Firebase書込経路
- body-wide MutationObserver

つまりVer.203は、**モバイル側の重複スケジュールラベル補正だけを退役し、schedule専用パッチへ表示責務を一本化する版**です。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.203でもFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

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
- `backup/ver202-before-mobile-schedule-overlap`: `8907773d063aef5e69c6215e2f847ed9617e1582`

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

Ver.203がgreenになった後は、stable/mobile双方が触るモバイル状態タブの水平スクロール責務を監査します。ヘッダー・メニュー・body-wide MutationObserver削減はさらに後の独立工程とします。