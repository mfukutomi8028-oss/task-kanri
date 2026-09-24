# Ver.270 icon-system finite polling 境界監査

## 対象

- `icon-system-v169.js`
- `index.html`
- `work-features-v167.js`
- `release-manifest.js`

## 目的

`icon-system-v169.js` が起動時の `applyIcons()` 後も 250ms 間隔で最大24回（約6秒）再適用する有限 polling について、現在のDOM生成順で必要な待機責務が残っているかを確認した。

## 現行契約

`start()` は最初に `applyIcons()` を1回実行し、その後 `setInterval(..., 250)` で再実行する。callback は24回で `clearInterval()` されるため、最大約6秒間 navigation / summary icon を再走査する。

## Protocol監査

Regression #620 で以下を固定した。

- core navigation / filter / summary の対象DOMは `index.html` に初期状態から存在する。
- 遅延候補の業務メモnavigationは `work-features-v167.js` の `init()` から同期的に `createMemoNav()` される。
- release loader順は `work-features-v167.js` → `work-features-ui-v190.js` → `icon-system-v169.js` である。
- `icon-system-v169.js` の現行pollingは250ms × 最大24回である。

Protocolは 246 pass / 0 fail。

## Browser実測

Regression #620 のBrowser監査では以下を確認した。

1. `icon-system-v169.js` が `setInterval` を登録した時点で、監査対象の navigation / filter / work memo / summary lookup anchor はすべて既に存在していた。
2. interval delay は250msだった。
3. `WORK_BOARD_ASSETS_READY === true` になった後も、全対象が存在する状態のままpoll callback数が増加し続けた。650msの観測窓でもcallback増加を確認した。
4. Today iconの `src` をsyntheticに旧assetへ壊し、poll callbackを1回実行するとcurrent assetへ復元された。

Browser全体は 180 passed / 55 skipped。

## 実測から分かる責務

現行productの通常生成順では、polling開始時点ですでに全semantic targetが揃っている。したがって現在の最大6秒pollingが待っている実DOM生成は確認できなかった。

一方、poll callbackには「起動後に外部要因で既存iconの `src` が旧値へ書き換えられた場合に自己修復する」というlate self-heal能力がある。ただしVer.269でfirst-paint legacy compatibilityはassets-ready時にfinal sweepして終了し、現行appも旧navigation / summary assetを通常経路で再生成しないため、このgeneric self-healを6秒pollingで維持するproduct要件は確認できない。

## 結論

**Ver.271製品化候補では `setInterval` / `clearInterval` を撤去し、`start()` の即時 `applyIcons()` 1回だけへ縮小する。**

安全条件は以下とする。

- static navigation / summary targetの初期DOM契約をProtocolで維持する。
- work-features → icon-system のloader順を維持する。
- 業務メモnavigationを含む全current iconが初回適用で正規assetへ収束することをBrowserで確認する。
- desktop / mobile navigation、summary、通常navigation往復を回帰確認する。
- `brand-v185.js` とVer.269 first-paint compatibilityの責務は変更しない。
- Firebase保存・同期経路は変更しない。

動的JS変更になるため、製品化時はrelease / baselineReleaseを257から258へ進める。

## Regression #620

- Protocol: success
- Browser: success
- Firebase Emulator: success

Firebase Emulator群ではVer.254 reconnect監査が初回失敗後retryで成功するflaky判定を1件記録したが、Ver.270変更対象とは無関係で、workflow全体の結論はsuccessだった。今工程では製品runtimeを変更していない。
