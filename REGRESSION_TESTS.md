# 回帰テスト基盤（Ver.220）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.220では、stableによるTodayのDOM後処理を退役し、Today表示条件を `app.js` の正本描画へ統合します。

## CIで確認する範囲

### 構造・契約

- release versionが **220** であること。
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

既存Browser回帰をすべて維持し、Ver.220ではToday正本化の実挙動を追加確認します。

- 通常Todayでは「保留」が生成されない。
- mineでは現在ユーザー＋現在の共有ルーム名担当だけが残る。
- 旧stable固定名 `システム課` は、現在の共有ルーム名でない限りmine特別扱いしない。
- mine解除で他担当が復帰する。
- 空き時間候補の「確認待ち」は生成されない。
- Today予定のmine判定も現在ユーザー＋現在ルーム担当へ統一される。
- Today DOMに `data-v108-hidden` が生成されない。
- Resource Timing上でも `stable-fixes-v108.js` が読み込まれない。
- Ver.218までのリアクション、Ver.217お気に入り、Ver.216コメント入力、Ver.215返信回帰を維持する。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信は遮断します。

Ver.220は書込モデルを変更しないため、既存Firebase Emulatorテストを全件維持します。

- コメント返信 / reaction transaction / task revision。
- ToDo / 業務メモ / 通知 / アーカイブ等の既存書込。
- 本番 `firebaseio.com` / `firebasedatabase.app` への通信0件。

## Ver.220で変更するもの

- `app.js`: Today意味論3点を正本描画へ統合。
- `release-manifest.js`: stableをactive runtimeから除外しVer.220へ更新。
- Today退役static / Browser contract。
- patch responsibility台帳、version監査、責務文書。

## Ver.220で変更しないもの

- タスク / ToDo / スケジュール / 業務メモの書込モデル。
- Firebase transaction / revision整合性。
- コメント返信・リアクション・メンション・通知。
- お気に入り保存・フィルター。
- `mobile-fixes.js`、`date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js`、`version-display-lock.js` の責務。
- `stable-fixes-v108.js` の物理ファイル。現行runtimeでは読み込まない。

## 復旧地点

- Ver.219監査main: `b5be835489360cd4417403a70f9b0943cd0e47b1`
- `backup/ver219-before-stable-today-retirement`

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

Ver.220が正式greenになった後、`ui-core-density-v188.css` に残る旧 `data-v108-hidden` 互換selectorの退役可否を監査します。