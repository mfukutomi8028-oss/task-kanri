# Ver.279 製品: config後段setVersion撤去

## 目的

Ver.278監査で独立したユーザー可視・復旧価値が確認できなかった `config.js:start()` のasset読込完了後 `setVersion()` 1回だけを撤去する。

## 製品変更

- release / baselineRelease: `261 / 261` → `262 / 262`
- `config.js`
  - start冒頭の `setVersion()` は維持
  - 全asset読込後・assets-ready前の後段 `setVersion()` 1回だけ撤去
  - focus / pageshow recoveryを維持
- `release-manifest.js`
  - first-paint releaseを262へ更新
  - guard / legacy image final sweep / assets-ready reveal / 4秒fallbackを維持
- Ver.278 Protocol / Browser監査をVer.279製品回帰へ昇格
- 責務台帳へVer.278監査結果とVer.279製品化を記録

## 非変更

- Firebase・業務データ書込経路
- loader asset順序
- first-paint reveal条件
- version display CSS
- brand/icon canonical runtime

## 復旧地点

`backup/ver278-before-postload-version-product-v279` = `c467e4315264c4334656ff6516159a4a931d3d26`

## 次候補

Ver.280監査として、`config.js` のstartup `patchBrandIcons()` と後続 `brand-v185.js` の二段ブランド補正に独立価値があるかを実測する。
