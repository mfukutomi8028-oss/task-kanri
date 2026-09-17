# パッチ責務マップ（Ver.215 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.215でも変更していません。

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
- **Ver.215: タスク詳細コメントへ返信スレッドを追加。リアクション紐付けをcomment ID正本へ強化し、返信先通知・ショートカット・モバイルUIを追加。**

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

### `ui-comment-reactions-v191.css`

- リアクションUIに加え、Ver.215から返信スレッドpresentationも所有。
- 返信は左ライン＋インデントで親子関係を可視化。
- モバイルではインデントを縮小し、返信ボタンを36px以上のタップ領域にする。

### `inbox-events-v183.js`

- 通常コメントの担当者通知を維持。
- `@メンション` 通知を維持。
- Ver.215から返信先コメントの投稿者も通知対象へ追加。
- 同一人物が担当者・メンション・返信先を兼ねる場合はSetで重複通知を防止。
- local-only互換markerは通知本文から除去する。

## Today / stableの現在境界

Ver.215ではVer.214の基盤整理を変更しません。

- Today意味論と `data-v108-hidden`: `stable-fixes-v108.js`。
- Today最終非表示presentation: `ui-core-density-v188.css`。
- native `hidden` はstableから退役済み。
- 状態タブ表示・保護・横スクロール: `mobile-fixes.js`。
- native日付制約・segmented入力: `date-keyboard-fix-v127.js`。
- schedule `7日間`: `schedule-today-lock-v129.js`。
- version表示: `release-manifest.js` + `version-display-lock.js`。

## Ver.215の安全網

- Browserでスレッド構造、返信への返信の1階層化、引用表示、返信件数、返信キャンセル、local-only保存、comment ID基準リアクションを固定。
- 430px幅で返信インデント、横はみ出しなし、36px以上の返信操作を確認。
- Firebase Emulatorでstructured `replyTo` 保存、revision +1、親リアクション維持、UI反映を確認。
- Firebase Emulator対象は従来19件 + 返信1件 = **20件**。
- 返信先投稿者通知の静的契約を追加。
- dynamic CSS **21本** / dynamic JS **34本**とロード順は変更しない。

## Ver.215で変更しないもの

- `app.js` の通常コメント保存処理。
- ユーザー登録・メンション候補の既存仕様。
- タスク / ToDo / スケジュール / 業務メモの既存保存経路。
- Today意味論とstable基盤責務。
- 状態タブ、日付入力、schedule label、version lock。

## 主な復旧地点

- `backup/ver213-before-native-hidden-audit`: `527b88042c69d0c326325d8e66510011f3f0953b`
- `backup/ver213-with-native-hidden-audit`: `43d96f8f6f44d5b13cea441813bf835c0e340338`
- Ver.214 main: `e0a2583dcff340f1bbe4313f643b919dbec634f3`
- `backup/ver214-before-comment-replies`: Ver.214 mainから作成済み。

## 次工程

Ver.215をmainで正式確定した後、保留していたstableのTodayデータ取得責務（room解決 / localStorage fallback / current user解決 / group担当判定）の重複監査へ戻る。コメント返信の追加改修とcleanup工程は混在させない。