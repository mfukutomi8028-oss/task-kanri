# Ver.278 監査: config後段setVersionの独立価値

## 目的

Ver.277では `release-manifest.js` の初期version text書込を撤去し、first-paint中のsemantic version同期を `config.js` へ一本化した。

一方、`config.js` の `start()` には現在も次の2回の直接同期が残っている。

1. asset読込前の `setVersion()`
2. 全CSS/JS・必要なmobile script読込後、`notifyAssetsReady()` 前の `setVersion()`

Ver.278では、2の後段 `setVersion()` が現在のruntimeで独立した復旧価値を持つかを監査する。

## 前提

- 基点 main: `e136bb817384d5e8efbae0588cc091ac89026844`
- release / baselineRelease: `261 / 261`
- 復旧branch: `backup/ver277-before-postload-version-audit-v278`
- 監査branch: `audit/postload-version-sync-v278`
- 製品 `config.js` / `release-manifest.js` / Firebase・業務データ経路は変更しない

## 監査方法

Browserテストで配信される `config.js` のコピーだけをroute interceptionで加工し、製品runtimeを変更せず反実仮想を作った。

- baseline: 後段 `setVersion()` を残す
- counterfactual: 後段 `setVersion()` 1回だけを抑止する
- どちらも後段呼出し直前、すなわち全asset読込後かつ `assets-ready` 前にsemantic状態を採取する
- version text書込元とタイミングを計測する
- reveal後の状態を比較する
- counterfactualでsynthetic driftを作り、`focus` と `pageshow` が単独復旧できるか確認する

Protocolでは、監査対象が `start()` 内の前段/後段2回だけであること、focus/pageshow recovery・first-paint guard・4秒fallbackを維持していること、製品runtimeを書き換えないことを固定した。

## 実測結果

### 1. baseline: 後段呼出し直前ですでに完全同期済み

後段 `setVersion()` が呼ばれる直前の状態:

- text: `Ver.261`
- class: `workboard-version-display`
- title: `現在のバージョン Ver.261`
- `data-release-version`: `261`
- `WORK_BOARD_RELEASE_VERSION`: `261`
- `WORK_BOARD_VERSION`: `261`
- manifest release: `261`
- `assetsReady`: false
- first-paint guard: active

version text書込は前段 `setVersion()` による `Ver.261` への1回だけで、後段呼出し到達後のversion text書込は0件だった。

したがって、現行のactive CSS/JS/mobile loaderはasset読込中にversion表示を旧値へ戻していない。

### 2. counterfactual: 後段setVersionを抑止してもreveal状態は完全一致

後段 `setVersion()` をテスト環境だけで抑止しても、後段境界時点のsemantic状態はbaselineと完全一致した。

さらにfirst-paint reveal後も以下がすべて261で一致した。

- text / class / title / dataset
- `WORK_BOARD_RELEASE_VERSION`
- `WORK_BOARD_VERSION`
- manifest release
- `data-first-paint-version`

`assetsReady=true`、first-paint guard解除も通常経路と同じだった。

### 3. focus/pageshow recoveryは後段同期に依存しない

後段 `setVersion()` を抑止した状態で、表示DOMとversion globalsを人工的にVer.143へ崩した。

`focus` 単独、`pageshow` 単独のどちらでも以下すべてがVer.261へ復旧した。

- text
- semantic class
- title
- dataset
- release globals

したがって復帰時のself-healは後段direct syncとは独立している。

## CI

PR #166 / Regression #651 / audit head `45d8ed0c2f1f9585cadd36702bf6ebaa493dae98` で初回実測を行った。

- Protocol: 266 pass / 0 fail
- Browser: 194 pass / 55 skipped / 0 fail
- Firebase Emulator: success

既存Ver.277 first-paint回帰、Ver.275 version lifecycle回帰を含む全体回帰もgreenだった。

## 結論

現行release 261のruntimeでは、`config.js:start()` の後段 `setVersion()` に独立したユーザー可視・復旧価値は確認できない。

前段 `setVersion()` の時点で旧 `Ver.143` からcurrent semantic状態へ完全同期し、その後のactive asset loaderはversion表示を上書きしない。後段同期を除去してもfirst-paint reveal契約とfocus/pageshow recoveryは変化しない。

よって、次の製品工程で **後段 `setVersion()` 1回だけを撤去することは安全候補** と判断する。

## Ver.279 製品化で維持する境界

撤去対象:

- `config.js:start()` のasset読込完了後・`notifyAssetsReady()` 前にある後段 `setVersion()` 1回

維持対象:

- `start()` 冒頭の前段 `setVersion()`
- `focus` recovery
- `pageshow` recovery
- `release-manifest.js` のfirst-paint guard
- assets-ready reveal
- legacy image compatibility final sweep
- 4秒fallback
- loader順序
- Firebase・業務データ書込経路

## 次工程

Ver.279製品として後段 `setVersion()` だけを撤去し、release / baselineReleaseを `262 / 262` へ進める。

Ver.278のcounterfactual監査を製品回帰へ昇格させ、PR CI → exact head merge → main Regression → Pagesまで確認する。