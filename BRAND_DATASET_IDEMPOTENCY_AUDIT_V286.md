# Ver.286 brand dataset idempotency audit

## Scope

Ver.285で `brand-v185.js` のpageshow recoveryを `event.persisted === true` のBFCache復帰だけへ縮小した後、persisted no-drift復帰でも `apply()` 末尾の `data-brand-version` 同値代入が残るかを監査した。

製品runtime、release 265、Firebase・業務データ経路は変更していない。

## Measured result

### Current product baseline

persisted=true のno-drift復帰では `apply()` は1回追加実行されたが、brand mark / favicon / Notificationの実変更は0件だった。

- brandWrites: 1 → 1
- iconAdds: 4 → 4
- iconRemoves: 3 → 3
- notificationWraps: 1 → 1
- datasetAssignments: 1 → 2
- datasetMutations: 1 → 2

つまり、no-drift BFCache復帰で残る実DOM変更は `data-brand-version = VERSION` の同値代入によるMutationRecord 1件だけだった。

### Counterfactual: conditional dataset assignment

`data-brand-version` を値が異なる場合だけ更新する反実仮想では、同じpersisted no-drift復帰後もcanonical状態が完全に一致したまま、dataset assignment / MutationRecordの追加は0件になった。

- applyCalls: 1 → 2
- datasetAssignments: 1 → 1
- datasetMutations: 1 → 1
- brand mark: canonical
- favicon: canonical 4-link set
- Notification brand: 185
- data-brand-version: 185

### Synthetic drift recovery

brand mark / favicon / Notification / data-brand-versionを同時にsynthetic driftさせた状態でpersisted=true pageshowを発火すると、条件付きdataset assignmentでも全項目をcurrentへ復旧できた。

- brandWrites: +1
- favicon: 4 links再構築
- notificationWraps: +1
- datasetAssignments: +1（実際に値が異なる場合のみ）
- final data-brand-version: 185

## Conclusion

`apply()` 自体とpersisted=true pageshow recoveryには独立した復旧価値があるため維持する。

一方、`data-brand-version` の無条件代入にはno-drift時の独立価値がなく、同値MutationRecordだけを生む。dataset assignmentは他のbrand補正と同じくidempotent化できる。

## Ver.287 product candidate

`brand-v185.js` のapply末尾だけを次の形へ変更する。

```js
if (document.documentElement.dataset.brandVersion !== VERSION) {
  document.documentElement.dataset.brandVersion = VERSION;
}
```

Ver.287では以下を維持する。

- startup apply 1回
- pageshowはpersisted=trueのみ
- brand mark / favicon / Notificationの既存idempotency
- actual dataset driftの復旧
- first-paint guard
- Firebase・業務データ経路

製品変更時はrelease / baselineReleaseを265から266へ進め、Ver.286 Browser監査を製品回帰へ昇格し、PR Regression、exact-head merge、main Regression、Pagesまで確認する。
