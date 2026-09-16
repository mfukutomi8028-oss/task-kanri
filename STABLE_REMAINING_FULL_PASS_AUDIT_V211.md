# stable残存full `applyFixes()` 発火経路監査（Ver.211候補）

## 目的

Ver.210では、事前Browser監査で安全性を確認したうえで `stable-fixes-v108.js` から次の非意味的full-pass triggerを退役した。

- mobile状態タブclick
- resize
- orientationchange
- pageshow
- 起動後300ms timer
- 起動後1200ms timer

その結果、起動後に残る明示的full `applyFixes()` triggerは次だけになった。

- `.nav-filter[data-filter="mine"]` / `.nav-item[data-layout]` click
- `#currentUserSelect` / `#startupUser` change

Ver.211候補では、これらが `installStyle()` / `applyTodayFilters()` / `setVersion()` を毎回まとめて実行する必要があるかを監査する。

本工程は**監査のみ**であり、製品コードと `release-manifest.js` は変更しない。公開版はVer.210のままとする。

## 仮説

残存イベントのうち、stable固有でイベント後に必要なのはToday最終可視性の再評価だけである可能性が高い。

- `installStyle()` は初期起動で一度注入され、同一IDを持つためイベントごとの再実行を必要としない。
- version表示は `version-display-lock.js` が `WORK_BOARD_RELEASE.version` を正本として継続補正する。
- navそのものの画面切替は `app.js` が所有する。
- mine filterとcurrent userの変更はTodayの担当者判定に影響するため、`applyTodayFilters()` は必要。

したがって、イベントtriggerだけを `scheduleFixes()` から `scheduleTodayFilters()` へ限定しても挙動が維持されるかを確認する。

## 実ブラウザ監査

`tests/stable-remaining-full-pass-audit-v211.spec.mjs` では製品ファイルを変更せず、Playwrightで読み込むstableだけを監査用に変換する。

### テスト内だけで変更する経路

- nav/mine click: `scheduleFixes()` → `scheduleTodayFilters()`
- current/startup user change: `scheduleFixes()` → `scheduleTodayFilters()`

初期 `applyFixes()` と `#todayView` MutationObserverはそのまま維持する。

### 計測

監査用stableへ次のカウンタだけを注入する。

- full `applyFixes()` 実行回数
- `applyTodayFilters()` 実行回数

### 確認内容

1. 初期起動では従来どおりfull passが少なくとも1回成立する。
2. mine filterを有効化すると、福冨担当は表示、森井担当は非表示、group担当は表示となる。
3. その際Today passは増えるがfull passは増えない。
4. current userを森井へ変更すると、福冨担当は非表示、森井担当は表示、group担当は表示となる。
5. user changeでもToday passだけが増え、full passは増えない。
6. 実際の「タスク」→「今日」navigationが正常に切り替わる。
7. navigation後もfull passは増えない。
8. stable保護styleとVer.210表示は各イベント後も維持される。

## 判断基準

### 全監査green

次の製品工程で、nav/filter clickとuser changeのstable event handlerを `scheduleTodayFilters()` へ限定する候補とする。

初期 `applyFixes()` は維持し、style初期注入と初回Today補正を引き続き保証する。

### failure

失敗したイベント経路はfull passを維持する。failure時は `installStyle()` / `setVersion()` / Today以外のどの責務が依存しているかを切り分けてから再設計する。

## 変更しないもの

- `stable-fixes-v108.js`
- `release-manifest.js`（Ver.210）
- `date-keyboard-fix-v127.js`
- `mobile-fixes.js`
- `version-display-lock.js`
- Todayの状態除外・mine/group意味論
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction

## 復旧地点

`backup/ver210-before-remaining-full-pass-audit` = `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
