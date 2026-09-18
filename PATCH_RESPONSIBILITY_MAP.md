# パッチ責務マップ（Ver.222 基準）

## 目的

実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。古いファイル名ではなく、現在の責務とactive runtimeへの参加有無を基準に整理します。

Ver.222でも動的CSS **21本**、動的JS **33本**を維持します。今回の整理はTodayの描画責務移管であり、active asset本数・読込順・書込ロジックは変更しません。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215: コメント返信スレッドとcomment ID基準のリアクション紐付けを追加。
- Ver.216: コメント入力フォームの1列レイアウトを復旧。
- Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。
- Ver.218: モバイルのリアクションpickerを押したコメント位置へ戻した。
- Ver.219: Today意味論を `app.js` の描画経路へ正式統合し、`stable-fixes-v108.js` をactive runtimeから退役。
- Ver.220: 予定通知を左メニューへ移動しToday操作を整理。共同編集時のコメント返信も対応履歴へ原子的に記録。
- Ver.221: `ui-core-density-v188.css` の旧 `#todayView [data-v108-hidden]` compatibility selectorを正式退役。
- **Ver.222: Todayの最終DOMを `app.js` が直接生成する形へ統合し、`core-view-density-v188.js` のToday後処理とToday MutationObserverを退役。**

## Todayの現在境界

### `app.js`

Todayの意味論と最終DOMの正本です。

- 「保留」はTodayタスクDOM生成前に除外。
- mine時は `isCurrentUserOrGroupAssignee()` を使用し、現在ユーザー＋現在の共有ルーム名を共有担当として扱う。
- Today予定も同じ担当判定へ統一。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- 「確認済みにする / 区切り / スケジュールを見る / 新しいタスク」の操作列を完成形で直接描画。
- 予定通知コントロールはconnection状態直下のsidebar hostを `app.js` が描画し、権限操作も同じ正本でbindする。
- `.today-head` を一度生成して後から削除・移設する経路は持たない。

### `stable-fixes-v108.js`

Ver.219から現行 `requiredAssets` / `dynamicScripts` には含めません。旧キャッシュmanifestとロールバック互換のため物理ファイルだけ保持します。

現行runtimeではstable独自のroom解決、localStorage fallback、固定GROUP_ASSIGNEES、MutationObserver後処理、`data-v108-hidden`付与は実行されません。

### `ui-core-density-v188.css`

Ver.221で `#todayView [data-v108-hidden]` selectorを削除済みです。

Todayのレイアウト・操作列・予定通知sidebar、およびSchedule toolbarの表示スタイルを担当しますが、Todayの非表示条件やDOM生成責務は持ちません。

### `core-view-density-v188.js`

Ver.222から **Schedule表示再構成専任** です。

- Schedule toolbar / 日付 / 検索UIの再構成。
- 元のグローバル検索欄を利用するSchedule検索proxy。
- 検索時のcaret / focus復元。
- MutationObserverは `#scheduleView` のみに限定。
- 公開observer契約は `today: null, schedule: scheduleObserver` とし、Today observerは存在しない。
- Today操作ボタン移設、予定通知移設、区切り線挿入は行わない。

## その他の責務

- 状態タブ表示・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`
- コメント返信・リアクション: `comment-reactions-v191.js` + `ui-comment-reactions-v191.css`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.222の安全網

- Browser回帰で `core-view-density-v188.js` をテスト上無効化してもTodayが完成形で描画されることを確認。
- Today→Schedule→Todayの再描画後もToday後処理なしで操作列・sidebar通知が維持されることを確認。
- 通常runtimeでToday observerが `null`、Schedule observerだけがactiveであることを確認。
- Ver.220の左メニュー予定通知・Today区切り線・権限ボタン動作を維持。
- Ver.221のhidden-marker selector退役回帰を後続releaseでも維持。
- Schedule toolbar/search/date、フォーカス復元、モバイル表示は今回変更しない。
- stableは現行manifestから外れたままで、物理ファイルだけ保持。
- Protocol / Browser / Firebase Emulator全件を維持する。

## 復旧地点

- Ver.221正式main: `89e0cafedf1e25ec9b04bf76833ee1430768cd04`
- core-view-density責務監査後main: `b99b3b162d58c93cacb8377317aedc4e6ac68aef`
- Ver.222製品化開始前: `backup/ver221-after-core-view-density-audit`

## 次工程

`core-view-density-v188.js` に残るSchedule toolbar/search proxy・フォーカス復元の責務を、まず製品コード無変更で監査します。

特にSchedule検索欄は `#searchInput` を代理して再描画時にfocus/caretを復元しているため、Todayと同じ方法で一括統合せず、`renderScheduleView()` へ正本化した場合の検索・再描画・モバイル挙動を先に固定します。
