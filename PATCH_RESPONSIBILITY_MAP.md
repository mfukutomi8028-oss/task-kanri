# パッチ責務マップ（Ver.223 基準）

## 目的

実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。古いファイル名ではなく、現在の責務とactive runtimeへの参加有無を基準に整理します。

Ver.223でも動的CSS **21本**、動的JS **33本**を維持します。今回の整理はScheduleの描画責務移管であり、active asset本数・読込順・保存モデルは変更しません。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215〜218: コメント返信・リアクション・お気に入り表記・モバイルpickerを整理。
- Ver.219: Today意味論を `app.js` へ正式統合し `stable-fixes-v108.js` をactive runtimeから退役。
- Ver.220: 予定通知を左メニューへ移動しToday操作を整理。共同編集時のコメント返信も対応履歴へ原子的に記録。
- Ver.221: `ui-core-density-v188.css` の旧 `#todayView [data-v108-hidden]` compatibility selectorを正式退役。
- Ver.222: Today最終DOMを `app.js` が直接生成する形へ統合し、Today DOM後処理とToday MutationObserverを退役。
- **Ver.223: Schedule最終toolbar/date/search DOMも `app.js` が直接生成する形へ統合し、Schedule DOM後処理とSchedule MutationObserverを退役。**

## Todayの現在境界

### `app.js`

Todayの意味論と最終DOMの正本です。

- 「保留」はTodayタスクDOM生成前に除外。
- mine時は `isCurrentUserOrGroupAssignee()` で現在ユーザー＋現在共有ルーム名を共有担当として扱う。
- Today予定も同じ担当判定へ統一。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- 「確認済みにする / 区切り / スケジュールを見る / 新しいタスク」を完成形で直接描画。
- 予定通知コントロールはconnection状態直下のsidebar hostを直接描画・bindする。

### `stable-fixes-v108.js`

Ver.219から現行 `requiredAssets` / `dynamicScripts` には含めません。旧キャッシュmanifestとロールバック互換のため物理ファイルだけ保持します。

### `ui-core-density-v188.css`

Ver.221で旧 `#todayView [data-v108-hidden]` selectorを削除済みです。Today操作列とSchedule toolbarの表示スタイルのみを担当し、意味論やDOM生成責務を持ちません。

## Scheduleの現在境界

### `app.js`

Ver.223からScheduleのデータ処理だけでなく最終表示DOMも正本です。

- `renderScheduleView()` が `.schedule-toolbar-v176` / `.schedule-toolbar-controls-v176` / `.schedule-toolbar-utility-v176` を直接描画。
- 日付は `.schedule-date-v176` として直接描画。
- Schedule専用検索欄 `.schedule-search-v176` を直接描画。
- 検索値の正本は既存 `#searchInput` のまま。Schedule検索欄はproxyとして値とinput eventを同期する。
- 検索による同期render後、requestAnimationFrameで新しい検索欄へfocus/caretを復元する。
- 表示期間、表示日移動、表示形式、新規予定handlerは従来どおり `app.js` 所有。
- range/mode切替やデータ再描画のたびに完成形DOMを直接再生成するため、Schedule MutationObserverを必要としない。

### `core-view-density-v188.js`

Ver.223では **no-op互換shell** です。

- Today/ScheduleいずれのDOM再構成も行わない。
- MutationObserverを持たない。
- `patchAll()` は互換用no-op。
- 公開observer契約は `today: null, schedule: null`。
- 現行manifestには1リリース残し、次工程でファイル自体のactive退役可否を監査する。

## その他の責務

- 状態タブ表示・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`
- コメント返信・リアクション: `comment-reactions-v191.js` + `ui-comment-reactions-v191.css`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.223の安全網

- `core-view-density-v188.js` をテスト上無効化してもToday/Schedule双方が完成形で描画されることを確認。
- Schedule検索欄が `#searchInput` に同期し実際の予定フィルタへ反映されることを確認。
- 検索後のfocus/caret復元を確認。
- range/mode切替後もObserverなしでtoolbar/search/dateと検索値が維持されることを確認。
- 通常runtimeでToday/Schedule observerが双方 `null` であることを確認。
- Ver.220予定通知・返信履歴、Ver.221 hidden-marker selector退役、Ver.222 Today正本化を維持。
- Protocol / Browser / Firebase Emulator全件を維持する。

## 復旧地点

- Ver.222正式main: `39ed52d1dfc8014d98f1f6cfea9d008bfff505ca`
- Schedule責務監査main: `4b4e29f37b2f674f2c1608f65b1d8c4135b2b30d`
- Ver.223製品化開始前: `backup/ver222-schedule-audit-main-before-v223-product`

## 次工程

`core-view-density-v188.js` はVer.223でno-op互換shellになったため、次はこのファイルを `requiredAssets` / `dynamicScripts` から完全に外せるかを製品コード無変更で監査します。物理ファイルは旧キャッシュmanifest / ロールバック互換のため当面保持します。
