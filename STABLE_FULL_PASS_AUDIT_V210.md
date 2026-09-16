# stable full `applyFixes()` 発火経路監査（Ver.210候補）

## 目的

Ver.209でnative date / datetime-local制約と `#taskForm` Observerを `stable-fixes-v108.js` から退役し、日付入力を `date-keyboard-fix-v127.js` の単独所有へ整理した。

現在stableに残る `applyFixes()` の責務は次の3つだけである。

1. `installStyle()` — stable固有の状態タブ保護CSSとToday最終非表示CSSを1回だけ注入
2. `applyTodayFilters()` — Todayの状態除外とmine/group担当者判定
3. `setVersion()` — manifest版を `.app-version` へ反映

一方、`scheduleFixes()` は起動後も複数のイベントからfull `applyFixes()` を実行しているため、Ver.210候補では「Today意味論を変えずに、明らかに無関係なfull passを削減できるか」を先に監査する。

本工程では製品コードを変更しない。公開版はVer.209のままとする。

## 現行full-pass発火経路

### 維持候補として扱う経路

- 初期起動時の `applyFixes()`
- `.nav-filter[data-filter="mine"]` click
- `.nav-item[data-layout]` click
- `#currentUserSelect` / `#startupUser` change

これらはTodayの表示条件や画面遷移に直接関係するため、本監査では削除候補にしない。

### 今回の退役候補として監査する経路

- `.work-mobile-status-tab` click
- `resize`
- `orientationchange`
- `pageshow`
- 起動後300msの遅延full pass
- 起動後1200msの遅延full pass

状態タブclickはタスクボード内の列切替でありToday判定と直接関係しない。viewport / pageshow / 遅延timerも、Ver.209時点でstableが持つ意味論から見るとfull `applyFixes()` が必要か再確認する価値がある。

## 既存の代替責務

- stable CSSは `installStyle()` が同一IDを確認するため冪等で、初期注入後にviewport eventごとの再実行を必要としない設計になっている。
- Todayは固定 `#todayView` のchildList/subtreeを `scheduleTodayFilters()` が監視し、再描画時にはfull passではなく `applyTodayFilters()` だけを実行する。
- バージョン表示は `version-display-lock.js` が `WORK_BOARD_RELEASE.version` を正本として独立して維持している。
- モバイル状態タブの通常表示・横スクロール・active列切替は `mobile-fixes.js` が所有する。

## 実ブラウザ監査

`tests/stable-full-pass-audit-v210.spec.mjs` では、製品ファイル自体は変更せず、Playwright内で読み込む `stable-fixes-v108.js` だけを監査用に変換する。

監査用変換では次だけを一時的に無効化する。

- `.work-mobile-status-tab` clickからの `scheduleFixes()`
- `resize` / `orientationchange` / `pageshow` からの `scheduleFixes()`
- 300ms / 1200ms timerからの `scheduleFixes()`

`applyFixes()` と `applyTodayFilters()` の実行回数も監査用カウンタで記録する。

### 確認内容

1. 遅延timerを除いても初期stable styleとVer.209表示が成立する
2. resize / orientationchange / pageshowを発火してもfull passなしでstyleとversion表示が維持される
3. タスク画面へのnav遷移は従来のfull passを維持する
4. モバイル状態タブclickではstable full passなしでもactiveタブが切り替わる
5. `#todayView`へカードが追加された場合、scoped Today Observerだけで `保留`、空き時間の`確認待ち`、mine他担当、group担当の最終可視性が正しく反映される
6. その後resize / orientationchange / pageshowを発火してもToday最終可視性が崩れない

## 判断基準

### 全監査green

次の製品工程で、以下だけをstableから退役する候補とする。

- `.work-mobile-status-tab` のfull-pass trigger
- resize full-pass trigger
- orientationchange full-pass trigger
- pageshow full-pass trigger
- 300ms / 1200ms delayed full-pass trigger

初期起動、nav/filter click、user changeは別途必要性を確認するまで維持する。

### 監査failure

失敗した経路はstableの現行安全網として維持し、どの責務が依存しているかを記録してから次工程を再設計する。

## 変更しないもの

- `stable-fixes-v108.js`
- `date-keyboard-fix-v127.js`
- `mobile-fixes.js`
- `version-display-lock.js`
- `release-manifest.js`（Ver.209）
- Todayの状態除外・mine/group意味論
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction

## 復旧地点

`backup/ver209-before-stable-full-pass-audit` = `db740a19bd07358b3cb96005c9015125e6d44423`
