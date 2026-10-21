# Ver.509 — 予定リマインダーのタイトル復元タイマー単独所有

## 不具合条件
Ver.508正式main `fc1f1bf822fdf5e4a9e54fd25f023b6c8813379b` の `app.js` では `flashReminderTitle()` 呼び出しごとに無条件で15秒の復元タイマーを追加していた。1回目の通知から15秒以内に次の通知が到着すると、旧タイマーが後続の通知タイトルを途中で消すうえ、最後に復元されるタイトルが1回目の通知文字列になる場合がある。

## 最小改修
- 既存 `flashReminderTitle()` のみ修正し、元のページタイトルと復元タイマーの所有元を1件に限定。
- 後続通知では既存タイマーを解除して最新通知の15秒後に再設定。最終的に通知前の通常タイトルへ復元する。
- 通知条件、通知既読状態、スケジュール保存、Toast、Beep、Firebase、Release、CSS、manifest、旧URLは変更しない。
- `test-harness/reminder-title-timer-v509.test.mjs`：Node vmの隔離時計で連続通知、通常復元、6連続通知でもタイマー1件を検証。既存テストの期待値・skip・timeout・retryは緩和しない。

## リスクと受入
同一通知でなく別通知が来ても最新通知が優先される仕様。ブラウザタブの外部スクリプトがdocument.titleを書き換えるケースや、ページ停止によるタイマー遅延は完全に保証しない。PR exact-headのProtocol、Browser (1)/(2)、Firebase Emulator、Regression全5 success後にmainへマージし、main同SHAの全回帰とPages build/deploy成功、SHA-256更新の記録、復旧checkpoint identicalを確認する。
