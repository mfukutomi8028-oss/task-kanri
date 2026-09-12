# 回帰テスト基盤（Ver.194）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.194では、Ver.193後に追加した基盤JavaScript安全網を使い、バージョン正本の責務競合だけを最小修正します。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187〜193で整理済みの表示責務・書込責務境界
- Ver.193の `ui-activity-dialog-v193.css` / `ui-task-list-sort-v193.css` が旧CSSとbyte-for-byte同一であること
- Ver.194のrelease versionが `194` であること
- `stable-fixes-v108.js` が旧 `VERSION = "122"` を保持せず、`WORK_BOARD_VERSION` を書き込まないこと
- `stable-fixes-v108.js` のバージョン表示補正が `WORK_BOARD_RELEASE.version` を参照すること
- `version-display-lock.js` がmanifest版から画面表示と互換変数を同期すること
- 基本状態保護、日付補正、Todayフィルタ等のstable-fixes既存責務が残っていること
- 基盤5JSのロード順を維持すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.194ではversion-source契約を3件追加し、構造・契約テストは **61件**です。

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
- 基本ステータス削除保護と「7日間」ラベル補正
- 分割日付入力の正常値反映と存在しない日付の拒否
- スケジュール「今日」表示中に前へ/次へで実日付から移動しないこと
- タスク一覧の列ソート、昇降順、localStorage永続化、基本ソート変更時の解除

通常ブラウザではFirebase専用19件をskipし、**60件**の通常UI回帰を実行します。既存PNG基準は、意図したデザイン変更でない限り更新しません。

## Ver.194 バージョン責務整理

Ver.193後の監査で、`stable-fixes-v108.js` が旧 `VERSION = "122"` を `window.WORK_BOARD_VERSION` へ書き戻し得る一方、`version-display-lock.js` が `window.WORK_BOARD_RELEASE.version` を使って現行版へ戻す責務競合を確認しました。

Ver.194ではこの競合だけを修正します。

- `release-manifest.js` の `WORK_BOARD_RELEASE.version` をバージョン正本とする
- `stable-fixes-v108.js` から旧 `VERSION = "122"` を除去
- `stable-fixes-v108.js` から `WORK_BOARD_VERSION` への書込みを除去
- stable-fixes内の表示補正はmanifest版を参照
- `version-display-lock.js` はmanifestから画面表示と互換変数を同期する責務を維持
- `date-keyboard-fix-v127.js` / `schedule-today-lock-v129.js` / `list-sort-v131.js` は変更しない
- Firebase書込経路は変更しない

## 基盤JavaScript安全網

`tests/foundation-js-behavior-v194.spec.mjs` で次の5挙動を固定しています。

1. manifest版の画面表示・互換バージョン復元
2. 基本状態削除保護と「7日間」ラベル補正
3. 分割日付入力の正常値反映と不正日付拒否
4. 「今日」表示中の前後移動抑止
5. 一覧列ソート、昇降順、localStorage永続化、基本ソート変更時の解除

## Firebase Emulator E2E

本番RTDBではなく、project `demo-task-kanri`、Realtime Database Emulator `127.0.0.1:9000`、test用roomだけを使用します。`firebaseio.com` / `firebasedatabase.app` へのブラウザ通信は遮断します。

現在は **19件**です。アーカイブ、通知、重複統合、ToDo、業務メモ、予約タスク、共有ユーザー追加、同名ユーザー競合、コメントリアクション追加/解除まで固定しています。Ver.194はFirebase書込JavaScriptを変更しませんが、安全網として19件すべてを継続実行します。

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

Ver.194完了後は `stable-fixes-v108.js` に残るモバイル補正・基本状態保護・日付制約・Todayフィルタの複数責務を監査します。すぐに分割せず、既存60件UI回帰で不足する責務だけ追加安全網を作成してから、分離の効果とリスクを判断します。
