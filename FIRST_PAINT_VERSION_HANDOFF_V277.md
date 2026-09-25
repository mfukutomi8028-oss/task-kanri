# Ver.277 First-paint version handoff

## 目的

Ver.276監査で独立したユーザー可視価値が確認できなかった `release-manifest.js` の `DOMContentLoaded` version text loopを撤去し、初期version同期責務を `config.js` に一本化する。

## 製品変更

- release / baselineRelease: `260` → `261`
- `release-manifest.js`
  - `DOMContentLoaded` のlegacy image sweepは維持
  - `.app-version, .workboard-version-display` へのversion text書込だけ撤去
  - first-paint guard / assets-ready reveal / 4秒fallback / legacy icon observerは維持
- `config.js`
  - 製品コード変更なし
  - `start()` 冒頭・asset読込後の2回の `setVersion()` を維持
  - `focus` / `pageshow` recoveryを維持
- Firebase・業務データ経路は変更しない

## Ver.276で確認した根拠

manifest側のversion text書込をテスト環境で抑止しても、configの最初の `setVersion()` がfirst-paint guard中にstatic `Ver.143` からcurrent versionへtext / class / title / dataset / globalsを完全同期し、表示解放時点は通常経路と同一だった。

## Ver.277回帰契約

- manifest由来version text write = 0
- config由来の初回 `Ver.143 → Ver.261` text write = 1
- その書込はfirst-paint guard中かつassets-ready前
- reveal時点で `Ver.261` / `workboard-version-display` / title / `data-release-version` / globals がすべて261
- legacy image sweep・observer終了・4秒fallbackを維持
- focus/pageshow recoveryを維持

## 次候補

Ver.278監査では、config `start()` のasset読込前後2回の `setVersion()` のうち、後段同期に独立した復旧価値があるかを実測する。監査段階では製品runtimeを変更しない。
