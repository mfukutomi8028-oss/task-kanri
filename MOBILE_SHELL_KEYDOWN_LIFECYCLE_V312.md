# Ver.312 Mobile shell Escape keydown lifecycle productization

## 目的

Ver.311監査でProtocol / Browser / Firebase Emulatorの同等性を確認したmobile Escape keydown listenerのlifecycle narrowingを製品runtimeへ反映する。

## 製品変更

- `mobile-shell-v234.js` の常時document-level `keydown` listenerを撤去する。
- Escape listenerは mobile drawer または create menu が開いている間だけ `document` に1本登録する。
- 両方が閉じたらlistenerを解除する。
- binding状態は独立したdrawer/menu状態ではなく、`body.work-mobile-menu-open` と `#workMobileCreateMenu.open` のDOM実状態から判定する。
- `closeMobileMenu()`、`toggleCreateMenu()`、`closeCreateMenu()` の各状態遷移後にbindingを再同期し、overlay / navigation / Escape / create handoffを含むclose経路でstale listenerを残さない。
- release manifest / `baselineRelease` を 276 → 277 へ更新する。

## 維持する境界

- Ver.310 create-menu outside-click listener lifecycleを維持する。
- Ver.308 `.nav`-scoped navigation delegationと同期reconciliation順序を維持する。
- Ver.304 Schedule create同期handoffを維持する。
- resize reconciler、semantic board observer、860/861px conditional late loaderを維持する。
- Firebase、task persistence、workflow、notification、業務データ書込経路は変更しない。

## 製品回帰

製品`mobile-shell-v234.js`そのものに対して以下を確認する。

1. drawer/create menu閉鎖中はkeydown callbackが存在しない。
2. create menu open時だけlistenerを1本登録し、非EscapeではUI状態を維持する。
3. Escapeでcreate menuを閉じlistenerを解除する。
4. drawer open時だけlistenerを1本登録し、Escapeで閉じて解除する。
5. drawer + create menuが重なってもlistenerは1本だけ保持する。
6. overlay / navigation closeでlistenerを解除する。
7. Schedule create handoffでlistenerを解除しcanonical dialogを開く。
8. repeated open/closeでlistenerを重複させない。
9. 861 → 860pxのlate mobile-shell loadでも同じlifecycleが成立する。
10. desktop幅ではmobile shell / mobile keydown listenerを導入しない。

## rollback

`backup/ver311-before-mobile-keydown-v312`

## 次候補

Ver.313では、Ver.312後の`mobile-shell-v234.js`に残る長寿命listener / observer責務を再棚卸しし、既存回帰で必要性が立証済みのresize recoveryやsemantic board observerを壊さず、さらに安全にscope / lifecycleを縮小できる対象があるか監査する。