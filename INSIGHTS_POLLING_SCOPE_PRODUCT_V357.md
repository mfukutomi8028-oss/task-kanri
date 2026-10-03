# Ver.357 insights minute polling lifecycle product

## 起点

- Ver.356正式checkpoint: `a1a4aca3650b72df89aa38471849189f9293c916`
- Ver.356 audit head: `3a60735f6334662cf8ba807b9d866b142587d602`
- 対象: `insights-v148.js`
- Release / baseline: 292 → 293

## 製品反映

Ver.356でProtocol・Browser Regression・Firebase Emulatorまで確認したvisibility-scoped lifecycleを製品runtimeへ昇格する。

1. 常設 `setInterval(schedule,60000)` を撤去する。
2. visible中だけ次の分境界までのone-shot `setTimeout` を1本所有する。
3. 分境界では `schedule()` を実行後、次の分境界timerを再armする。
4. hidden移行時はowned timerを解除する。
5. visible復帰時は即 `schedule()` して経過時間表示をcatch-upし、timerを1本だけ再armする。

## 維持する責務

- `workflow-v148-update` listener
- `#mainContent` subtree MutationObserver
- `patchDetail / patchStale / patchDashboard`
- requestAnimationFrame coalescing
- Firebase / 業務データ書込経路

今回の変更はtimer ownershipだけに限定し、タスク内容・状態・保存方式・通知・依存関係などの業務ロジックは変更しない。

## 回帰契約

- 製品sourceに60秒intervalが残らないこと。
- visible時のminute timerが常に最大1本であること。
- hidden時はminute timerが0本になること。
- visible復帰で即時再同期しtimerが1本へ戻ること。
- 分境界で詳細の相対時間表示が更新されること。
- Release / baselineが293で一致すること。
- Protocol / Browser Regression / Firebase Emulator / Pagesがgreenであること。

## 次工程

Ver.357製品化が正式checkpointになった後、Ver.358でactive runtime wakeup inventoryを再実行し、Ver.355で唯一残っていたduration-based continuous wake-upが解消されたことを確認する。icon/comments等のevent-path bounded one-shotは必要責務として区別し、新たな削減候補は実測根拠がある場合だけ選定する。
