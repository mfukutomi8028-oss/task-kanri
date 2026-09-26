# Ver.284 Brand pageshow cold-boot audit

## Scope

Ver.283で `brand-v185.js` のstartup初期化を `apply()` 1回へ集約した後も、通常cold bootではブラウザの初回 `pageshow` (`persisted=false`) が同じ `apply()` をもう一度実行する。Ver.284では、この2回目passに独立した製品価値があるかをProtocol・Chromium実測で監査した。

監査段階では製品runtime、release、Firebase、業務データ経路を変更していない。release / baselineRelease は264のまま。

## Measured baseline

通常cold bootでは以下を実測した。

- `apply()` : 2回
  - startup: `readyState=interactive`, assets-ready前, first-paint guard中
  - cold-boot pageshow: `persisted=false`, `readyState=complete`, assets-ready後
- brand mark実書込み: 1回
- favicon: 3旧link削除 + canonical 4link追加をstartupで1回だけ
- Notification wrapper: 1回
- `data-brand-version` assignment: 2回
- `data-brand-version` attribute mutation: 2回

したがって2回目のcold-boot pageshowでは、brand mark / favicon / Notificationには実変更がなく、無条件の `document.documentElement.dataset.brandVersion = VERSION` による同値attribute mutationだけが残る。

## Counterfactual

監査用instrumentationで `persisted=false` の初回pageshowだけを抑止した。

- `apply()` : 1回
- brand mark実書込み: 1回
- favicon: startupの1回だけ
- Notification wrapper: 1回
- `data-brand-version` assignment / mutation: 1回
- first-paint reveal後のbrand mark / favicon 4-link / Notification / brandVersion / release: baselineと一致

cold boot初回pageshowを実行しなくても、startup `apply()` だけで最終canonical状態は完全に成立した。

## Persisted pageshow recovery

cold-boot pageshowを抑止した状態でbrand mark、favicon、Notificationへsynthetic driftを入れ、`pageshow` (`persisted=true`) を発火した。

- `apply()` が1回追加実行
- brand markがcurrentへ復旧
- favicon canonical 4-linkを再構築
- Notification wrapperをcurrent brandへ復旧
- `data-brand-version`も維持

BFCache相当のpersisted pageshow recoveryには独立した復旧価値がある。

## Conclusion

Ver.284監査の結論は以下。

1. 通常cold bootの `pageshow` (`persisted=false`) による2回目 `apply()` は独立した製品価値を持たない。
2. このpassはbrand/favicon/Notificationを書き換えず、`data-brand-version` の同値mutationを1件追加するだけ。
3. startup `apply()` 1回だけでfirst-paint後のcanonical brand状態はbaselineと一致する。
4. `pageshow` (`persisted=true`) はsynthetic driftを単独復旧できるため維持すべき。
5. Firebase・業務データ・first-paint guardには変更不要。

## Ver.285 product acceptance candidate

次工程はVer.285製品化候補とする。

- `brand-v185.js` のpageshow handlerをevent-awareにする。
- cold bootの `persisted=false` は `apply()` を再実行しない。
- BFCache復帰の `persisted=true` では従来どおり `apply()` を実行する。
- startup `apply()` は維持する。
- brand mark / canonical favicon 4-link / Notification / `data-brand-version` のstartup収束を維持する。
- persisted pageshow synthetic drift recoveryを維持する。
- release / baselineを製品変更として次番号へ進める。
- Protocol / Browser / Firebase Emulator / PR CI / main CI / Pagesをすべてgreenにする。

## CI evidence

初回監査head `5bd0cf3231dd8f7a30345473117d54d19b8482ad` のRegression #677で以下を確認した。

- Protocol: 280 pass / 0 fail
- Browser: 201 pass / 55 skipped / 0 fail
- Firebase Emulator: success
- release: 264
