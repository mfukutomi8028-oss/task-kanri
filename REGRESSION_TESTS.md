# 回帰テスト基盤（Ver.198）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.198では、基本状態5種の削除保護を `app.js` の正本責務へ移しつつ、名称編集可否を従来どおり維持できていることを固定します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- Ver.198のrelease versionが `198` であること
- stable-fixesからスケジュールrangeラベル責務が除去済みであること
- `schedule-today-lock-v129.js` が `7日間` 表示を所有し、Observerが1系統のままであること
- `app.js` の `DEFAULT_STATUSES` が5基本状態の正本であること
- `app.js` が削除保護専用 `isProtectedDeleteStatus()` を持ち、5基本状態すべてを拒否すること
- 状態名称のreadonly判定は `isCompletedStatus()` のままで、`完了` だけ名称固定であること
- `stable-fixes-v108.js` から基本状態削除ガードが除去済みであること
- `mobile-fixes.js` は移行期間の互換層として同じ5状態削除ガードを保持していること
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.197の2件の責務監査契約をVer.198の3件の正本化契約へ置き換えるため、構造・契約テストは **64件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、従来の主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.198でも基盤状態管理テストは次を確認します。

- `未着手` / `対応中` / `確認待ち` / `保留` / `完了` の削除ボタンがすべてdisabled
- 5状態すべてに `aria-disabled="true"` と削除不可titleが付く
- `未着手` / `対応中` / `確認待ち` / `保留` の名称入力はreadonlyではない
- `完了` の名称入力だけreadonly
- カスタム状態の削除ボタンは有効
- スケジュール `7日間` 表示補正も従来どおり維持

通常UI件数は **63件**のままです。Ver.197 main検証時に発見した日付入力テストのsidebar overlayフレークは、対象テストが既存のNew Task click handlerをDOMから直接発火するよう安定化済みです。toolbar/sidebarの実ポインタ・geometryは専用回帰テストで別途確認します。

## Ver.198 基本状態削除保護の正本化

Ver.198ではFirebase書込経路やstatus rename transactionを変更せず、削除可否の判定位置だけを整理します。

`app.js` は `DEFAULT_STATUSES` を参照する `isProtectedDeleteStatus()` を持ち、状態管理UIと `deleteStatus()` の両方で5基本状態を拒否します。一方、`renameStatus()` は引き続き `isCompletedStatus()` のみを確認するため、`未着手`〜`保留` の名称編集は従来どおり可能です。

`stable-fixes-v108.js` からは重複していた削除ボタンpatch・capture click guardを除去します。`mobile-fixes.js` は今回変更せず、次工程まで互換ガードを残します。これにより一度に二つの互換層を外すリスクを避けます。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.198ではFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

## 復旧地点

- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`
- `backup/ver197-before-status-delete-canonicalization`: `a2365af90d95add7b76ac4726be96af3f92e2d70`

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

Ver.198完了後は `mobile-fixes.js` に残る**基本状態削除保護だけ**を監査し、app正本で十分に保護できることを確認してから退役します。他のモバイルUX責務は同じ変更に混ぜません。
