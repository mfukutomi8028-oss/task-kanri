# Ver.345 Final Runtime Wakeup Inventory Audit

## Purpose

Release 288 / baselineRelease 288 を起点に、Ver.325以降のObserver・listener・timer整理を反映したactive JavaScript runtimeを再棚卸しする。

この工程は監査onlyであり、製品runtime、release値、Firebase経路、業務データ書込経路は変更しない。

## Method

`release-manifest.js` の active `dynamicScripts` / `mobileScripts` と、bootstrap側の `release-manifest.js` / `app.js` / `config.js` を対象に、次の静的ownerを再集計した。

- `MutationObserver`
- `document.addEventListener` / `document.removeEventListener`
- `window.addEventListener` / `window.removeEventListener`
- media-query listener
- `setInterval`
- `setTimeout`
- `requestAnimationFrame`

あわせて、直近で整理した長寿命ownerは単純な登録数だけで再候補化せず、現在のlifecycle / semantic scopeをProtocolで確認した。

## Release 288 inventory

Ver.345集計値は以下。

```json
{
  "mutationObservers": 26,
  "documentAdds": 50,
  "documentRemoves": 6,
  "windowAdds": 24,
  "windowRemoves": 0,
  "mediaAdds": 1,
  "intervals": 7,
  "timeouts": 43,
  "animationFrames": 31
}
```

この集計は `release-manifest.js` 自身も含む。Ver.325の旧集計は同ファイルを対象外にしていたため、総数だけをVer.325と直接比較して増減判定しない。静的な`addEventListener`個数も、open中のみbindする実装と常設listenerを区別できないため、個別ownerのlifecycleを併せて評価する。

## Re-audited recent owners

### `list-column-sort-v229.js`

Ver.344の製品境界を維持している。

- primary sortは固定`#sortSelect`のdirect `input`
- column click / keyboardは固定`#listView`へ限定
- Observerは`#listView`直下`childList`のみ
- canonical `table.task-table`追加時だけ再enhance
- document-wide input/change/click/keydownへ戻っていない

再監査候補には戻さない。

### `desktop-sidebar-v242.js`

Ver.324のlifecycleを維持している。

- document `keydown` / `dragend` / `drop`はdesktop・expanded・unpinned時だけ所有
- close/collapse/pin/mobile境界で3listenerを解除
- body-wide Observerなし
- intervalなし

静的`documentAdds`だけを理由に再監査候補には戻さない。

### `comment-mentions-v191.js`

Ver.327 / Ver.329の製品境界を維持している。

- Escape keydownはmention picker open中だけbindしclose時に解除
- `#detailBody` subtree Observerはsemantic comment/mention surfaceだけを再走査
- unrelated detail mutationを無条件rescanしない

再監査候補には戻さない。

### `work-features-v167.js`

Ver.315 / Ver.316で確認済みの長寿命責務を維持している。

- intervalなし
- 日付境界は次の深夜までのrecursive one-shot timeout
- task dialog Observerはcanonical `open` attribute限定
- core DOM Observerはmemo-owned-only mutation batchを除外

現時点で追加削減を正当化する新証拠はない。

### `mobile-shell-v234.js`

Ver.300〜312の製品境界を維持している。

- board Observerは固定`#boardView`直下`childList`＋`.board-column` semantic change
- create-menu outside clickはopen中のみbind
- Escape keydownはdrawer/create-menu open中のみbind
- navigationは`.nav` rootへ限定
- intervalなし

再監査候補には戻さない。

## New isolated candidate

再棚卸しで、`comment-reactions-v191.js` に次の長寿命ownerが残っていることを確認した。

- `#detailBody` subtree `MutationObserver` 1本
- document listener 5登録、対応するdocument removeなし
- そのうち常設`document keydown`は、コメントUI外のkeydownでもcallbackが起床する

ただしkey handlerは単純なEscape専用ではない。

1. `Escape`でreply modeとreaction pickerを閉じる
2. `Ctrl/⌘ + Enter`で通常コメント / reply formをsubmitする

このため、mention pickerのように「reply/picker open中だけbind」へ単純変更すると、通常コメントの`Ctrl/⌘ + Enter`送信を失う可能性がある。

一方、対象UIとtextareaは固定`#detailBody`配下にあり、`start()`も固定`#detailBody`を既にrootとして取得している。したがって次工程は、**document常設keydownだけを固定`#detailBody`へのdirect keydown bindingへ縮小できるか**を独立監査する。

## Ver.346 audit boundary

次工程では `comment-reactions-v191.js` のkeydown scopeだけを対象とする。

確認項目：

- reaction-owned keydownが`#detailBody`へ1本だけ登録されること
- `#detailBody`外の無関係keydownでreaction/reply責務が起床しないこと
- Escapeでreply cancelが維持されること
- Escapeでreaction picker closeが維持されること
- `Ctrl/⌘ + Enter`で通常コメント送信が維持されること
- `Ctrl/⌘ + Enter`でreply送信が維持されること
- detail再描画 / reopen後もbindingが有効なこと
- Firebase / comment / reply / reaction write boundaryが不変であること

次の責務は別工程とし、Ver.346では変更しない。

- document click delegation
- document submit delegation
- `#detailBody` subtree MutationObserver
- Firebase・業務データ書込

## Conclusion

Ver.345では製品runtimeを変更する必要はない。

最近整理したlist column sort / desktop sidebar / mentions / work features / mobile shellは、現在も監査済みscopeを維持している。次の単独監査候補は `comment-reactions-v191.js` の常設document keydown scopeとする。

Release / baselineReleaseは **288のまま** とする。
