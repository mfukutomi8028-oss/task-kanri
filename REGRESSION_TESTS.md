# 回帰テスト基盤（Ver.215）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.215では、タスク詳細のコメントへ返信機能を追加します。単なるインデント表示ではなく、`replyTo` を持つコメントを親コメント単位で1階層へ整理し、既存リアクション・メンション・通知・local-only運用と共存させます。

## CIで確認する範囲

### 構造・契約

- release versionが **215** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **34本**とロード順を維持すること。
- `comment-reactions-v191.js` がreaction + reply interactionを所有すること。
- reply Remote保存が `replyTo` を構造化フィールドとして持つこと。
- Remote返信はtask revisionを1増加すること。
- local-only返信は既存appコメント保存経路を再利用すること。
- リアクションはcomment ID基準でDOMへ紐付くこと。
- スレッド・返信操作・引用・返信中UIが署名差分時だけ更新され、MutationObserver再描画ループを作らないこと。
- `inbox-events-v183.js` が返信先投稿者を通知対象に追加すること。
- 返信通知本文へlocal-only互換markerを露出しないこと。
- Ver.214までのToday / date / mobile / schedule / version境界を維持すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

Ver.214の通常Browser **95件**に、Ver.215コメント返信3件を追加し、通常Browser対象は **98件**です。Firebase Emulator専用20件は通常Browserではskipされます。

Ver.215専用回帰では以下を固定します。

1. **スレッド表示**
   - 親コメントの直下へ返信を表示。
   - 返信への返信もルートの返信群へまとめ、深い入れ子を作らない。
   - 返信元投稿者と本文プレビューを引用表示。
   - 親コメントへ返信件数を表示。

2. **返信操作**
   - 各コメントに「↩ 返信」を表示。
   - 返信開始時に返信先バナーを表示。
   - ×またはEscで返信をキャンセル。
   - `Ctrl / ⌘ + Enter` で送信。
   - 通常コメントフォームは返信していない時の既存挙動を維持。

3. **local-only互換**
   - 既存 `app.js` のコメント保存経路を利用して返信を保存。
   - 内部互換markerは画面表示から除去。
   - 保存後に正しい親スレッドへ表示。

4. **リアクション共存**
   - DOM並びがスレッド化で変わっても、👍等はcomment IDで正しいコメントへ残る。
   - 親コメントのreactionが返信追加で別コメントへ移らない。

5. **モバイルUI**
   - 430px幅で返信群を適度にインデント。
   - ページ横スクロールを発生させない。
   - 返信ボタンは36px以上のタップ高さ。
   - 返信中バナーが画面幅内へ収まる。

6. **Ver.214までの回帰**
   - Todayは `data-v108-hidden` + core CSS正本を維持。
   - stable style/native hiddenは復活しない。
   - version表示はmanifest + version-display-lockで `Ver.215` へ統一。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

従来 **19件**に返信保存1件を追加し、Ver.215では **20件**です。

返信E2Eでは以下を確認します。

- 親comment IDを `replyTo` へ保存。
- author / type / text / createdAtを保存。
- task revisionが **7 → 8** の1回だけ増える。
- 親コメントの既存リアクションを維持。
- 保存後のUIで返信が親スレッド下へ表示。
- 本番Firebaseへの通信が0件。

## 通知

`inbox-events-v183.js` はVer.215で返信を認識します。

- 担当者への通常コメント通知を維持。
- `@メンション` 通知を維持。
- 返信先コメントの投稿者を通知対象へ追加。
- 同一受信者の重複通知を抑止。
- 通知本文には返信本文だけを表示し、local-only互換markerは表示しない。

## Ver.215で変更するもの

- `comment-reactions-v191.js`: reaction + reply interactionへ拡張。
- `ui-comment-reactions-v191.css`: threaded reply presentationを追加。
- `inbox-events-v183.js`: 返信先投稿者通知を追加。
- `release-manifest.js`: Ver.215へ更新。
- コメント返信Browser / Firebase Emulator E2Eを追加。
- user/comments static contract、version回帰、責務台帳を更新。

## Ver.215で変更しないもの

- `app.js` の通常コメント保存処理。
- `comment-mentions-v191.js` のメンション候補UI。
- ユーザー登録。
- タスク / ToDo / スケジュール / 業務メモの既存保存処理。
- stable / mobile / date-keyboard / schedule lock / version-display-lockの製品実装。

## 復旧地点

- Ver.214 main: `e0a2583dcff340f1bbe4313f643b919dbec634f3`
- `backup/ver214-before-comment-replies`: Ver.215機能追加前の復旧地点。

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

Ver.215がmainでRegression / Pagesともにgreenになった後、保留していたstableのTodayデータ取得責務監査へ戻ります。