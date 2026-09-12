# 回帰テスト基盤（Ver.196）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.195で `stable-fixes-v108.js` の重複責務を監査し、通常UI回帰を63件へ拡張しました。Ver.196では、その安全網を使ってスケジュール「7日間」ラベル補正の所有場所だけを最小変更します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187〜193で整理済みの表示責務・書込責務境界
- Ver.193の `ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` が旧CSSとbyte-for-byte同一であること
- Ver.196のrelease versionが `196` であること
- `stable-fixes-v108.js` が旧 `VERSION = "122"` を保持せず、`WORK_BOARD_VERSION` を書き込まないこと
- stable-fixesの残存責務が、基本状態保護・日付補正・Todayフィルタ・モバイル状態タブ補正であること
- stable-fixesからスケジュールrangeラベル責務が除去されていること
- `schedule-today-lock-v129.js` が `7日間` / `今日から7日間を表示します` を所有すること
- schedule lockのMutationObserverが既存1系統のままで `#scheduleView` に限定されること
- `version-display-lock.js` がmanifest版から画面表示と互換変数を同期すること
- 基盤5JSのロード順を維持すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.196では既存version-source契約の内容を更新し、構造・契約テストは **61件**を維持します。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で次を確認します。

- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360pxの主要表示
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログ、開始日、リロード
- sidebar collapsed / expanded / pinned、861/860px境界
- アイコン、タスクツールバー、サイドバーの視覚回帰
- Ver.185ブランド仕様
- 通知・アーカイブの1366 / 860 / 430 / 390px視覚回帰
- メンションpicker / タスク表示の860 / 430 / 390px視覚回帰
- Ver.188の画面密度・主要操作配置
- 同一オリジン404、JavaScript例外、動的資産読込失敗、横スクロール発生の検出
- manifest版の画面バージョン表示が旧表示上書き後も復元されること
- `WORK_BOARD_VERSION` を一時的に旧値へ変更してもmanifest版へ復元されること
- 基本ステータス削除保護
- `#scheduleView` 内の「週」ボタンが `7日間` と正しいtooltipへ補正されること
- 分割日付入力の正常値反映と存在しない日付の拒否
- スケジュール「今日」表示中に前へ/次へで実日付から移動しないこと
- タスク一覧の列ソート、昇降順、localStorage永続化、基本ソート変更時の解除
- 後挿入date/datetime-localへの1900〜9999制約
- Todayの状態・mine/group判定マーカー
- モバイル状態タブの横スクロール契約

通常ブラウザではFirebase専用19件をskipし、**63件**の通常UI回帰を実行します。既存PNG基準は、意図したデザイン変更でない限り更新しません。

## Ver.194 バージョン責務整理

- `WORK_BOARD_RELEASE.version` を番号正本へ統一
- stable-fixesから旧 `VERSION = "122"` と `WORK_BOARD_VERSION` 書込みを除去
- `version-display-lock.js` がmanifestから画面表示と互換変数を同期

## Ver.195 stable-fixes監査安全網

製品コードを変更せず、stable/mobileの重複・近接責務を監査しました。追加した3ブラウザ契約により通常UIは **60→63件**です。

1. 動的に追加されたdate/datetime-localへの制約
2. Todayの状態・担当者判定マーカー
3. モバイル状態タブの横スクロール契約

Ver.195 main `6a95605e9e4b118033dff58c07e37fa8fac8690e` では Protocol 61 / UI 63 / Firebase Emulator 19 と Pages #309 がすべてgreenです。

## Ver.196 スケジュールrange責務移管

Ver.196の製品コード変更は、スケジュール「7日間」表示補正の所有場所だけです。

- `stable-fixes-v108.js` から `patchScheduleRangeLabel()` と呼出しを削除
- `schedule-today-lock-v129.js` に `normalizeWeekRangeLabel()` を追加
- 既存の `#scheduleView` 限定MutationObserverを利用
- 新規Observerなし
- dynamic asset個数・ロード順変更なし
- `mobile-fixes.js` は変更しない
- Firebase書込経路は変更しない

`tests/foundation-js-behavior-v194.spec.mjs` では、基本状態保護はstable側のまま、合成したweek buttonを `#scheduleView` 内へ置いてschedule lock側が補正することを確認します。

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。アーカイブ、通知、重複統合、ToDo、業務メモ、予約タスク、共有ユーザー追加、同名ユーザー競合、コメントリアクション追加/解除まで固定しています。Ver.196はFirebase書込JavaScriptを変更しませんが、安全網として19件すべてを継続実行します。

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

## 実行方法

通常回帰:

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

Firebase Emulator:

```bash
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・ブラウザ・Emulatorを順番に実行します。

## 次の段階

Ver.196完了後は **基本状態の削除保護**を次候補として監査します。`app.js` の状態管理を正本へ寄せられるかを契約化してから、stable/mobileの二重ガードを1責務ずつ整理します。日付制約・Todayフィルタ・body全体MutationObserverは別工程です。
