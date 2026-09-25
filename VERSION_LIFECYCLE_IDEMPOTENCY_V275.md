# Ver.275 version lifecycle idempotent化

## 目的

Ver.274監査で、`config.js` のversion同期が正常状態でも同値DOM書込を繰り返し、300ms / 1200ms timerには独自の復旧価値が確認できないことを実測した。

Ver.275では監査結論に限定して、version lifecycleの不要な再適用だけを削減する。

## 変更

- `setTimeout(setVersion, 300)` を撤去
- `setTimeout(setVersion, 1200)` を撤去
- `WORK_BOARD_RELEASE_VERSION` / `WORK_BOARD_VERSION` は値が異なる場合だけ更新
- legacy `app-version` classは存在する場合だけremove
- `workboard-version-display` classは不足時だけadd
- version text / title / `data-release-version` は差分がある場合だけ更新
- `start()` のpre-load / post-load `setVersion()` 2回は維持
- `focus` / `pageshow` recoveryは維持
- release / baselineReleaseを260へ更新

## 維持する理由

Ver.274ではfocusとpageshowがそれぞれ単独で、syntheticに壊したversion DOMとglobal stateをcurrent releaseへ完全復旧できた。

一方、通常navigationではversion lifecycle call自体が0だったため、新しいnavigation hookは追加しない。

`start()`後半の2回目の直接同期も通常bootではno-driftだったが、asset loader境界後の安全網まで同時に除去する根拠はないため、今回の製品変更では維持する。idempotent化により正常時のDOM churnは発生しない。

## Browser acceptance

- 300ms / 1200ms version timer登録が0
- 起動時にstatic legacy versionからVer.260へ収束
- no-drift focus / pageshowは各1回のrecovery checkを実行してもDOM mutation 0
- synthetic drift後はfocus / pageshowのどちらでもversion text / semantic class / title / dataset / globalsをVer.260へ復旧
- Tasks → Today等の通常navigationではversion lifecycle call / mutation 0

## 非変更

- Firebase初期化・保存・同期・transaction境界
- 業務データ構造
- `release-manifest.js` first-paint互換の責務
- version表示CSS ownership
- retired `version-display-lock.js` のinactive状態
- `config.js` のasset loader / mobile loader / brand bootstrap責務

brand bootstrapについては今回の変更に含めず、Ver.276監査で `config.js::patchBrandIcons()` と `brand-v185.js` の起動時責務重複を別途実測する。
