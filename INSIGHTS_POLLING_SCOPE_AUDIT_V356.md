# Ver.356 insights 60-second polling scope audit

## 起点

- Ver.355正式checkpoint: `8c0b0cf2011192fd0ecb82f76ae9d447aa989780`
- Release / baseline: 292
- 対象: `insights-v148.js`
- 監査段階では製品runtime・release・baseline・Firebase/業務データ書込経路を変更しない。

## 現行責務

`insights-v148.js` は `setInterval(schedule,60000)` を常設し、次を分単位で再評価する。

- タスク詳細の「作成から / 最終更新から / 期限まで」
- 7日以上更新されていないタスクの滞留badge
- Dashboardの担当負荷、自動アシスト、期限超過/滞留表示

そのため60秒timerの単純削除は行わない。現行はdocumentが非表示でもinterval ownershipを維持するため、可視状態にscopeを限定できるかを監査する。

## Candidate

製品sourceは変更せず、Playwright route上だけで以下のcandidateを比較する。

1. `setInterval(schedule,60000)` を撤去する。
2. 可視中は次の分境界までのone-shot `setTimeout` を1本だけ所有する。
3. 分境界で `schedule()` 後、次の分境界timerを再armする。
4. `document.hidden === true` ではtimerを解除する。
5. `visibilitychange` でvisibleへ戻った時は即 `schedule()` して取りこぼした経過時間を同期し、timerを再armする。
6. workflow update listener、`#mainContent` subtree MutationObserver、patchDetail / patchStale / patchDashboard、rAF coalescingは変更しない。

## 合格条件

- baselineが`insights-v148.js`由来60秒intervalを1本登録すること。
- candidateでは同intervalが0本で、visible時のminute timerは常に最大1本であること。
- hidden移行でminute timerが0本になること。
- visible復帰で即再同期し、minute timerが1本へ戻ること。
- visible中の分境界で詳細の相対時間表示が更新されること。
- hidden中はtimerを持たず、visible復帰時に経過分をcatch-upできること。
- 完全Regression / Firebase Emulatorが既存機能に回帰を出さないこと。

## 製品化判断

この監査がgreenの場合のみ、次工程で同lifecycleを製品runtimeへ反映する。製品化時は復旧branchを作成し、release/baseline更新と製品回帰契約を別工程で行う。
