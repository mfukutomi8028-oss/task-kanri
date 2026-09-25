# Ver.280 監査: config brand bootstrapの独立価値

## 目的

Ver.279では `config.js:start()` の後段 `setVersion()` を撤去し、startup version同期を1回へ縮小した。

次の重複責務として、`config.js` のstartup `patchBrandIcons()` が `assets/brand.png?v=current` を一時適用した後、後続の `brand-v185.js` がcanonicalな `brand-v184.svg/png?v=185` へ再構築する二段補正が残っている。

Ver.280では、config側bootstrap brand補正に独立したユーザー可視・復旧価値があるかを監査する。

## 前提

- 基点 main: `673a052da557d93aae7b2bb0255a67d7065fa97a`
- release / baselineRelease: `262 / 262`
- 復旧branch: `backup/ver279-before-brand-bootstrap-audit-v280`
- 監査branch: `audit/brand-bootstrap-v280`
- 製品 `config.js` / `brand-v185.js` / `release-manifest.js` は変更しない
- Firebase・業務データ経路は変更しない

## 現行責務

### config.js startup

`start()` 冒頭では現在、次の順に処理する。

1. `setVersion()`
2. `patchBrandIcons()`
3. dynamic CSS / JS読込
4. assets-ready通知

`patchBrandIcons()` は次を行う。

- `.brand-mark img` を `assets/brand.png?v=262` へ変更
- favicon / shortcut iconを削除
- icon / shortcut icon / apple-touch-iconを `assets/brand.png?v=262` で再作成

### brand-v185.js

後続のcanonical brand runtimeは次を所有する。

- brand mark: `assets/brand-v184.svg?v=185`
- favicon set: SVG 1件 + PNG 3件
- Notification icon wrapper
- startup canonicalization
- `pageshow` drift recovery
- current状態でのidempotency

## 監査方法

Browserテストで配信される `config.js` のコピーだけをroute interceptionで加工し、製品runtimeを変更せず反実仮想を作った。

- baseline: startup `patchBrandIcons()` を通常どおり実行
- counterfactual: startup `patchBrandIcons()` 1回だけを抑止
- config補正前後を採取
- `brand-v185.js` のstartup favicon canonicalization直前・直後を採取
- first-paint guard / assets-ready状態も同時に採取
- reveal後のbrand mark / favicon / Notificationを比較
- counterfactualでsynthetic driftを作り、`pageshow` recoveryを確認

Protocolでは、config bootstrap → dynamic assets → brand-v185という現在の順序、canonical ownership、Ver.280 priority candidateを固定した。

## 実測結果

PR #168 / Regression #661 / audit head `31442471e4322ed59fc0ed6da59c1bcbba9d2a15` で初回実測を行った。

- Protocol: 270 pass / 0 fail
- Browser: 197 pass / 55 skipped / 0 fail
- Firebase Emulator: success

### 1. baselineではconfigが隠れた中間状態を作る

config補正前:

- first-paint guard: active
- assetsReady: false
- brand mark: `assets/brand-v184.svg?v=262`
- favicon: static HTML由来 `assets/brand.png?v=143` 3件

ここでbrand markが既に `brand-v184.svg?v=262` なのは、`release-manifest.js` のlegacy image compatibilityが先に旧brand画像を現行系SVGへ補正しているためである。

config `patchBrandIcons()` 後:

- first-paint guard: active
- assetsReady: false
- brand mark: `assets/brand.png?v=262`
- favicon: `assets/brand.png?v=262` 3件

つまりconfig補正は、manifestが先にSVGへ寄せたbrand markを一度compatibility PNGへ戻している。

その後 `brand-v185.js` のstartup favicon canonicalizationにより、guard中・assets-ready前にfaviconは次のcanonical 4件へ到達した。

- `brand-v184.svg?v=185`
- `brand-v184.png?v=185` 512x512
- shortcut PNG
- apple-touch PNG

reveal後はbrand markも `brand-v184.svg?v=185`、Notification brandも `185` となった。

### 2. counterfactualでもreveal前にcanonical状態へ収束

config `patchBrandIcons()` を抑止すると、brand-v185到達前は以下のままだった。

- first-paint guard: active
- assetsReady: false
- brand mark: `assets/brand-v184.svg?v=262`
- favicon: static HTML由来 `assets/brand.png?v=143` 3件

しかし `brand-v185.js` が到達すると、同じくguard中・assets-ready前にfaviconはcanonical 4件へ再構築された。

first-paint reveal後はbaselineと完全一致した。

- firstPaintVersion: `262`
- brandVersion: `185`
- brand mark: `assets/brand-v184.svg?v=185`
- Notification brand: `185`
- favicon set: canonical 4件
- guard: released
- assetsReady: true

したがって、config bootstrapを抑止したことで旧v143 faviconが短時間DOM上に残っても、body表示解放より前にcanonical ownerが補正するため、現行first-paint契約ではユーザー可視差にならない。

### 3. pageshow recoveryはconfig bootstrapに依存しない

counterfactual状態でbrand mark / favicon / Notificationを人工的に崩し、`pageshow` を発火した。

`brand-v185.js` 単独で次へ復旧した。

- brand mark: `assets/brand-v184.svg?v=185`
- Notification brand: `185`
- favicon: canonical 4件

既存Ver.273回帰でも、release 262上でno-drift pageshowはicon add/remove・brand mark writeがすべて0、synthetic drift時だけ必要な再構築を行うことを再確認した。

## 結論

現行release 262では、`config.js:start()` の `patchBrandIcons()` に独立したユーザー可視・復旧価値は確認できない。

理由は次のとおり。

1. config補正はfirst-paint guard中にしか存在しない中間状態を作る
2. `brand-v185.js` がassets-ready / reveal前にcanonical faviconへ到達する
3. final brand mark / favicon / Notificationはcounterfactualでもbaselineと一致する
4. resume時のself-healは `brand-v185.js` のpageshow recoveryが独立して所有する
5. config補正はmanifestが先にSVGへ寄せたbrand markを一度compatibility PNGへ戻す重複書込でもある

よって次工程のVer.281製品では、**config.jsのstartup brand compatibility補正を撤去することを安全候補** と判断する。

## Ver.281 製品化で維持する境界

撤去候補:

- `start()` 内 `patchBrandIcons()` 呼出し
- config内で他用途がない `patchBrandIcons()`
- config内で他用途がない `upsertIconLink()`

維持対象:

- `brand-v185.js` のcanonical brand mark / favicon / Notification ownership
- `brand-v185.js` のstartup correction
- `brand-v185.js` のpageshow recovery
- `release-manifest.js` のlegacy image compatibility
- first-paint guard / assets-ready reveal / 4秒fallback
- static HTML compatibilityは今回変更しない
- loader順序
- Firebase・業務データ書込経路

## 次工程

Ver.281製品としてconfig側startup brand compatibility補正だけを撤去し、release / baselineReleaseを `263 / 263` へ進める。

Ver.280のcounterfactual監査を製品回帰へ昇格させ、PR CI → exact head merge → main Regression → Pagesまで確認する。
