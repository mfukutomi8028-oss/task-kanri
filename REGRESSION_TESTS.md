# 回帰テスト基盤（Ver.221）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.221では整理作業へ戻り、Ver.219でactive runtimeから退役済みの `stable-fixes-v108.js` がかつて付与していた `data-v108-hidden` に対応する旧CSS compatibility selectorを、現行製品CSSから正式に削除します。

Ver.220で追加した予定通知の左メニュー移動・Today操作区切り・コメント返信履歴はそのまま維持します。

## CIで確認する範囲

### 構造・契約

- release versionが **221** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **33本**を維持すること。
- `stable-fixes-v108.js` がrequired/dynamic scriptから外れたままであること。
- stable物理ファイルは旧キャッシュmanifest / ロールバック互換のため残ること。
- `ui-core-density-v188.css` に `data-v108-hidden` selectorが残っていないこと。
- Todayの「保留除外」「mine担当判定」「空き時間の確認待ち除外」は引き続き `app.js` が正本であること。
- `core-view-density-v188.js` はToday/Schedule領域だけを監視し、document.body全体Observerを復活させないこと。
- Ver.220の共同編集時返信保存は、コメントとhistoryを同一task transactionで更新しrevisionを1回だけ増やすこと。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

- 配信後のCSSOMにも `data-v108-hidden` selectorが存在しない。
- Today DOMにも `data-v108-hidden` markerが生成されない。
- 通常Todayで自分担当・共有ルーム担当・旧固定名担当・他担当が正しく表示される。
- 「保留」はDOM生成されず、空き時間の「確認待ち」もDOM生成されない。
- mine時は現在ユーザー＋現在共有ルーム担当だけが残り、旧固定名 `システム課` を特別扱いしない。
- mine解除後に他担当表示が復帰する。
- 左メニューの予定通知コントロールが `connectionPill` の直後に配置される。
- Todayのお知らせ操作群から予定通知コントロールが除かれたままである。
- 「確認済みにする」→縦区切り→「スケジュールを見る」の順序を維持する。
- mobile Schedule toolbar / 検索 / 日付表示が維持され、横overflowしない。
- mobile `#boardView` Observer、日付キーボード、version-display-lock等の現行所有者の回帰を維持する。
- リアクション、コメント返信スレッド、メンション、お気に入り等の既存回帰を維持する。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信は遮断します。

Ver.221では書込ロジックを変更しません。既存のFirebase Emulator全件を維持し、特にVer.220のコメント返信について次を再確認します。

- 親コメントへの返信が `replyTo` を持つ構造化コメントとして保存される。
- 同じtransactionで対応履歴に `${type}を追加しました。` が1件だけ追加される。
- historyは最大80件を維持する。
- task revisionは返信1回につき **1だけ**増える。
- `updatedAt` / `updatedBy` が返信保存時に更新される。
- 親コメントのreaction所有を壊さない。
- 保存後、対応履歴タブに返信由来の履歴が表示される。
- 本番 `firebaseio.com` / `firebasedatabase.app` への通信0件。

## Ver.221で変更するもの

- `ui-core-density-v188.css`
  - 旧 `#todayView [data-v108-hidden]` compatibility selectorを削除。
  - Ver.220の予定通知・区切り線・Schedule presentationは維持。
- `release-manifest.js`
  - Ver.221へ更新。active asset本数・順序は変更しない。
- `test-harness/version-source-v194.test.mjs`
  - 現行CSSに旧selectorが存在しないことをstatic contract化。
- `tests/v108-hidden-css-retirement-v221.spec.mjs`
  - 仮想除去ではなく実製品CSSの退役を直接確認。
- version表示回帰・Ver.220 UI回帰のrelease番号追随。
- 責務台帳・整理文書。

## Ver.221で変更しないもの

- `app.js` のToday意味論・タスク/ToDo/スケジュール/業務メモの書込モデル。
- `core-view-density-v188.js` のVer.220予定通知移動・区切り線・Schedule DOM再構成。
- コメント・返信・reaction transaction。
- メンション・通知生成ロジック。
- `stable-fixes-v108.js` の物理ファイル。
- dynamic CSS / JSの本数と読込順。

## 復旧地点

- Ver.220正式main: `8b71dfba6dddc2292365d31f6e87177639c2ebc7`
- 今回整理前: `backup/ver220-before-v108-hidden-css-retirement`

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

Ver.221が正式greenになった後、`core-view-density-v188.js` に残るToday/Schedule DOM再構成とfeature-scoped Observerを、製品コード無変更の監査から確認します。
