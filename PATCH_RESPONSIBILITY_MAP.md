# パッチ責務マップ（Ver.224 基準）

## 目的

実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。古いファイル名ではなく、現在の責務とactive runtimeへの参加有無を基準に整理します。

Ver.224では動的CSS **21本**、動的JS **32本**です。Ver.223でno-op互換shellになった `core-view-density-v188.js` をactive manifestから正式退役し、物理ファイルだけを旧キャッシュmanifest / ロールバック互換のため保持します。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215〜218: コメント返信・リアクション・お気に入り表記・モバイルpickerを整理。
- Ver.219: Today意味論を `app.js` へ正式統合し `stable-fixes-v108.js` をactive runtimeから退役。
- Ver.220: 予定通知を左メニューへ移動しToday操作を整理。共同編集時のコメント返信も対応履歴へ原子的に記録。
- Ver.221: `ui-core-density-v188.css` の旧 `#todayView [data-v108-hidden]` compatibility selectorを正式退役。
- Ver.222: Today最終DOMを `app.js` が直接生成する形へ統合し、Today DOM後処理とToday MutationObserverを退役。
- Ver.223: Schedule最終toolbar/date/search DOMも `app.js` が直接生成する形へ統合し、Schedule DOM後処理とSchedule MutationObserverを退役。
- **Ver.224: 監査PR #77でsidecar未読込でもToday/Scheduleが成立することを確認し、`core-view-density-v188.js` をrequired/dynamic manifestから正式退役。**

## Today / Scheduleの現在境界

### `app.js`

TodayとScheduleの意味論・最終DOMの正本です。

- Todayでは「保留」をDOM生成前に除外し、mine時は現在ユーザー＋現在共有ルーム名を担当として扱う。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- Today操作列と予定通知sidebarを完成形で直接描画する。
- Scheduleでは `.schedule-toolbar-v176` / controls / utility、日付、検索proxyを直接描画する。
- Schedule検索値の正本は既存 `#searchInput`。表示proxyだけを再描画し、focus/caretも `app.js` が復元する。
- range / move / mode / 新規予定handlerも `app.js` が所有する。

### `ui-core-density-v188.css`

activeの表示スタイル正本です。

- Today操作列・予定通知sidebar・Schedule toolbarの表示スタイルを担当。
- Today/Scheduleの意味論、DOM生成、保存処理は持たない。
- Ver.221で旧 `#todayView [data-v108-hidden]` selectorは退役済み。

### `core-view-density-v188.js`

Ver.224から **active runtime退役済み** です。

- `requiredAssets` / `dynamicScripts` に含めない。
- 現行ブラウザではHTTP requestされず、`window.__WB_CORE_VIEW_DENSITY_V188__` も生成されない。
- 物理ファイルは旧キャッシュmanifest / ロールバック互換のため保持する。
- 退役前の最終内容もDOM変更・MutationObserverを持たないno-op shellである。

### `stable-fixes-v108.js`

Ver.219からactive runtime退役済みです。こちらも旧キャッシュmanifest / ロールバック互換のため物理ファイルだけ保持します。

## その他の責務

- 状態タブ表示・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule Today固定anchor / `7日間` 表記: `schedule-today-lock-v129.js`
- version表示: `release-manifest.js` + `version-display-lock.js`
- コメント返信・リアクション: `comment-reactions-v191.js` + `ui-comment-reactions-v191.css`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.224の安全網

- 実manifestに `core-view-density-v188.js` がrequired/dynamicのどちらにも存在しないことをstatic contract化。
- 物理ファイルがキャッシュ互換用に残ることを確認。
- BrowserでsidecarへのHTTP requestが0件、公開APIが未定義であることを確認。
- sidecarなしでToday操作列・予定通知sidebar、Schedule toolbar/date/searchが成立することを確認。
- Schedule検索proxy、focus/caret、7日間切替、calendar切替を維持。
- 390pxモバイルで横overflowしないことを維持。
- Protocol / Browser / Firebase Emulator全件を維持する。

## 復旧地点

- Ver.223正式main: `d524ecf13a137e97da2721c136fe80a234fe16dc`
- sidecar退役監査main: `211213907982f183329d34a4916392b6c435d82d`
- Ver.224製品化前: `backup/ver223-after-core-density-retirement-audit`

## 次工程

次の整理候補は `schedule-today-lock-v129.js` です。Ver.224では変更せず、まず製品コード無変更の監査で、Today表示時の前後移動抑止、today anchor復元、`7日間` 表記、pageshow / focus / visibility / 日跨ぎ補正を `app.js` へ正本統合できるか確認します。
