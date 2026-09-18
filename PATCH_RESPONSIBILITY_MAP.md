# パッチ責務マップ（Ver.221 基準）

## 目的

実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。古いファイル名ではなく、現在の責務とactive runtimeへの参加有無を基準に整理します。

Ver.221では動的CSS **21本**、動的JS **33本**を維持します。今回の整理はCSS selector 1件の退役であり、active asset本数・読込順・書込ロジックは変更しません。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215: コメント返信スレッドとcomment ID基準のリアクション紐付けを追加。
- Ver.216: コメント入力フォームの1列レイアウトを復旧。
- Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。
- Ver.218: モバイルのリアクションpickerを押したコメント位置へ戻した。
- Ver.219: Today意味論を `app.js` の描画経路へ正式統合し、`stable-fixes-v108.js` をactive runtimeから退役。
- Ver.220: 予定通知を左メニューへ移動しToday操作を整理。共同編集時のコメント返信も対応履歴へ原子的に記録。
- **Ver.221: `ui-core-density-v188.css` の旧 `#todayView [data-v108-hidden]` compatibility selectorを正式退役。**

## Todayの現在境界

### `app.js`

Today表示の意味論の正本です。

- 「保留」はTodayタスクDOM生成前に除外。
- mine時は `isCurrentUserOrGroupAssignee()` を使用し、現在ユーザー＋現在の共有ルーム名を共有担当として扱う。
- Today予定も同じ担当判定へ統一。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- 他roomのlocalStorage探索や固定共有担当名は使用しない。

### `stable-fixes-v108.js`

Ver.219から現行 `requiredAssets` / `dynamicScripts` には含めません。旧キャッシュmanifestとロールバック互換のため物理ファイルだけ保持します。

現行runtimeではstable独自のroom解決、localStorage fallback、固定GROUP_ASSIGNEES、MutationObserver後処理、`data-v108-hidden`付与は実行されません。

### `ui-core-density-v188.css`

Ver.221で `#todayView [data-v108-hidden]` selectorを削除しました。

したがって現行Todayでは、対象を一度DOM生成してCSSで隠す経路は持ちません。非表示条件は `app.js` の描画条件で決まり、CSSはレイアウト・表示だけを担当します。

### `core-view-density-v188.js`

Today/Scheduleの表示再構成を担当します。

- Today操作ボタンのcompact化。
- Ver.220の予定通知コントロールをconnection状態直下へ移動。
- 「確認済みにする」と「スケジュールを見る」の間の区切り要素。
- Schedule toolbar / 日付 / 検索UIの再構成。
- Observerは `#todayView` と `#scheduleView` に限定し、`document.body` 全体監視は行わない。

## その他の責務

- 状態タブ表示・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`
- コメント返信・リアクション: `comment-reactions-v191.js` + `ui-comment-reactions-v191.css`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.221の安全網

- static contractで現行 `ui-core-density-v188.css` に `data-v108-hidden` が存在しないことを固定。
- Browser回帰で配信後のCSSOMにも旧selectorが存在しないことを確認。
- Todayの通常表示、mine切替、現在ルーム担当、旧固定名担当、他担当、保留、確認待ちを再確認。
- Ver.220の左メニュー予定通知とToday区切り線を維持。
- mobile Schedule toolbar/searchと横overflowなしを維持。
- stableが現行manifestから外れたままで、物理ファイルだけ残ることを維持。
- Protocol / Browser / Firebase Emulator全件を維持する。

## 復旧地点

- Ver.220正式main: `8b71dfba6dddc2292365d31f6e87177639c2ebc7`
- Ver.221整理開始前: `backup/ver220-before-v108-hidden-css-retirement`

## 次工程

`core-view-density-v188.js` に残るToday/ScheduleのDOM再構成とfeature-scoped Observerを製品コード無変更の監査から確認します。

目的は、`app.js` に統合すべき意味論と、独立した表示補助として残すべき責務を混同しないことです。特にVer.220で追加した予定通知移動・区切り線を壊さないことを前提に進めます。
