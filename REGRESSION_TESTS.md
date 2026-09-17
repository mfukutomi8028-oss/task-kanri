# 回帰テスト基盤（Ver.219）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.219では、監査PR #66 / #67で確認した結果を製品へ反映し、Todayの意味論を `app.js` の正本描画へ統合します。これにより `stable-fixes-v108.js` のToday後処理・独自データ探索・MutationObserverをactive runtimeから退役します。

## CIで確認する範囲

### 構造・契約

- release versionが **219** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本**を維持し、stable退役によりdynamic JSが **33本**であること。
- `stable-fixes-v108.js` が `requiredAssets` / `dynamicScripts` に存在しないこと。
- `stable-fixes-v108.js` の物理ファイルはVer.218以前のキャッシュ互換用に残ること。
- `app.js` がTodayタスクの「保留」除外、mineの共有担当判定、Today予定のmine判定、空き時間の「確認待ち」除外を正本として持つこと。
- `app.js` と `ui-core-density-v188.css` に `data-v108-hidden` が残らないこと。
- date / mobile status tab / schedule label / version displayの既存所有境界を維持すること。
- コメント返信、リアクション、お気に入り表示等の既存契約を維持すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

通常Browser回帰を全件実行し、Ver.219では監査用の仮変換ではなく**実製品コードそのもの**を検証します。

Ver.219専用回帰では以下を固定します。

1. **Todayタスクの正本描画**
   - 非mineでは自分、現在の共有ルーム名担当、旧固定名担当、他担当の通常タスクを表示する。
   - 「保留」はDOM生成前に除外する。
   - 空き時間の「確認待ち」はDOM生成前に除外する。
   - `data-v108-hidden` に依存しない。

2. **mine判定の統一**
   - mine時は現在ユーザー + 現在の共有ルーム名担当を表示する。
   - 旧固定名「システム課」を特別な共有担当として扱わない。
   - 他担当はmine時にDOM生成しない。
   - mine解除後は他担当・旧固定名担当が再表示される。

3. **Today予定の共有担当**
   - mine時も現在ユーザー + 現在の共有ルーム名担当の予定を表示する。
   - 他担当予定はmine時に除外する。
   - mine解除後は再表示する。

4. **stable退役**
   - active manifestからstableを外した状態で上記挙動が成立する。
   - Today表示にstableのmarker、localStorage走査、固定共有担当、Observerを必要としない。

5. **既存UI・機能**
   - Ver.218のモバイルリアクション位置を維持する。
   - Ver.217のお気に入り表記を維持する。
   - Ver.216のコメント入力1列表示を維持する。
   - Ver.215の返信スレッド・reaction transactionを維持する。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

Ver.219では書込モデル、revision、transactionを変更しないため、既存 **20件**をすべて維持します。

- コメント返信のstructured `replyTo` 保存。
- reaction transactionとtask revision整合性。
- ToDo / 業務メモ / 通知 / アーカイブ等の既存Firebase書込。
- 本番Firebaseへの通信が0件。

## Ver.219で変更するもの

- `app.js`: Today意味論を正本描画へ統合。
- `release-manifest.js`: Ver.219化し、`stable-fixes-v108.js` をactive inventoryから退役。
- `ui-core-density-v188.css`: `data-v108-hidden` 用の最終非表示ルールを退役。
- Ver.219監査テストを製品回帰へ昇格。
- 旧データ責務のnegative auditはPR #66 / #67の履歴へ残し、現行テストからは退役。
- 責務台帳・version contractをVer.219へ更新。

## Ver.219で変更しないもの

- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込・revision・transaction。
- `mobile-fixes.js` の状態タブ横スクロール。
- `date-keyboard-fix-v127.js` の日付入力。
- `schedule-today-lock-v129.js` の7日間ラベル。
- `version-display-lock.js` のversion表示同期。
- コメント返信・リアクション・メンション・通知。
- お気に入り保存・フィルター処理。

## 復旧地点

- Ver.218正式main: `efa609079fdf45a337d5fae86e389d265333d383`
- Ver.219監査後main: `b5be835489360cd4417403a70f9b0943cd0e47b1`
- `backup/ver219-audits-before-stable-retirement`: Ver.219製品反映前の復旧地点。

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

Ver.219がmainでRegression / Pagesともにgreenになった後、active foundationに残る `date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js`、`list-sort-v131.js`、`version-display-lock.js` の責務重複を監査します。
