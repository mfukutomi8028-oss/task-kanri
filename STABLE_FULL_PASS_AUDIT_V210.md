# stable full `applyFixes()` 発火経路監査と製品反映（Ver.210）

## 目的

Ver.209でnative date / datetime-local制約と `#taskForm` Observerを `stable-fixes-v108.js` から退役し、日付入力を `date-keyboard-fix-v127.js` の単独所有へ整理した。

その後stableに残った `applyFixes()` の責務は次の3つである。

1. `installStyle()` — stable固有の状態タブ保護CSSとToday最終非表示CSSを注入
2. `applyTodayFilters()` — Todayの状態除外とmine/group担当者判定
3. `setVersion()` — manifest版を旧 `.app-version` hookへ反映

Ver.210では、起動後にこれら3責務をまとめて再実行していた経路のうち、Today条件と直接関係しないものを安全網先行で監査し、green確認後に製品から退役した。

## 監査対象

次の6経路をPlaywright内だけで一時的に無効化した。

- `.work-mobile-status-tab` click
- `resize`
- `orientationchange`
- `pageshow`
- 起動後300ms timer
- 起動後1200ms timer

初期起動、`.nav-filter[data-filter="mine"]` / `.nav-item[data-layout]` click、`#currentUserSelect` / `#startupUser` changeは本監査では維持した。

## 監査結果

PR #52の監査で以下を確認した。

- 遅延timerなしでもstable styleが初期注入される。
- resize / orientationchange / pageshowでstable full passを実行しなくてもUIが維持される。
- version表示は `version-display-lock.js` の `.workboard-version-display` hookでVer.209を維持できる。
- タスク画面へのnav遷移は従来どおりfull passを維持する。
- mobile状態タブclickはstable full passなしでもactiveタブと `aria-pressed` が正しく切り替わる。
- `#todayView` へのカード追加はscoped Today Observerだけで `保留`、空き時間の`確認待ち`、mine他担当、group担当の最終可視性を正しく反映する。
- その後viewport/pageshowイベントを発火してもToday最終可視性は崩れない。

監査CI #200は **Protocol / Browser / Firebase Emulatorすべてsuccess** となった。

初回監査CIではテストが旧 `.app-version` selectorを見ていたため1件failureとなったが、製品挙動のfailureではなく監査hookの不整合だった。現行 `.workboard-version-display` へ修正後にgreenを確認した。

## Ver.210製品反映

`stable-fixes-v108.js` から次を退役した。

- `.work-mobile-status-tab` clickからの `scheduleFixes()`
- `window.resize` からの `scheduleFixes()`
- `orientationchange` からの遅延 `scheduleFixes()`
- `pageshow` からの `scheduleFixes()`
- `setTimeout(scheduleFixes, 300)`
- `setTimeout(scheduleFixes, 1200)`

一方、次は維持する。

- 初期 `applyFixes()`
- mine filter / nav click時の明示的更新
- current/startup user change時の明示的更新
- `#todayView`限定MutationObserver
- Todayの状態除外・mine/group意味論
- stable固有の保護CSS

`release-manifest.js` はVer.210へ更新し、製品回帰テストでは退役した6経路が戻っていないことをstatic / Browser双方で固定する。

## 他資産との所有境界

- Today最終可視性: `stable-fixes-v108.js`
- native日付制約・segmented入力: `date-keyboard-fix-v127.js`
- 状態タブ通常表示・横スクロール・active列切替: `mobile-fixes.js`
- version表示の継続補正: `version-display-lock.js`
- スケジュール `7日間` 表示: `schedule-today-lock-v129.js`

## 変更しないもの

- `date-keyboard-fix-v127.js` の製品実装
- `mobile-fixes.js` の製品実装
- `version-display-lock.js` の製品実装
- Todayの状態除外・mine/group意味論
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction
- dynamic CSS / JSの本数とロード順

## 復旧地点

- 監査前: `backup/ver209-before-stable-full-pass-audit` = `db740a19bd07358b3cb96005c9015125e6d44423`
- 監査完了後・製品変更前: `backup/ver209-with-stable-full-pass-audit` = `e28d52cbb9f3730407d77da6ec1d8fcdad7ec85a`

## 次候補

Ver.211候補では、今回残したnav/filter clickとuser changeがfull `applyFixes()` を必要とするかを監査する。

Today条件変更には反応が必要だが、`installStyle()` と `setVersion()` は毎回不要な可能性があるため、製品コードを先に変えず `scheduleTodayFilters()` 相当だけで十分かをBrowserで確認する。
