# Ver.274 version lifecycle 再適用境界監査

## 目的

Ver.273 完了後の次工程として、`config.js` の `setVersion()` が通常起動・遅延 timer・focus・pageshow でどの程度再実行され、current state のままでも DOM 書込を発生させているかを実ブラウザで計測した。

本監査は **audit-only** とし、`config.js` / `release-manifest.js` の製品 runtime、release 値、Firebase、業務データ経路は変更しない。

監査基点:

- main: `9085fbb06dee0a597a0691dca8f231117efd9432`
- release / baselineRelease: `259`
- PR: #161
- Regression: #635
- Protocol: 256 pass / 0 fail
- Browser: 190 pass / 55 skip / 0 fail
- Firebase Emulator: success

## 現行 lifecycle

`config.js` の `setVersion()` には現在、次の 6 経路がある。

1. `start()` 冒頭の直接呼出
2. `loadAll()` 完了後の直接呼出
3. `setTimeout(setVersion, 300)`
4. `setTimeout(setVersion, 1200)`
5. `window.focus`
6. `window.pageshow`

`setVersion()` は textContent だけは差分がある場合のみ更新するが、以下は current state でも毎回実行している。

- `classList.remove("app-version")`
- `classList.add("workboard-version-display")`
- `title` 代入
- `data-release-version` 代入
- `WORK_BOARD_RELEASE_VERSION` 代入
- `WORK_BOARD_VERSION` 代入

## 実測結果

### 1. 通常起動

`V274_VERSION_STARTUP_METRICS` では、通常 CI boot で `setVersion()` が 5 回実行された。

- direct: 2 回
- timer 300ms: 1 回
- initial pageshow: 1 回
- timer 1200ms: 1 回
- focus: 0 回

300ms / 1200ms timer は双方とも登録・実行された。

最初の direct 呼出は static HTML の legacy version を current `Ver.259` へ補正するため実作業を持つ。

その後の current state に対する各 pass では、textContent は更新されない一方、MutationObserver 上では毎回 4 件の attribute mutation が発生した。

- `classList.remove("app-version")`: 1 件
- `classList.add("workboard-version-display")`: 1 件
- `title = current value`: 1 件
- `data-release-version = current value`: 1 件

実測 mutation 数:

- direct 合計: 10 件（初回実補正 + 2 回目 no-drift pass）
- timer 300ms: 4 件
- initial pageshow: 4 件
- timer 1200ms: 4 件

つまり、300ms / 1200ms timer は通常起動時には version state を変えず、current DOM に同値を書き戻しているだけだった。

### 2. no-drift focus / pageshow

`V274_VERSION_FOCUS_NODRIFT_METRICS`:

- setVersion: 1 回
- DOM mutation: 4 件
- version state: `Ver.259` のまま

`V274_VERSION_PAGESHOW_NODRIFT_METRICS`:

- setVersion: 1 回
- DOM mutation: 4 件
- version state: `Ver.259` のまま

focus / pageshow は current state でも同値 class / title / dataset を再書込している。

### 3. synthetic drift recovery

version 表示を意図的に以下へ戻してから個別イベントを発火した。

- class: `app-version`
- text: `Ver.143`
- title: legacy value
- `data-release-version`: `143`
- `WORK_BOARD_RELEASE_VERSION`: `143`
- `WORK_BOARD_VERSION`: `143`

`V274_VERSION_PAGESHOW_DRIFT_METRICS`:

- pageshow 1 回だけで current state `259` へ完全復旧
- event-owned DOM mutation: 5 件

`V274_VERSION_FOCUS_DRIFT_METRICS`:

- focus 1 回だけで current state `259` へ完全復旧
- event-owned DOM mutation: 5 件

したがって、focus と pageshow はそれぞれ独立した recovery trigger として実価値がある。

### 4. 通常 navigation

Tasks → Today の通常 navigation を実行した `V274_VERSION_NAVIGATION_METRICS` では以下だった。

- setVersion call: 0
- version DOM mutation: 0
- event callback: 0
- version state: current `Ver.259` を維持

通常 navigation に version lifecycle recovery は不要である。

## 結論

### A. 300ms / 1200ms timer は製品上の独自価値を確認できない

最初の direct `setVersion()` が static legacy version を current へ補正した後、両 timer は current state に対して同値書込を行うだけだった。

Ver.275 製品ではこの 2 本の timer を撤去する候補とする。

### B. `setVersion()` の DOM 書込は idempotent 化できる

current state でも 1 回の pass あたり 4 件の attribute mutation が発生している。

Ver.275 では以下を差分がある場合だけ書く。

- legacy `app-version` class の remove
- `workboard-version-display` class の add
- `title`
- `data-release-version`

textContent の既存差分判定は維持する。

### C. focus / pageshow recovery は維持する

両 trigger はそれぞれ単独で synthetic drift を完全復旧できた。

focus は foreground/focus 復帰、pageshow は BFCache / page resume の異なる lifecycle を担うため、Ver.275 では両方を維持する。

ただし no-drift 時には DOM mutation 0 を目標とする。

### D. start() の 2 回の direct call は Ver.275 では保守的に維持する

2 回目は今回の通常 boot では no-drift だったが、`loadAll()` を挟む loader boundary の recovery 意味まで今回の監査だけで否定する必要はない。

Ver.275 では timer 撤去と idempotent write に範囲を限定し、start 前後の 2 回は維持する。

### E. navigation hook は追加しない

通常 navigation では version drift も lifecycle call も発生していないため、追加の navigation recovery は不要である。

## Ver.275 製品 acceptance

次工程では以下を満たすことを製品条件とする。

1. `setTimeout(setVersion, 300)` / `setTimeout(setVersion, 1200)` を撤去する。
2. `start()` の pre-load / post-load `setVersion()` 2 回は維持する。
3. focus / pageshow recovery を維持する。
4. current state に対する class / title / dataset 書込を idempotent 化する。
5. no-drift focus / pageshow で version DOM mutation が 0 になることを Browser で固定する。
6. synthetic drift 後は focus / pageshow のどちらでも current version / semantic class / title / dataset / globalsを完全復旧できることを維持する。
7. 通常 navigation で version lifecycle call / mutation が増えないことを維持する。
8. existing version-display / responsive / UI / Firebase regression をすべて green にする。
9. `config.js` の製品 runtime 変更に伴い、release / baselineRelease は次 release へ一致させる。

## 非変更

Ver.274 監査では以下を変更しない。

- `config.js` 製品 runtime
- `release-manifest.js` 製品 runtime
- release / baselineRelease `259`
- version 表示 CSS ownership
- retired `version-display-lock.js` の inactive 状態
- Firebase 初期化・保存・同期・transaction 境界
- 業務データ構造

Ver.274 は監査結果だけを main へ残し、製品変更は別 Ver.275 PR で行う。
