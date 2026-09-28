# Ver.313 Mobile shell long-lived responsibility audit

## Base

- Base checkpoint: Ver.312
- Base main SHA: `8a53715be205b9543c61a106f129f1919e836d79`
- release / baselineRelease: `277`
- Rollback: `backup/ver312-before-mobile-shell-long-lived-audit-v313`
- Product runtime is not changed in this audit.

## Scope

Ver.312でcreate-menu外側clickとEscape keydownを必要時だけ所有する形まで縮小したため、`mobile-shell-v234.js` に残る長寿命責務を再棚卸しする。

Ver.295〜302で独立に監査・製品化済みの以下は今回の縮小候補から除外する。

- `window.resize` によるboard tabs / header title / menu buttonのreconciliation
- `#boardView`直下 `.board-column` 変更だけを見るsemantic `MutationObserver`

一時的な `DOMContentLoaded` `{ once: true }`、mobile header自身のelement-local click handlers、Ver.310/312のtransient document listenersも長寿命候補には含めない。

## Remaining long-lived responsibility

除外後に残る実質的な長寿命責務は、Ver.308でdocument-wideから `.nav` rootへ縮小済みのnavigation delegationである。

```js
document.querySelector('.nav')?.addEventListener('click', event => {
  if (event.target?.closest?.('.nav-item')) {
    closeMobileMenu();
    syncMobileHeaderTitle();
    patchMobileBoardTabs();
  }
});
```

このlistenerはnavigationがmobile session中いつでも発生し得るため、create-menu / Escapeのような明確なopen/close lifecycleを持たない。さらに縮小するには各nav itemへの個別binding、routeごとのbind/unbind、またはnav DOM差し替え追跡が必要になり、現状より責務や再binding経路を増やす可能性がある。

## Evidence required

1. Mobile cold bootでnavigation delegationは `.nav` に1本だけ登録される。
2. `.nav` 外の通常clickではnavigation callbackは起床しない。
3. Tasks / Today / Schedule / dynamic Work Memoのnavigationを同じ `.nav` rootが処理する。
4. 代表的なview遷移後も `.nav` rootのDOM identityが維持される。
5. resize反復でnavigation listenerが再登録・重複しない。
6. 861 -> 860 late mobile-shell loadでもlistenerは1本だけ登録される。
7. Desktop cold bootではmobile shell自体が読み込まれず、このlistenerも所有しない。
8. Ver.310 transient outside-click、Ver.312 transient Escape、Ver.302 semantic observer、Ver.298 resize責務を変更しない。

## Decision rule

上記がすべて成立する場合、`.nav` delegationはすでに十分に局所化され、追加のlifecycle narrowingは複雑性に対して実利が小さいと判断する。Ver.313では製品コードを変更せず、mobile-shellの長寿命責務整理をここで一区切りとする。

失敗する場合のみ、nav root差し替えやlistener重複など実測された問題を対象に次の製品候補を設計する。

## Boundaries

- `mobile-shell-v234.js` を変更しない。
- `release-manifest.js` / `release-manifest.json` / baselineReleaseを変更しない。
- Firebase、task persistence、workflow、notification、業務データ書込経路を変更しない。
- Ver.304 Schedule handoff、Ver.308 nav scope、Ver.310 outside-click lifecycle、Ver.312 Escape lifecycleを維持する。

## Next gate

Protocol / Browser / Firebase Emulatorがgreenで、上記evidenceが成立した場合は、Ver.313をrelease 277の監査checkpointとする。次工程ではmobile-shellを無理に追加縮小せず、active runtime全体へ監査対象を戻して次の重複責務候補を選定する。
