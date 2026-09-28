# Ver.310 create-menu outside-click lifecycle productization

## 目的

Ver.309監査でProtocol / Browser / Firebase Emulatorの同等性を確認したcreate-menu外側click listenerのlifecycle narrowingを製品runtimeへ反映する。

## 製品変更

- `mobile-shell-v234.js` の常時document-level outside-click listenerを撤去する。
- outside-click listenerは **menu open 中だけ** `document` に登録する。
- menu close時はlistenerを解除する。
- outside click、Escape、Task/Schedule create handoff、mobile menu buttonによるclose経路はいずれも`closeCreateMenu()`を通し、listenerを解除する。
- 同一状態への再設定はno-opとし、open/close反復でlistenerを重複させない。
- release manifest / `baselineRelease` を 275 → 276 へ更新する。

## 維持する境界

- `document` のkeydown/Escape listenerはVer.310では変更しない。
- Ver.308 `.nav`-scoped navigation delegationと同期reconciliation順序を維持する。
- Ver.304 Schedule create同期handoffを維持する。
- board observer、resize reconciler、860/861px conditional late loaderを維持する。
- Firebase、task persistence、workflow、notification、業務データ書込経路は変更しない。

## 製品回帰

Ver.309の監査candidateではなく、製品`mobile-shell-v234.js`そのものに対して以下を確認する。

- menu閉鎖中はoutside-click callbackが存在しない。
- menu open時だけlistenerを1本登録する。
- header内clickではmenuを維持する。
- header外clickでmenuを閉じlistenerを解除する。
- Escapeでmenuを閉じlistenerを解除する。
- Schedule createでlistenerを解除しcanonical dialogを開く。
- 3回のopen/closeでもlistener重複がない。
- 861 → 860pxのlate mobile-shell loadでも同じlifecycleが成立する。
- desktop幅ではmobile-shell / mobile listenerを導入しない。

## rollback

`backup/ver309-before-create-menu-outside-click-v310`

## 次候補

Ver.311では、`ensureMobileHeader()`に残るdocument-level keydown(Escape) listenerを監査し、mobile drawer / create menuが開いている間だけのlifecycleへさらに限定できるか確認する。
