# Ver.362 final runtime interval inventory refresh

## Scope

Ver.361 / Release 295 を起点に、Ver.357・359・361で高頻度pollingを段階的に退役した後の active runtime について、`setInterval` owner を再棚卸しする。

この監査では製品runtime、Release、baselineRelease、Firebase・業務データ書込経路を変更しない。

## Result

Ver.355 時点では active JavaScript に interval 登録が7本残っていた。

その後、

- Ver.357: `insights-v148.js` の60秒pollingをone-shot lifecycleへ製品化
- Ver.359: `app.js` のSchedule Today 60秒pollingをnext-midnight one-shotへ製品化
- Ver.361: `app.js` のSchedule 15分前 reminder 30秒pollingをnearest-boundary one-shotへ製品化

したため、Ver.362時点の active interval 登録は **4本**となる。

### Remaining intervals

1. `completion-unpin-v150.js` ×1
   - 1500ms
   - local-only completion repair fallback
   - Ver.330で必要性を実ブラウザ確認済み

2. `reminders-v152.js` ×1
   - 30000ms
   - 個人確認リマインダーの時刻到達・表示状態更新
   - 今回の次監査候補

3. `inbox-events-v183.js` ×1
   - 1500ms
   - local-only inbox event detection fallback
   - Ver.333で必要性を実ブラウザ確認済み

4. `archive-ui-v182.js` ×1
   - 6時間
   - 90日超過完了タスクのauto archive reconciliation
   - 起床頻度が低く、現時点の削減優先度は低い

### Reconfirmed retired owners

以下は active runtime で interval-free を維持する。

- `app.js`
- `insights-v148.js`
- `dependencies-v149.js`
- `saved-views-v148.js`
- `work-features-v167.js`
- `mobile-shell-v234.js`

## Browser verification target

実ブラウザではFirebaseをlocal-only条件に固定し、interval登録元と周期を直接記録する。

期待値:

- `completion-unpin-v150.js`: 1500ms ×1
- `reminders-v152.js`: 30000ms ×1
- `inbox-events-v183.js`: 1500ms ×1
- `archive-ui-v182.js`: 21600000ms ×1
- `app.js`: 0
- `insights-v148.js`: 0

## Next candidate

次に監査価値が最も高いのは **`reminders-v152.js` の30秒polling**。

このintervalはデータ同期そのものではなく、主に次の時間境界を検知している。

- `item.at` 到達時のtoast / Notification
- `item.at - 24h` での「24時間以内」表示切替
- 日付跨ぎによるToday欄への表示・`今日 HH:mm` 表示切替

また、reminderデータ更新自体は `workflow-v150-update` / `workflow-v152-update`、DOM MutationObserver、保存直後のpatch経路で即時reconciliation可能な構造を持つ。

したがって次工程は **Ver.363 `reminders-v152.js` 30秒polling scope audit** とする。

単純に通知時刻だけへone-shot化すると日付跨ぎや24時間境界を落とすため、監査では製品runtimeを変更せず、少なくとも以下を実測する。

- nearest `item.at` 到達通知
- `item.at - 24h` のstate切替
- local midnightでToday欄と`今日`表示が更新されること
- workflow更新・保存・解除・ユーザー切替後のre-arm
- hidden/background中も通知タイマーを失わないこと
- focus / pageshow / visible復帰時のcatch-up
- timer ownershipが常に1本へ収束すること

安全性が確認できた場合のみ、後続versionで製品化する。
