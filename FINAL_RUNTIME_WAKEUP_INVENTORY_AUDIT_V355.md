# Ver.355 final runtime wakeup inventory refresh

## Scope

Ver.354 / Release 292 を起点に、active runtime の長寿命 wakeup owner を再棚卸しした。監査対象は MutationObserver、document/window listener、media-query listener、setInterval、setTimeout、requestAnimationFrame。

この監査では製品 runtime、release、baselineRelease、Firebase・業務データ書込経路を変更しない。

## Result

Protocol / Browser / Firebase Emulator はすべて green。

Static active-runtime totals:

- MutationObserver: 26
- document addEventListener: 48
- document removeEventListener: 7
- window addEventListener: 24
- window removeEventListener: 0
- media-query listener: 1
- setInterval: 7
- setTimeout: 43
- requestAnimationFrame: 31

Ver.345 の静的総数と同値だが、これは回帰を意味しない。Ver.346〜354では、常設document listenerを固定rootまたはopen中だけのtransient listenerへ変更し、subtree observerをsemantic filterへ狭めるなど、statement数を変えず実際の起床条件を縮小した。Ver.355 Browser auditで、その縮小状態が現行runtimeでも維持されていることを確認した。

## Reconfirmed cleaned owners

- `saved-views-v148.js`: `#sortSelect` direct input owner。document-wide input/changeとpollingは退役済み。
- `list-column-sort-v229.js`: fixed `#listView` click/keydown delegation、direct-child semantic observer。document-wide delegationとsubtree ownershipは退役済み。
- `dependencies-v149.js`: 60秒pollingは退役済み。
- `work-features-v167.js`: interval-free。既監査済みobserver境界とone-shot date boundaryを維持。
- `mobile-shell-v234.js`: interval-free。outside-click/Escapeはtransient lifecycle ownershipを維持。
- `comment-reactions-v191.js`: click/submit/keydownはfixed `#detailBody`。picker closed時はdocument click owner 0、open中だけoutside-click ownerを取得。MutationObserverはVer.354 semantic filterを維持。

## Remaining intervals

7 registrations remain in active JavaScript:

1. `app.js` ×2
   - Schedule Today date rollover reconciliation (60s)
   - schedule reminder watcher (30s)
2. `insights-v148.js` ×1
   - timing/stale/dashboard insight refresh (60s)
3. `completion-unpin-v150.js` ×1
   - local-only completion repair fallback (1500ms); Ver.330で必要性を実ブラウザ確認済み。
4. `reminders-v152.js` ×1
   - personal reminder due-time detection (30s)
5. `inbox-events-v183.js` ×1
   - local-only inbox event detection fallback (1500ms); Ver.333で必要性を実ブラウザ確認済み。
6. `archive-ui-v182.js` ×1
   - 90日超過完了タスクのauto archive reconciliation (6h)

※ app.js が2本のため、ファイル数は6、interval登録数は7。

## Conclusion / next candidate

新たな削減候補として最も監査価値が高いのは `insights-v148.js` の60秒interval。

理由:

- completion-unpin / inbox-events は既存監査でlocal-only fallbackとして必要性が実証済み。
- schedule reminder / personal reminder は時刻到達そのものが機能入力。
- Schedule Todayは日付跨ぎ補正を所有する。
- auto archiveは6時間周期で起床頻度が低い。
- insightsは60秒ごとに `schedule()` → `patch()` を常時呼び、detail/stale/dashboardの複数surfaceを横断する一方、各surfaceが非表示・不存在でもtimer自体は継続する。時間表示更新は必要でも、常時全surface refreshが必要かは未監査。

次工程は **Ver.356 `insights-v148.js` 60秒polling scope audit** とする。監査では製品runtimeを変更せず、少なくとも以下を実測する。

- dashboard/detail/task surfacesが非表示のidle時にtimer callbackが実作業を発生させるか
- minute-based表示（更新なし、期限まで、作成/更新経過）が60秒pollingなし・またはvisibility scoped schedulingでも正しく更新できるか
- workflow update / DOM rerender / navigationで即時reconciliationが維持されるか
- day/minute boundaryとbfcache/visibility復帰で表示がstaleにならないか

実測で安全性が確認できた場合のみ、後続versionで製品化する。
