# 回帰テスト基盤（Ver.218）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.218では、スマホ版コメントのリアクションpickerをviewport固定から**押したコメント位置に紐づくアンカー表示**へ修正します。reaction保存・返信保存・通知等のデータ処理は変更しません。

## CIで確認する範囲

### 構造・契約

- release versionが **218** であること。
- `release-manifest.js` の必須資産、重複、動的資産の存在確認。
- `patch-responsibilities.json` とactive CSS/JSの1対1対応。
- dynamic CSS **21本** / dynamic JS **34本**とロード順を維持すること。
- `.comment-reaction-picker-v165` の正本が `position:absolute` であること。
- モバイルmedia queryがpickerを `position:fixed` やviewport bottom固定へ戻さないこと。
- Ver.217のお気に入り表示契約、Ver.216のコメント入力1列契約、Ver.215の返信・reaction transaction契約を維持すること。
- Ver.214までのToday / date / mobile / schedule / version境界を維持すること。
- ルートJavaScriptの構文確認。
- GitHub Pages deployment workflowが1本だけであること。

### 通常ブラウザ回帰

Ver.217の通常Browser **100件**に、モバイルリアクション位置回帰1件を追加し、Ver.218の通常Browser対象は **101件**です。Firebase Emulator専用20件は通常Browserではskipされます。

Ver.218専用回帰では以下を固定します。

1. **下方コメントからのリアクション操作**
   - 430px幅のモバイル環境で複数コメントを用意する。
   - 一覧下方のコメントまでスクロールし、そのコメントの「＋ リアクション」を押す。
   - pickerが同じコメントの `.comment-reactions-v165` 配下に存在する。
   - computed styleが `position:absolute` である。
   - pickerが押したボタン近傍に表示される。

2. **スクロール・viewport安全性**
   - picker表示のためにページ先頭へ戻らない。
   - pickerがviewport右端からはみ出さない。
   - document横スクロールを発生させない。

3. **既存コメント機能**
   - reaction chipとcomment IDの紐付けを維持。
   - 返信スレッド、返信件数、返信元表示を維持。
   - コメント入力フォームの1列表示を維持。

4. **既存UI**
   - 「お気に入り」表記を維持。
   - Todayは `data-v108-hidden` + core CSS正本を維持。
   - version表示はmanifest + version-display-lockで `Ver.218` へ統一。

## Firebase Emulator E2E

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番 `firebaseio.com` / `firebasedatabase.app` への通信は遮断します。

Ver.218では書込モデルを変更しないため、Ver.217と同じ **20件**を維持します。

- コメント返信のstructured `replyTo` 保存。
- reaction transactionとtask revision整合性。
- 親コメントreaction維持。
- ToDo / 業務メモ / 通知 / アーカイブ等の既存Firebase書込。
- 本番Firebaseへの通信が0件。

## Ver.218で変更するもの

- `ui-comment-reactions-v191.css`: モバイルpickerのviewport固定を退役し、コメントreaction row基準のabsolute配置へ統一。
- `tests/mobile-comment-reaction-anchor-v218.spec.mjs`: 下方コメントからのリアクション位置回帰を追加。
- static contract、release version、責務台帳、version監査を更新。

## Ver.218で変更しないもの

- `comment-reactions-v191.js` のreaction保存・返信保存処理。
- `app.js` の通常コメント保存処理。
- `comment-mentions-v191.js` のメンション候補UI。
- `inbox-events-v183.js` の通知処理。
- お気に入り保存・フィルター処理。
- ユーザー登録。
- タスク / ToDo / スケジュール / 業務メモの既存保存処理。
- stable / mobile status tab / date-keyboard / schedule lock / version-display-lockの製品実装。

## 復旧地点

- Ver.217 main: `3e8cc4f38ff346f733d003da37db078352ff9a7e`
- `backup/ver217-before-mobile-reaction-anchor`: Ver.218改修前の復旧地点。

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

Ver.218がmainでRegression / Pagesともにgreenになった後、保留していたstableのTodayデータ取得責務監査へ戻ります。
