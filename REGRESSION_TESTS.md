# 回帰テスト基盤（Ver.219）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.219では、監査PR #66 / #67で確認した結果を製品へ反映し、stableによるTodayのDOM後処理を退役してToday表示条件を `app.js` の正本描画へ統合します。

## CIで確認する範囲

### 構造・契約

- release versionが **219** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **33本**。
- `stable-fixes-v108.js` がrequired/dynamic scriptから外れていること。
- stable物理ファイルは旧キャッシュmanifest / ロールバック互換のため残っていること。
- Todayの「保留除外」「mine担当判定」「空き時間の確認待ち除外」が `app.js` に各1か所だけ存在すること。
- current user + current room-name groupの担当判定を正本として使用すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

Ver.219では、修正前のstable存在を前提にしたnegative audit / 段階監査テストを現行回帰から退役し、製品正本を直接確認する回帰へ置き換えます。

- 通常Todayでは「保留」が生成されない。
- mineでは現在ユーザー＋現在の共有ルーム名担当だけが残る。
- 旧stable固定名 `システム課` は、現在の共有ルーム名でない限りmine特別扱いしない。
- mine解除で他担当が復帰する。
- 空き時間候補の「確認待ち」は生成されない。
- Today予定のmine判定も現在ユーザー＋現在ルーム担当へ統一される。
- Today DOMに `data-v108-hidden` が生成されない。
- Resource Timing上でも `stable-fixes-v108.js` が読み込まれない。
- mobile `#boardView` Observer、日付キーボード、version-display-lock等の現行所有者の回帰を維持する。
- Ver.218までのリアクション、Ver.217お気に入り、Ver.216コメント入力、Ver.215返信回帰を維持する。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信は遮断します。

Ver.219は書込モデルを変更しないため、既存Firebase Emulatorテストを全件維持します。

- コメント返信 / reaction transaction / task revision。
- ToDo / 業務メモ / 通知 / アーカイブ等の既存書込。
- 本番 `firebaseio.com` / `firebasedatabase.app` への通信0件。

## Ver.219で変更するもの

- `app.js`: Today意味論3点を正本描画へ統合。
- `release-manifest.js`: stableをactive runtimeから除外しVer.219へ更新。
- Today退役static / Browser contract。
- patch responsibility台帳、version監査、責務文書。
- stableの現役実行を前提にした旧段階監査Browser specを履歴へ退役。

## Ver.219で変更しないもの

- タスク / ToDo / スケジュール / 業務メモの書込モデル。
- Firebase transaction / revision整合性。
- コメント返信・リアクション・メンション・通知。
- お気に入り保存・フィルター。
- `mobile-fixes.js`、`date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js`、`version-display-lock.js` の責務。
- `stable-fixes-v108.js` の物理ファイル。現行runtimeでは読み込まない。
- `ui-core-density-v188.css` の旧 `data-v108-hidden` 互換selector。次工程の監査対象とする。

## 復旧地点

- Ver.219監査main: `b5be835489360cd4417403a70f9b0943cd0e47b1`
- 最新テスト整理前: `backup/pr69-before-stale-stable-test-retirement`

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・Browser・Firebase Emulatorを順番に実行します。

## 次工程

Ver.219が正式greenになった後、`ui-core-density-v188.css` に残る旧 `data-v108-hidden` 互換selectorの退役可否を製品コード無変更の監査から開始します。
