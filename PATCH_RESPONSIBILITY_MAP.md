# パッチ責務マップ（Ver.218 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.218でも変更していません。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215: タスク詳細コメントへ返信スレッドを追加。リアクション紐付けをcomment ID正本へ強化。
- Ver.216: コメント入力フォームの暗黙grid列生成を修正し、詳細パネル内の1列レイアウトを復旧。
- Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。
- **Ver.218: モバイルのリアクションpickerをviewport固定から、押したコメントのreaction rowに紐づくabsolute配置へ戻した。**

## コメント機能の現在境界

### `comment-reactions-v191.js`

- リアクション候補、reaction transaction、comment ID紐付けを所有。
- `replyTo` による1階層返信スレッドを所有。
- Remote返信はRTDB transaction、local-only返信は既存 `app.js` コメント保存経路を再利用。
- **Ver.218ではJavaScript保存処理を変更しない。**

### `ui-comment-reactions-v191.css`

- リアクションUIと返信スレッドpresentationを所有。
- PC / モバイルとも `.comment-reaction-picker-v165` は `.comment-reactions-v165` を基準にした `position:absolute` を正本とする。
- モバイルではタップ領域を46pxに拡大するが、`position:fixed` / viewport bottom固定は使用しない。
- これにより、長いコメント一覧の下方で「＋ リアクション」を押しても、そのコメントの直上にpickerが表示される。
- pickerの最大幅はviewport内に収め、横スクロールを発生させない。

### `ui-task-detail-responsive-v192.css`

- コメント入力フォームの1列レイアウト正本。
- Ver.218では変更しない。

### `inbox-events-v183.js`

- コメント、メンション、返信先投稿者への通知を所有。
- Ver.218では変更しない。

## お気に入り表示の現在境界

Ver.217の責務をそのまま維持します。

- データ・保存・filter正本: `app.js`
- ユーザー向け「お気に入り」表示補正: `user-ux-polish-v208.js`
- 詳細ボタンに☆/★装飾は表示しない。
- カード上の★/☆状態アイコンは維持する。

## Today / stableの現在境界

Ver.218ではVer.214以降の基盤整理を変更しません。

- Today意味論と `data-v108-hidden`: `stable-fixes-v108.js`
- Today最終非表示presentation: `ui-core-density-v188.css`
- 状態タブ表示・保護・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`

## Ver.218の安全網

- static contractで、モバイルpickerに `position:fixed` / `bottom:14px` が戻らないことを固定。
- Browser回帰で、下方コメントの「＋ リアクション」を押した際、pickerが同一コメントのreaction row所有で `position:absolute` になり、ボタン近傍に表示されることを固定。
- picker表示でページ位置が不意に先頭へ戻らないことを固定。
- 横スクロールが発生しないことを固定。
- Ver.217までのお気に入り表示、Ver.216までのコメント入力1列、Ver.215までの返信・reaction transactionを維持。
- Firebase Emulator対象は **20件**を維持。
- dynamic CSS **21本** / dynamic JS **34本**とロード順は変更しない。

## Ver.218で変更しないもの

- `comment-reactions-v191.js` のreaction保存・返信保存。
- `app.js` の通常コメント、お気に入り、タスク保存処理。
- `comment-mentions-v191.js` のメンションUI。
- `inbox-events-v183.js` の通知処理。
- タスク / ToDo / スケジュール / 業務メモの保存経路。
- Today / mobile status tabs / date / schedule / version lockの製品実装。

## 復旧地点

- Ver.217 main: `3e8cc4f38ff346f733d003da37db078352ff9a7e`
- `backup/ver217-before-mobile-reaction-anchor`: Ver.218改修前の復旧地点。

## 次工程

Ver.218をmainで正式確定した後、保留していたstableのTodayデータ取得責務（room解決 / localStorage fallback / current user解決 / group担当判定）の重複監査へ戻る。
