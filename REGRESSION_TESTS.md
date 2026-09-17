# 回帰テスト基盤（Ver.217）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.217では、ユーザー向けに分かりづらかった「スター」表記を「お気に入り」へ統一します。お気に入りの保存・絞り込み・切替ロジックは変更せず、表示文言・アクセシビリティ文言だけを補正します。

## CIで確認する範囲

### 構造・契約

- release versionが **217** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **34本**とロード順を維持すること。
- `user-ux-polish-v208.js` が左ナビ・詳細操作・カード操作・toastの「お気に入り」表記を所有すること。
- `user-ux-polish-v208.js` が `favoriteTaskIds` の保存責務を持たないこと。
- 詳細操作に `☆` / `★` を再導入しないこと。
- Ver.216までのコメント返信・コメント入力1列レイアウト契約を維持すること。
- Ver.214までのToday / date / mobile / schedule / version境界を維持すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

Ver.216の通常Browser **99件**に、お気に入り表示・操作回帰1件を追加し、Ver.217の通常Browser対象は **100件**です。Firebase Emulator専用20件は通常Browserではskipされます。

Ver.217専用回帰では以下を固定します。

1. **左ナビ・フィルター**
   - 左ナビ `data-filter="favorite"` が「お気に入り」と表示される。
   - ユーザー向け表示に「スター」が残らない。
   - 内部互換 `favoriteOnly` は「お気に入りのみ」表記へ補正される。
   - 左ナビ操作で既存 `favoriteOnly` チェック状態が正しく切り替わる。

2. **詳細操作**
   - 未登録時は「お気に入り」。
   - 登録済み時は「お気に入り解除」。
   - 詳細ボタンには `☆` / `★` / 「スター」を表示しない。
   - aria-label / title は「お気に入りに追加 / お気に入りを解除」。

3. **タスクカード操作**
   - カード上の★/☆は状態アイコンとして維持。
   - title / aria-label は「お気に入りに追加 / お気に入りを解除」へ統一。
   - 既存 `data-star-task` と保存ロジックは変更しない。

4. **操作結果**
   - 追加時toastは「お気に入りに追加しました」。
   - 解除時toastは「お気に入りから外しました」。
   - 操作後のカード・詳細表示が最新状態へ追従する。

5. **Ver.216までの回帰**
   - コメント返信スレッド・通知・リアクションを維持。
   - 狭い詳細パネルのコメントフォームは1列を維持。
   - Todayは `data-v108-hidden` + core CSS正本を維持。
   - version表示はmanifest + version-display-lockで `Ver.217` へ統一。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

Ver.217では書込モデルを変更しないため、Ver.216と同じ **20件**を維持します。

- コメント返信のstructured `replyTo` 保存。
- task revision整合性。
- 親コメントreaction維持。
- ToDo / 業務メモ / 通知 / アーカイブ等の既存Firebase書込。
- 本番Firebaseへの通信が0件。

## Ver.217で変更するもの

- `user-ux-polish-v208.js`: 「スター」表示を「お気に入り」へ統一。
- `release-manifest.js`: Ver.217へ更新してJSキャッシュを確実に更新。
- `tests/user-ux-polish-v208.spec.mjs`: 左ナビ、詳細、カード、toastのお気に入り表示回帰を追加。
- version回帰、責務台帳を更新。

## Ver.217で変更しないもの

- `app.js` の `favoriteTaskIds` 保存・お気に入りフィルター・切替処理。
- `app.js` の通常コメント保存処理。
- `comment-mentions-v191.js` のメンション候補UI。
- `comment-reactions-v191.js` の返信・リアクション処理。
- `inbox-events-v183.js` の通知処理。
- ユーザー登録。
- タスク / ToDo / スケジュール / 業務メモの既存保存処理。
- stable / mobile / date-keyboard / schedule lock / version-display-lockの製品実装。

## 復旧地点

- Ver.216 main: `4fcb7dade92bed459f577f0be8d87ab6dc914baf`
- `backup/ver216-before-favorite-labels`: Ver.217表記変更前の復旧地点。

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

Ver.217がmainでRegression / Pagesともにgreenになった後、保留していたstableのTodayデータ取得責務監査へ戻ります。
