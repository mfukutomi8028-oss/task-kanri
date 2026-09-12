# stable-fixes-v108.js 責務監査（Ver.195 / Ver.196追記）

## 結論

`stable-fixes-v108.js` は単純な旧パッチではなく、現在も複数の安全補正を担当しています。一方、`mobile-fixes.js` にも同系統の実装が残っているため、Ver.195では分割・退役を行わず、重複責務と不足テストを先に固定しました。

Ver.196では、その安全網を前提に **スケジュールの「7日間」ラベル補正だけ** を最初の移管対象とします。`stable-fixes-v108.js` から当該処理を外し、既存の `schedule-today-lock-v129.js` が `#scheduleView` 内で所有します。

## 責務状況

| 責務 | Ver.195時点 | Ver.196判断 |
| --- | --- | --- |
| モバイル状態タブの横スクロール | `stable-fixes-v108.js` と `mobile-fixes.js` の二重系統 | 現状維持。別工程 |
| 基本状態の削除保護 | stable/mobileに同じ基本状態集合とガード | 現状維持。次の監査候補 |
| 日付/date-time min/max・年桁制限 | stable/mobile/date-keyboardの三者境界 | 現状維持。別工程 |
| スケジュール7日間ラベル | stableとmobileに表示補正 | **stableから削除し、schedule-today-lockへ移管**。mobile側の既存互換補正は今回は触らない |
| Todayの状態・担当者フィルタ | stableのmine/group判定とmobileの状態除外が近接 | 現状維持。別工程 |
| バージョン表示fallback | stable + version-display-lock | Ver.194で番号正本競合解消済み |
| 動的DOM追従 | stable/mobileがbody全体Observer | 現状維持。十分な安全網後に判断 |

## Ver.195で追加した安全網

1. **動的に追加されたdate/datetime-localにも1900〜9999制約が付くこと**
2. **Todayフィルタの状態判定マーカー**
   - `保留`
   - 「空き時間」の `確認待ち`
   - mine/group担当者判定
3. **モバイル状態タブの独自 `scrollIntoView()` 契約**
   - ページ縦スクロールではなくタブ行の `scrollLeft` を調整すること

Ver.195 mainでは Protocol 61 / UI 63 / Firebase Emulator 19 と Pages がすべてgreenになっています。

## Ver.196の移管内容

### `stable-fixes-v108.js`

削除する責務は次の2点だけです。

- `patchScheduleRangeLabel()`
- `applyFixes()` 内の `patchScheduleRangeLabel()` 呼出し

基本状態保護、日付制約、Todayフィルタ、モバイル状態タブ、バージョンfallback、body全体Observerは変更しません。

### `schedule-today-lock-v129.js`

既存の `#scheduleView` 限定Observerをそのまま利用して、次の補正を所有します。

- `[data-schedule-range="week"]` の表示を `7日間` に統一
- tooltipを `今日から7日間を表示します` に統一

**新しいMutationObserverは追加しません。** Today固定処理と同じschedule feature境界の中へ表示補正を戻すだけです。

### `mobile-fixes.js`

今回は変更しません。同ファイルに残る7日間ラベルの互換補正は、モバイル全体の責務整理とは切り離して後続工程で評価します。同一工程で両側を削ることはしません。

## Ver.196で変更しないもの

- `mobile-fixes.js`
- `date-keyboard-fix-v127.js`
- `list-sort-v131.js`
- Todayフィルタ
- 基本状態保護
- Firebase書込経路
- dynamic assetの個数とロード順

## 次の判断条件

Ver.196が PR CI と main の Regression / Pages でgreenになった後、次候補として **基本状態の削除保護** を監査します。

`app.js` 自身の状態管理を正本へ寄せられるかを先に契約化し、stable/mobileの二重ガードを一度に削除しません。日付制約、Todayフィルタ、body全体MutationObserverはそれぞれ別工程で扱います。
