# 回帰テスト基盤（Ver.197）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.197では、基本状態5種の削除保護を `app.js` 正本へ寄せる前に、現在の責務分散と「削除不可」と「名称編集可否」の境界を固定します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- Ver.187〜193で整理済みの表示責務・書込責務境界
- Ver.197のrelease versionが `197` であること
- stable-fixesからスケジュールrangeラベル責務が除去済みであること
- `schedule-today-lock-v129.js` が `7日間` 表示を所有し、Observerが1系統のままであること
- `app.js` の `DEFAULT_STATUSES` が5基本状態の正本であること
- `app.js` の名称固定・直接削除拒否が現時点では `完了` のみであること
- stable/mobileが同じ5基本状態削除ガードを保持していること
- stable/mobileのガードがdisabled・ARIA・title・click阻止を維持すること
- `version-display-lock.js` がmanifest版から表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.197では `status-delete-ownership-v197.test.mjs` を2件追加し、構造・契約テストは **63件**です。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、従来の主要画面・各ブレークポイント・アイコン・sidebar・通知・アーカイブ・コメント・密度・動的資産・JavaScript例外・日付入力・Todayフィルタ・モバイル状態タブ・一覧ソート等を継続確認します。

Ver.197では基盤状態管理テストを拡張し、次を明示的に確認します。

- `未着手` / `対応中` / `確認待ち` / `保留` / `完了` の削除ボタンがすべてdisabled
- 5状態すべてに `aria-disabled="true"` と削除不可titleが付く
- `未着手` / `対応中` / `確認待ち` / `保留` の名称入力はreadonlyではない
- `完了` の名称入力だけreadonly
- カスタム状態の削除ボタンは有効
- スケジュール `7日間` 表示補正も従来どおり維持

既存テストの内容を強化するため、通常UI件数は **63件**のままです。

## Ver.194〜196の安全網

- Ver.194: バージョン番号の正本を `WORK_BOARD_RELEASE.version` へ統一
- Ver.195: stable/mobile重複監査を行い、通常UIを60→63件へ拡張
- Ver.196: 「7日間」ラベル補正をschedule所有へ移管し、PR/main双方で Protocol 61 / UI 63 / Firebase Emulator 19 をgreen確認

Ver.196 main SHAは `9961722663350be71415c078abe50bf1975c8842`、Regression #113 と Pages #310 はともにsuccessです。

## Ver.197 基本状態削除保護監査

製品側の削除ガードは変更しません。`STATUS_DELETE_OWNERSHIP_AUDIT_V197.md` に現状と次の移管手順を記録します。

現在は以下です。

- `app.js`: 5基本状態を定義するが、名称固定・直接削除拒否は `完了` のみ
- `stable-fixes-v108.js`: 5基本状態の削除保護を通常実行経路で補完
- `mobile-fixes.js`: 同じ5状態削除保護をモバイル互換として重複保持

次工程では `app.js` に削除専用predicateを追加し、名称編集可否と削除可否を分離したうえで、まずstable側の重複ガードだけを退役候補とします。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。Ver.197ではFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`
- `backup/ver189-with-work-features-emulator-e2e`: `2d64ee501b63968cd6e71129e131d09d16ca4de4`
- `backup/ver190-before-user-comment-write-tests`: `7abf2ad9d56789219ff0b593ca0dabe12e8f144a`
- `backup/ver190-with-user-comment-emulator-e2e`: `b5f50d4fd0f8ae6d293d3ce82b3522009417d624`
- `backup/ver191-before-workflow-detail-css`: `821612c3de5b5cd7c620b3e1ac529c886ad2b2a5`
- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`

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

Ver.197完了後は `app.js` に**削除保護専用predicate**を追加し、5基本状態をアプリ本体で拒否します。名称編集固定は `完了` のまま維持し、stable/mobileの二重ガードは一度に削除しません。
