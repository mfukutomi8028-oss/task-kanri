# 回帰テスト基盤（Ver.199 / Ver.200監査追記）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.199では基本状態5種の削除保護を `app.js` 単独所有へ整理しました。Ver.200はリリース番号を進めない監査工程として、Today表示と日付入力の近接責務を追加で固定します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- release versionは **199のまま** であること
- `app.js` の5基本状態削除保護が単独正本であること
- `stable-fixes-v108.js` と `mobile-fixes.js` の双方から基本状態削除ガードが除去済みであること
- `schedule-today-lock-v129.js` が `7日間` 表示を所有すること
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- stable/mobile/date-keyboardの日付責務が現在の境界を維持すること
- Todayのmine/group担当者判定がstable固有で、mobileは状態除外だけを持つこと
- stable/mobileはbody全体Observer、date-keyboardはdialog open同期であり、監視範囲が同一ではないこと
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

構造・契約テストは **67件**です。Ver.200監査で3件追加します。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.200では430px幅の実ブラウザテストを2件追加し、次を固定します。

1. **日付入力の合成境界**
   - 起動時から存在するタスク期限sourceはsegmented UIへ1回だけ変換される
   - native sourceの1900〜9999制約が維持される
   - stable側の日付補正も有効である
   - 起動後に追加したnative date/datetime-localは制約補正される
   - ただし起動後追加native dateはsegmented UIへ自動変換されない
   - Observerが複数回動いても既存segmented wrapperが重複しない

2. **Todayの所有境界**
   - `保留` と「空き時間」の `確認待ち` はstable/mobile双方のマーカーが付く
   - mineフィルタで他担当の通常状態はstableのマーカーだけが付く
   - `システム課` のグループ担当はどちらのマーカーも付かない

通常UI件数は **66件**です。

## Ver.200で変更しないもの

- `release-manifest.js`（Ver.199のまま）
- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `date-keyboard-fix-v127.js`
- Firebase書込経路
- dynamic CSS/JSの個数とロード順
- Todayの最終表示ロジック
- body-wide MutationObserver

監査内容の詳細は `FOUNDATION_OVERLAP_AUDIT_V200.md` を参照します。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.200ではFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

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

Ver.200監査工程がgreenになった後は、**日付制約の正本整理**を次の製品変更候補とします。3系統を一度に変更せず、stable/mobileのどちらか一方だけを最初の退役候補として評価します。Todayとbody-wide Observerは別工程です。
