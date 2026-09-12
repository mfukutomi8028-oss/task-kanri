# 回帰テスト基盤（Ver.199）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.199では、Ver.198で `app.js` に正本化した基本状態5種の削除保護が、`mobile-fixes.js` の重複ガードを退役してもスマホ上で維持されることを固定します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- Ver.199のrelease versionが `199` であること
- `app.js` の `DEFAULT_STATUSES` が5基本状態の正本であること
- `app.js` が削除保護専用 `isProtectedDeleteStatus()` を持ち、5基本状態すべてを拒否すること
- 状態名称のreadonly判定は `isCompletedStatus()` のままで、`完了` だけ名称固定であること
- `stable-fixes-v108.js` と `mobile-fixes.js` の双方から基本状態削除ガードが除去済みであること
- `mobile-fixes.js` の `PROTECTED_DELETE_STATUSES` はToday状態読取補助としてのみ残ること
- `schedule-today-lock-v129.js` が `7日間` 表示を所有し、Observerが1系統のままであること
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

構造・契約テストは **64件**です。Ver.199では既存のstatus-delete ownership契約を更新し、件数は増やさず責務境界を置き換えます。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、従来の主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.199では430px幅のスマホ専用テストを1件追加し、次を確認します。

- `mobile-fixes.js` が実際に読み込まれた状態であること
- `未着手` / `対応中` / `確認待ち` / `保留` / `完了` の削除ボタンがすべてdisabled
- 5状態すべてに `aria-disabled="true"` と削除不可titleが付く
- `未着手` / `対応中` / `確認待ち` / `保留` の名称入力はreadonlyではない
- `完了` の名称入力だけreadonly
- カスタム状態の削除ボタンは有効

通常UI件数は **64件**です。

## Ver.198〜199 基本状態削除保護の整理

### Ver.198

`app.js` に `isProtectedDeleteStatus()` を追加し、5基本状態の削除保護を状態管理UIと `deleteStatus()` の両方で正本化しました。`stable-fixes-v108.js` の重複削除ガードを退役し、`mobile-fixes.js` は一時的な互換層として残しました。

### Ver.199

`mobile-fixes.js` から削除保護に関係するpredicate、ボタンpatch、capture click guard、`patchAll()` 呼出しを除去します。モバイルのメニュー、状態タブ、Today表示、日付入力、`7日間` 表示、Observerは変更しません。

`PROTECTED_DELETE_STATUSES` はTodayカードの状態読取補助から参照されているため、この工程では残します。削除保護の所有を示すものではありません。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.199ではFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

## 復旧地点

- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`
- `backup/ver197-before-status-delete-canonicalization`: `a2365af90d95add7b76ac4726be96af3f92e2d70`
- `backup/ver198-before-mobile-status-delete-retirement`: `5250ab9c551507588f329c5f0feab118fee9659c`

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

Ver.199完了後は `stable-fixes-v108.js` と `mobile-fixes.js` に残るToday・日付入力などの近接責務を再監査します。次の製品変更は専用の安全網を先に置き、1責務ずつ実施します。
