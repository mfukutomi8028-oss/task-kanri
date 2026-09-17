# パッチ責務マップ（Ver.217 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.217でも変更していません。

## 基盤整理の到達点

- Ver.194: release versionをmanifest正本へ統一。
- Ver.196: schedule `7日間` ラベルをschedule lockへ移管。
- Ver.197〜199: 基本状態削除保護を `app.js` へ統一。
- Ver.200: mobile側native date制約を退役。
- Ver.201〜202: Today意味論をstableへ集約。
- Ver.203: scheduleラベルをschedule lock単独所有へ整理。
- Ver.204〜205: 状態タブ横スクロール・通常表示をmobile所有へ整理。
- Ver.206〜211: broad MutationObserverとfull pass triggerを段階退役し、stableをToday専用更新へ縮小。
- Ver.212: stableのversion表示責務を退役。
- Ver.213: stableのstyle注入を退役。Today最終非表示CSSを `ui-core-density-v188.css`、状態タブ保護を `mobile-fixes.js` へ移管。
- Ver.214: native `hidden` 書込2か所を退役。Today表示制御を `data-v108-hidden` + core CSSへ一本化。
- Ver.215: タスク詳細コメントへ返信スレッドを追加。リアクション紐付けをcomment ID正本へ強化し、返信先通知・ショートカット・モバイルUIを追加。
- Ver.216: 返信追加時の送信ヒントCSSが詳細パネルの1列フォームへ暗黙列を生成する競合を修正。コメント入力UIを再び1列正本へ固定。
- **Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。詳細ボタンの☆/★装飾を削除し、保存モデルは維持。**

## お気に入り表示の現在境界

### `app.js`

お気に入り機能のデータ・操作正本は引き続き `app.js` です。

- `favoriteTaskIds` の保持・保存。
- `[data-star-task]` によるカード上の★/☆状態切替。
- `favoriteOnly` と左ナビ `data-filter="favorite"` の絞り込み状態。
- 詳細画面の `data-action="favorite"` 操作。

Ver.217ではこの保存・フィルター・操作ロジックを変更しません。

### `user-ux-polish-v208.js`

Ver.217からユーザー向けお気に入り表記の補正責務を追加します。

- 左ナビ表示を「お気に入り」へ統一。
- 非表示互換フィルター表示を「お気に入りのみ」へ統一。
- 詳細操作は未登録時「お気に入り」、登録済み時「お気に入り解除」。
- 詳細操作の先頭にあった `☆` / `★` は削除。
- タスクカード上の★/☆状態アイコン自体は維持し、title / aria-label を「お気に入りに追加 / お気に入りを解除」へ変更。
- 操作後toastを「お気に入りに追加しました / お気に入りから外しました」へ変更。
- `favoriteTaskIds`、localStorage、Firebase等の保存責務は持たない。

## コメント機能の現在境界

### `comments-tabs-v149.js`

- タスク詳細を「詳細 / コメント / 履歴」へ分割。
- 既存コメントフォームとコメント一覧をコメントタブへ配置。

### `comment-mentions-v191.js`

- `@` メンション候補UIを所有。
- Firebase書込は行わない。

### `comment-reactions-v191.js`

Ver.215からコメント対話UIの正本です。

- 既存リアクション（👍 / ✅ / 👀 / 🙏 / 🎉）。
- DOMとcommentの紐付けは**配列indexではなくcomment ID**を使用。
- `replyTo` による返信関係を解釈。
- 親コメント + 返信一覧の1階層スレッドUIを構築。
- 返信への返信もルートスレッドへまとめ、深い入れ子を作らない。
- 返信元の投稿者・本文プレビューを引用表示。
- 返信件数を親コメントへ表示。
- 返信中バナー、キャンセル、Escキャンセル。
- `Ctrl / ⌘ + Enter` で送信。
- Remote時はRTDB transactionで返信を追加し、task revisionを1増加。
- local-only時は既存 `app.js` のコメント保存経路を互換markerで再利用。
- スレッド構造・返信操作・引用・返信中バナーは署名差分時のみDOM更新し、MutationObserver再描画ループを防止。

### `ui-task-detail-responsive-v192.css`

- タスク詳細パネルは幅が狭いため、コメントフォームを**常時1列**にする正本。
- select / mention / textarea / submitを詳細パネル幅いっぱいに収める。

### `ui-comment-reactions-v191.css`

- リアクションUIと返信スレッドpresentationを所有。
- `.comment-submit-hint-v215` を `grid-column: 1 / -1` に固定し、詳細パネルの1列レイアウトへ従属させる。
- 返信は左ライン＋インデントで親子関係を可視化。
- モバイルではインデントを縮小し、返信ボタンを36px以上のタップ領域にする。

### `inbox-events-v183.js`

- 通常コメントの担当者通知を維持。
- `@メンション` 通知を維持。
- 返信先コメントの投稿者も通知対象。
- 同一人物が担当者・メンション・返信先を兼ねる場合はSetで重複通知を防止。
- local-only互換markerは通知本文から除去する。

## Today / stableの現在境界

Ver.217ではVer.214以降の基盤整理を変更しません。

- Today意味論と `data-v108-hidden`: `stable-fixes-v108.js`。
- Today最終非表示presentation: `ui-core-density-v188.css`。
- native `hidden` はstableから退役済み。
- 状態タブ表示・保護・横スクロール: `mobile-fixes.js`。
- native日付制約・segmented入力: `date-keyboard-fix-v127.js`。
- schedule `7日間`: `schedule-today-lock-v129.js`。
- version表示: `release-manifest.js` + `version-display-lock.js`。

## Ver.217の安全網

- 左ナビが「お気に入り」と表示され、内部 `favoriteOnly` フィルター連動を維持することをBrowser回帰で固定。
- 詳細操作が `お気に入り / お気に入り解除` となり、☆/★・「スター」文字を含まないことを固定。
- タスクカード★/☆操作のtitle / aria-labelが「お気に入り」表記であることを固定。
- お気に入り追加・解除後toastが「お気に入り」表記であることを固定。
- `user-ux-polish-v208.js` が `favoriteTaskIds` の保存責務を持たないことをstatic contractで固定。
- Ver.216までのコメント返信・1列コメント入力回帰を維持。
- Firebase Emulator対象は **20件**を維持。
- dynamic CSS **21本** / dynamic JS **34本**とロード順は変更しない。

## Ver.217で変更しないもの

- `app.js` のお気に入り保存・フィルター・切替ロジック。
- `app.js` の通常コメント保存処理。
- `comment-mentions-v191.js` のメンション候補UI。
- `comment-reactions-v191.js` の返信保存・リアクション処理。
- `inbox-events-v183.js` の通知処理。
- タスク / ToDo / スケジュール / 業務メモの既存保存経路。
- Today意味論とstable基盤責務。
- 状態タブ、日付入力、schedule label、version lockの製品実装。

## 主な復旧地点

- Ver.215 main: `cefaac7dcf4250febdf6ea6b746cf592eee0e6b1`
- Ver.216 main: `4fcb7dade92bed459f577f0be8d87ab6dc914baf`
- `backup/ver216-before-favorite-labels`: Ver.217お気に入り表記変更前の復旧地点。

## 次工程

Ver.217をmainで正式確定した後、保留していたstableのTodayデータ取得責務（room解決 / localStorage fallback / current user解決 / group担当判定）の重複監査へ戻る。お気に入り表示改修とcleanup工程は混在させない。
