# Ver.269 legacy icon observer 製品化

## 背景

Ver.268監査では、`release-manifest.js` のlegacy icon `MutationObserver` が `workboard:assets-ready` 後も `documentElement` 全体を `subtree: true` で監視し続け、無関係なDOM更新だけで32 callback / 87 mutation records発火することを確認した。

一方、通常の製品経路ではassets-ready時点でbrand / navigation / summary iconはcurrent assetへ収束しており、`app.js` もlegacy map対象の旧navigation / summary assetを生成していない。current assetの継続補正は `brand-v185.js` と `icon-system-v169.js` が所有している。

## Ver.269の変更

`release-manifest.js` のlegacy observerをfirst-paint compatibility専用へ縮小した。

1. 初回asset読込中は従来どおり `documentElement` subtreeを監視し、追加されたlegacy imageをcurrent assetへ置換する。
2. `workboard:assets-ready` 受信時に、document内の全`img`を最後に1回sweepする。
3. final sweep直後にlegacy observerを`disconnect()`する。
4. その後にfirst-paint guardを解放する。
5. 4秒の表示解放fallbackは`revealCurrentUi()`だけを実行し、assets-ready前にobserverを停止しない。

これにより、低速読込やasset loaderの待機中に必要なlegacy互換性を維持しつつ、通常運用中のdocument-wide MutationObserverを除去する。

## 維持した責務

- `brand-v185.js`: sidebar brand、favicon / shortcut icon / apple-touch-icon、Notification icon、pageshow復帰補正
- `icon-system-v169.js`: navigation / summary iconのcurrent semantic asset補正
- `config.js`: release manifestを正本とするasset loaderと`workboard:assets-ready`通知
- Firebase保存・同期・ToDo / task等の業務データ経路

## Release

- release manifest: **257**
- `patch-responsibilities.json` baselineRelease: **257**

## 回帰安全網

Protocolでは以下を固定する。

- first-paint中はlegacy observerが存在すること
- assets-ready時にfinal image sweepの後でdisconnectすること
- 4秒fallbackでは互換監視を早期終了しないこと
- release / baselineReleaseが257で一致すること
- current asset ownershipがbrand/icon-systemに残ること

Browserでは以下を確認する。

- assets-ready後にobserverがdisconnect済みであること
- assets-ready後の無関係DOM churnでcallback / mutationが増えないこと
- assets-ready前のlegacy imageは従来どおり補正されること
- observer deliveryを止めてもfinal sweepでlegacy imageを回収できること
- assets-ready後にsynthetic legacy imageを追加してもgeneric observer補正が復活しないこと
- 通常navigation後もbrand / Today / ToDo / Task / Schedule iconがcurrent assetを維持すること

## 次工程

Ver.270では `icon-system-v169.js` の250ms × 最大24回の有限pollingを独立監査する。今回の変更には混ぜない。
