# Ver.358 Schedule Today 60-second polling scope audit

## 起点

- Ver.357正式checkpoint: `4234e26a8b79c4f721c3af90ed00e3dac0cd372e`
- Release / baseline: 293
- 対象: `app.js` の `installScheduleTodayLifecycle()`
- 監査段階では製品runtime・release・baseline・Firebase/業務データ書込経路を変更しない。

## 現行責務

Schedule Today は `scheduleRange === "today"` のとき `scheduleAnchor` を当日に固定する。
現行lifecycleは初期同期に加えて、`pageshow`、`focus`、visible復帰で同期し、さらに `setInterval(sync, 60 * 1000)` を常設している。

この60秒pollingは日付跨ぎ補正を目的としているため単純削除は行わない。一方、実際に状態が変わる時刻境界は原則として1日1回の深夜0時であり、常時1分ごとの起床が必要かを監査する。

## Candidate

製品sourceは変更せず、Playwright route上の `app.js` だけで以下のcandidateを比較する。

1. `setInterval(sync, 60 * 1000)` を撤去する。
2. visible中は次のローカル日付境界（0:00）までのone-shot `setTimeout` を1本だけ所有する。
3. 日付境界timer発火時に `sync()` してToday anchorを更新し、次の日付境界timerを再armする。
4. hidden移行時はday-boundary timerを解除する。
5. visible復帰、focus、pageshowでは即 `sync()` して経過した日付境界をcatch-upし、timerを1本だけ再armする。
6. Schedule Todayのanchor固定、prev/next無効化、render責務、Firebase・業務データ書込経路は変更しない。

## 合格条件

- 現行製品sourceは60秒intervalを保持したままであること。
- candidateでは `app.js` 由来のSchedule Today 60秒intervalが0本になること。
- visible時のday-boundary timerは常に最大1本であること。
- hidden移行でday-boundary timerが0本になること。
- visible復帰、focus、pageshowを重ねてもtimer ownershipが1本を超えないこと。
- 23:59台から日付境界を跨いだtimer発火で `scheduleAnchor` が新しい当日に更新されること。
- hidden中に日付境界を跨いでもtimerは発火せず、visible復帰時に即catch-upできること。
- Protocol / Browser Regression / Firebase Emulatorがgreenであること。

## 製品化判断

この監査がgreenの場合のみ、次工程で同lifecycleを製品runtimeへ反映する。製品化時は別の復旧branchを作成し、release / baselineを294へ更新し、Ver.358 browser監査をcandidate transformなしの製品回帰へ昇格する。
