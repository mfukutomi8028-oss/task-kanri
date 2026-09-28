# Ver.312 Mobile shell keydown lifecycle productization

## Base

- Base checkpoint: Ver.311
- Base main SHA: `015134bb5248153b092fa2e5f633dd0ca4baaffc`
- release / baselineRelease: `276 -> 277`
- Rollback: `backup/ver311-before-mobile-keydown-lifecycle-v312`

## Product change

Ver.311でProtocol / Browser / Firebase Emulatorの同等性を確認したmobile Escape listener lifecycleだけを製品runtimeへ反映する。

- `mobile-shell-v234.js` の常設document-level `keydown` listenerを撤去する。
- `body.work-mobile-menu-open` または `#workMobileCreateMenu.open` の実DOM状態からlistener要否を判定する。
- drawer / create menuのどちらかが開いている間だけlistenerを1本登録する。
- 両方閉じたらlistenerを解除する。
- Escape、overlay、navigation、Task/Schedule create handoff、反復open/closeでstale listenerを残さない。

## Preserved boundaries

- Ver.310 create-menu outside-click lifecycleを維持する。
- Ver.308 `.nav`-scoped navigation delegationを維持する。
- Ver.304 Schedule同期handoffを維持する。
- resize reconciliation / semantic board observer / 860-861px conditional mobile loaderを維持する。
- Firebase、task persistence、workflow、notification、業務データ書込経路は変更しない。

## Regression promotion

Ver.311のroute-local candidate監査を退役し、製品`mobile-shell-v234.js`そのものを計測するVer.312 Browser regressionへ昇格する。

- closed transient UI: callback 0
- create menu / drawer open: listener 1本
- non-Escape: UI状態維持
- Escape: close + unbind
- drawer/create-menu overlap: listener 1本
- overlay / navigation close: unbind
- repeated cycles: listener/callback重複なし
- Task/Schedule handoff: stale listenerなし
- 861 -> 860 late load: lifecycle維持
- desktop cold boot: mobile listenerなし

## Next

Ver.313では、Ver.295〜302で意図的に維持したresize / board observer責務を除外したうえで、mobile-shellに残る長寿命責務を再棚卸しし、追加の安全な縮小候補が残るか監査する。
