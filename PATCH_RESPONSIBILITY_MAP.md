# パッチ責務マップ（Ver.219 基準）

## 目的

実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。古いファイル名ではなく、現在の責務とactive runtimeへの参加有無を基準に整理します。

Ver.219では動的CSS **21本**を維持し、`stable-fixes-v108.js` の退役により動的JSは **33本**になります。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215: コメント返信スレッドとcomment ID基準のリアクション紐付けを追加。
- Ver.216: コメント入力フォームの1列レイアウトを復旧。
- Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。
- Ver.218: モバイルのリアクションpickerを押したコメント位置へ戻した。
- Ver.219監査（PR #66 / #67）: stable Today後処理を無効化し、app.js候補実装だけで意味論を維持できることをBrowser回帰で確認。
- **Ver.219製品: Today意味論を `app.js` の描画経路へ正式統合し、`stable-fixes-v108.js` をactive runtimeから退役。**

## Todayの現在境界

### `app.js`

Today表示の正本です。

- 「保留」はTodayタスクDOM生成前に除外。
- mine時は `isCurrentUserOrGroupAssignee()` を使用し、現在ユーザー＋現在の共有ルーム名を共有担当として扱う。
- Today予定も同じ担当判定へ統一。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- 他roomのlocalStorage探索や固定共有担当名は使用しない。

### `stable-fixes-v108.js`

Ver.219から現行 `requiredAssets` / `dynamicScripts` には含めません。旧キャッシュmanifestとロールバック互換のため物理ファイルだけ保持します。

したがって現行runtimeでは、stable独自のroom解決、localStorage fallback、current user fallback、固定GROUP_ASSIGNEES、MutationObserver後処理、`data-v108-hidden`付与は実行されません。

### `ui-core-density-v188.css`

`#todayView [data-v108-hidden]` selectorは旧キャッシュ互換として現時点では保持します。Ver.219の現行DOMではmarkerを生成しません。次工程で、この互換selector自体を安全に退役できるか監査します。

## その他の責務

- 状態タブ表示・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`
- コメント返信・リアクション: `comment-reactions-v191.js` + `ui-comment-reactions-v191.css`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.219の安全網

- static contractでTodayの3つの意味論が `app.js` に各1か所だけ存在することを固定。
- stableが現行manifestのrequired/dynamic scriptから外れていることを固定。
- Browser回帰で通常表示、mine切替、現在ルーム担当、旧固定名担当、他担当、保留、確認待ち、Today予定を確認。
- BrowserのResource Timingで `stable-fixes-v108.js` が読み込まれていないことを確認。
- Today DOMに `data-v108-hidden` が生成されないことを確認。
- mobile / date / version等の正本所有者回帰を維持。
- stable物理ファイルは旧キャッシュ互換として保持。

## 復旧地点

- Ver.219監査main: `b5be835489360cd4417403a70f9b0943cd0e47b1`
- `backup/pr69-before-stale-stable-test-retirement`: テスト整理前の復旧地点。

## 次工程

`ui-core-density-v188.css` に残る旧 `data-v108-hidden` 互換selectorの退役可否を、製品コード無変更の監査から開始する。
