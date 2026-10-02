# Ver.355 Final Runtime Wakeup Inventory Refresh

## 目的

Ver.354で `comment-reactions-v191.js` の長寿命listener / MutationObserver整理まで完了したRelease 292を起点に、active JavaScript runtimeのwakeup ownerを再棚卸しした。

この監査では、静的な登録数が多いという理由だけで既にlifecycle化・semantic化済みのownerを再候補化しない。document/window listener、MutationObserver、interval、timeout、requestAnimationFrameの現在値を機械集計したうえで、各責務の時間依存性・UX回復・順序保証・接続復旧を確認し、次の単独監査対象を実装根拠から選定する。

製品runtime、Firebase / 業務データ書込経路、release / baselineReleaseは変更しない。

## 基準点

- base main: `d1a5864e8d539bc150ec14ae11ae26b7d179732b`
- release manifest: 292
- baselineRelease: 292
- audit branch: `test/final-runtime-inventory-v355`
- PR: #256

## Release 292 active runtime集計

`release-manifest.js` の `dynamicScripts` / `mobileScripts` と `release-manifest.js`、`app.js`、`config.js` を対象に、active JavaScriptだけを再集計した。

| owner種別 | Ver.355 |
| --- | ---: |
| MutationObserver | 26 |
| document addEventListener | 48 |
| document removeEventListener | 7 |
| window addEventListener | 24 |
| window removeEventListener | 0 |
| media-query addEventListener | 1 |
| setInterval | 7 |
| setTimeout | 43 |
| requestAnimationFrame | 31 |

Ver.345の記録値と比較すると、document addは50→48、document removeは6→7となった。これはVer.347〜352でcomment-reactionsの常設document keydown / submit / click責務を固定 `#detailBody` とpicker-open lifecycleへ縮小した結果と整合する。他の総数だけを根拠に追加削除は行わない。

## 直近整理済みscopeの再確認

以下は現行runtimeで監査済み境界が維持されているため、静的件数だけで再候補化しない。

- `list-column-sort-v229.js`
  - `#sortSelect` direct input
  - `#listView` local delegation
  - direct-child + semantic MutationObserver
- `desktop-sidebar-v242.js`
  - document keydown / dragend / dropはdesktop・expanded・unpinned時だけ所有
  - intervalなし
- `comment-mentions-v191.js`
  - Escape listener lifecycle
  - semantic detail observer
- `comment-reactions-v191.js`
  - keydown / submit / local clickは固定 `#detailBody`
  - document clickはreaction picker open中だけ所有しclose時に解除
  - detail observerはcanonical comment surfaceだけを再patch対象にする
- `work-features-v167.js`
  - intervalなし
  - midnightはone-shot timeout
  - dialog observerは `open` attributeへ限定
- `mobile-shell-v234.js`
  - create-menu outside click / Escapeはlifecycle ownership
  - board observerはdirect-child + semantic
  - intervalなし

## 現在残る7本のinterval

### 既に監査済み・または時間責務が明確なもの

- `completion-unpin-v150.js`: 1本
  - Ver.330でlocal-only canonical cache変更をeventだけでは捕捉できないことを実ブラウザ確認済み。1500ms fallbackを維持する。
- `inbox-events-v183.js`: 1本
  - Ver.333でlocal-only task更新をpollが検出する責務を実ブラウザ確認済み。1500ms snapshot pollを維持する。
- `reminders-v152.js`: 1本 / 30秒
  - reminder指定時刻到達時の画面・Notification通知そのものを担う時間依存owner。単純撤去候補にしない。
- `insights-v148.js`: 1本 / 60秒
  - 「更新から○分」「期限まであと○分」等の相対時間表示・stale判定を分単位で更新する時間依存owner。単純撤去候補にしない。
- `app.js`: 2本
  - Schedule Todayの日付同期とschedule reminder時刻監視を担うcore時間責務。sidecarの不要起床候補を先に監査する。

### 新しい単独監査候補

`archive-ui-v182.js` の1本:

```javascript
setInterval(autoArchive, 6 * 60 * 60 * 1000);
```

`autoArchive()` は「完了から90日を超え、未archive・未duplicateのタスク」を最大20件ずつ自動アーカイブする。起動時には `setTimeout(autoArchive, 2500)` もあり、以後6時間ごとに全task mapから対象を再探索する。

この責務は30秒reminderのような秒・分単位の即時性を要求せず、閾値は90日である。さらにworkflow task更新イベントやpageshow / visibility復帰など、より狭いreconciliationへ置換できる可能性がある。一方、ブラウザを長時間開きっぱなしにして90日境界を跨ぐケースでは時間起点の補正が必要なため、単純削除はしない。

## Ver.356で確認すること

Ver.356は `archive-ui-v182.js` の6時間pollingだけを監査対象とする。

- 起動時auto archiveが維持されること
- 90日超の既存完了taskが確実にarchiveされること
- 90日境界を開いたまま跨ぐケースで取りこぼさないこと
- canonical task更新後のarchive eligibilityが反映されること
- tab復帰 / pageshow等で長時間sleepから復旧できること
- manual archive / restore / duplicate mergeを壊さないこと
- polling callbackが不要な状態で繰り返し起床しない代替案を比較すること
- Firebase expected-base / archive transaction境界を変更しないこと

監査段階ではruntime・release 292・baselineRelease 292を変更しない。安全なcandidateが実ブラウザで成立した場合のみ、その後の製品化工程へ進む。

## 結論

Ver.355の全runtime再棚卸しでは、直近に整理したlistener / observer境界の後戻りは確認されなかった。残るinterval 7本のうち、既監査済みfallbackまたは時刻通知・相対時間表示という明確な時間責務を除外すると、次に独立して削減価値を検証すべき対象は `archive-ui-v182.js` の6時間auto-archive pollである。

したがって次工程を **Ver.356 archive auto-archive polling audit** とする。