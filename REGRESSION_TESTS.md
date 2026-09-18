# 回帰テスト基盤（Ver.220）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.220では整理作業を一時中断し、ユーザー指定の2点を独立改修します。

- Todayの「予定通知ON」を左メニューの「共同編集ON」直下へ移動し、「確認済みにする」と「スケジュールを見る」の間に縦区切りを追加する。
- コメント返信も通常コメントと同様に対応履歴へ残す。共同編集ON時は返信コメント・履歴・revisionを同一Firebase transactionで確定する。

## CIで確認する範囲

### 構造・契約

- release versionが **220** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **33本**を維持すること。
- `stable-fixes-v108.js` がrequired/dynamic scriptから外れたままであること。
- stable物理ファイルは旧キャッシュmanifest / ロールバック互換のため残ること。
- Todayの「保留除外」「mine担当判定」「空き時間の確認待ち除外」は引き続き `app.js` が正本であること。
- `core-view-density-v188.js` はToday/Schedule領域だけを監視し、document.body全体Observerを復活させないこと。
- 共同編集時の返信保存は、コメントとhistoryを同一task transactionで更新しrevisionを1回だけ増やすこと。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

- 左メニューで予定通知コントロールが `connectionPill`（共同編集状態）の直後に配置される。
- Todayのお知らせ操作群から予定通知コントロールが除かれる。
- DOM移動後も既存の通知許可ボタンのイベントが維持され、許可後に「予定通知ON」状態へ更新される。
- 「確認済みにする」→縦区切り→「スケジュールを見る」の順序を維持する。
- 区切り線が実表示され、Today操作ボタンの機能・順序を壊さない。
- Ver.219で確立したToday正本表示、mine判定、stable未読込を維持する。
- mobile `#boardView` Observer、日付キーボード、version-display-lock等の現行所有者の回帰を維持する。
- リアクション、コメント返信スレッド、メンション、お気に入り等の既存回帰を維持する。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信は遮断します。

Ver.220ではコメント返信の共有保存を変更するため、専用E2Eで次を確認します。

- 親コメントへの返信が `replyTo` を持つ構造化コメントとして保存される。
- 同じtransactionで対応履歴に `${type}を追加しました。` が1件だけ追加される。
- historyは既存仕様と同じ最大80件を維持する。
- task revisionは返信1回につき **1だけ**増える。
- `updatedAt` / `updatedBy` が返信保存時に更新される。
- 親コメントのreaction所有を壊さない。
- 保存後、対応履歴タブに返信由来の履歴が表示される。
- 本番 `firebaseio.com` / `firebasedatabase.app` への通信0件。

## Ver.220で変更するもの

- `core-view-density-v188.js`
  - Today内の既存予定通知コントロールを左メニューのconnection状態直下へ移動。
  - 「確認済みにする」と「スケジュールを見る」の間へ区切り要素を配置。
- `ui-core-density-v188.css`
  - 左メニュー通知コントロールと区切り線の表示を追加。
- `comment-reactions-v191.js`
  - 共同編集ON時の返信transactionへhistory追加を統合。
- `release-manifest.js`
  - Ver.220へ更新。active asset本数・順序は変更しない。
- Browser / Firebase / static contract / 責務台帳。

## Ver.220で変更しないもの

- `app.js` の通常コメント保存処理。ローカル返信は従来どおり既存 `addComment()` を経由し、もともとhistoryが追加される。
- タスク / ToDo / スケジュール / 業務メモの基本書込モデル。
- reaction transaction。
- メンション・通知生成ロジック。
- Todayの保留除外・mine・確認待ち除外の正本条件。
- `stable-fixes-v108.js` の物理ファイル。
- `ui-core-density-v188.css` の旧 `data-v108-hidden` 互換selector。整理作業を一時中断したため、次工程へ延期する。

## 復旧地点

- Ver.219監査main: `693814b47713cf09d7309826535ac7f052d96f50`
- 今回改修前: `backup/ver219-before-user-requested-ui-reply-history`

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

Ver.220が正式greenになった後、整理作業へ戻り、旧 `data-v108-hidden` 互換selectorの退役工程は **Ver.221以降**として再開します。
