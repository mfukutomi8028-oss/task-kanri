# Ver.377 タイムライン完了状態の整合修正（候補）

対象: Issue #282。基準main: `3cbecffc980e54c4fdf66958a7c76290caa0552f`。Release/baseline候補: **303/303**。本書は正式公開・全テスト成功を宣言するものではない。

## 発見した不一致

`getFilteredTasks()` は `scopeHasDone()`（done, mineDone）または詳細状態 `完了` を認識して完了タスクを抽出する。一方 `renderTimeline()` は `state.scope === "done"` だけで行を選んでいた。このため mineDone の期限付き完了タスクは、抽出済みなのにタイムラインの状態行に載らない。期限なしは別領域に描画され、表示が不統一になる。同条件を扱う `renderBoard()` はすでに `scopeHasDone() || isCompletedStatus(elements.statusFilter.value)` へ修正済み。

## 最小修正

`app.js` の `renderTimeline()` に、ボードと同じ `completedView` 判定を適用する。それ以外のタスク抽出、タスク保存、Firebase通信、drag/drop、日付処理、状態管理、一覧/ボードUIは変更しない。

`test-harness/timeline-completion-v377.test.mjs` は実際の `getFilteredTasks()` と `renderTimeline()` をNode VMで動かし、4 scope（all/mine/done/mineDone）×3詳細状態（なし/完了/未着手）×2範囲（14日/月）= **24条件**について、タイムラインの状態行と当日タスクを抽出結果に照合する。期限なし完了と表示期間外の扱いも検証する。加えてボードと共通の状態判定を静的契約にする。

## 受入と未確認事項

本ローカル作業環境からの全アプリPC/390pxブラウザ試験、Protocol全件、Firebase Emulator試験は、PRのCI実行前段階では未確認。CIでこの新規Node試験・既存Protocol / Browser / Firebase Emulatorをすべて通すこと。実際のPC/390pxタイムライン操作については追加の全アプリE2E確認を必要とする。実本番Firebaseの業務データは扱わない。

PRのexact-headで3系統CI success、最新main再確認、exact-head merge、merge後main Regression・Pages build/deploy success、Release/baseline **303/303**、復旧checkpointのSHA照合を満たした場合だけIssue #282を閉じる。いずれか不達なら正式採用しない。直前の復旧地点 `backup/ver375-ci-hardening-checkpoint` は維持。
