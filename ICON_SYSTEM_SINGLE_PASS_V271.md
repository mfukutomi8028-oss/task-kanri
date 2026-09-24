# Ver.271 icon-system single-pass 製品化

## 背景

Ver.270監査では、`icon-system-v169.js` の250ms × 最大24回（約6秒）polling開始時点で、navigation / filter / work memo / summary のsemantic targetがすべて存在することを確認した。assets-ready後も全targetが存在したままpoll callbackが増加し、通常product経路でpollingが待つDOM生成は確認できなかった。

polling固有の価値は、syntheticに既存iconの`src`を旧assetへ書き換えた場合のlate self-healだけだった。現行appは旧navigation / summary assetを通常経路で再生成せず、first-paint legacy compatibilityもVer.269でassets-ready時にfinal sweepして終了するため、このgeneric self-healを通常運用中に維持する要件はない。

## 製品変更

- `icon-system-v169.js` の `setInterval` / `clearInterval` / 24回retryを撤去した。
- `start()` は即時 `applyIcons()` 1回だけを実行する。
- current assetへのidempotentな `replaceSource()` は維持する。
- `work-features-v167.js` → `icon-system-v169.js` のloader順と、static navigation / summary DOM契約を前提として維持する。
- `brand-v185.js` とVer.269 first-paint compatibilityは変更しない。

## Release

動的JavaScript変更のため、release / `baselineRelease` を **258** へ更新した。

## 回帰契約

Protocolでは以下を固定する。

- `start()` は `applyIcons()` 1回だけ。
- icon-system内に `setInterval` / `clearInterval` が存在しない。
- core navigation / summary targetは初期HTMLに存在する。
- work memo navigationはwork-features initで同期生成され、loader順はwork-features → icon-system。
- release manifest / responsibility baselineは258で一致する。

Browserでは以下を確認する。

- icon-system由来interval登録は0件。
- navigation / filter / work memo / summary iconが初回passでcurrent assetへ収束する。
- 通常navigation往復後もcurrent assetを維持する。
- syntheticなpost-start `src` 破損は自動self-healしない。これはfinite polling退役に伴う意図した境界変更である。

## 非変更

- Firebase保存・同期経路
- 業務データ / ToDo / taskロジック
- brand asset ownership
- first-paint legacy compatibility

## 復旧地点

`backup/ver270-before-icon-polling-v271` = `4441ca9f83116fc03167f6a6994d6d761cfa530f`

## 次工程

Ver.272で `brand-v185.js` の起動時 `patchBrowserIcons()` 二重適用と `pageshow` 全 `apply()` の必要境界を監査する。favicon / sidebar brand / Notificationの各責務を分離し、通常起動・BFCache復帰・synthetic driftのどこで再補正が必要かを実測する。
