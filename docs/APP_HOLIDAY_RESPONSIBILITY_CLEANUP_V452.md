# Ver.452 — app.js祝日曜日計算の重複責務を最小整理

Issue #292 / Stage F。起点はVer.451正式main `3d3bb5fa964e4c167ac02376a8a42d518f58d5c2`。Ver.451同SHAのRegression/Pages/復旧checkpointは成功確認済み。

## 変更
- `getJapaneseHolidayName` と `buildJapaneseHolidayMap` 内の重複したローカル `nthMonday` 二箇所を `getNthMondayDayOfMonth(year, month, nth)` 一箇所へ統合。
- 呼び出し対象は成人の日（1月第2月曜）、海の日（7月第3月曜）、敬老の日（9月第3月曜）、スポーツの日（10月第2月曜）のみ。
- 既存 `getNthWeekdayOfMonth` はタスクの月次繰り返し専用として変更せず、祝日と繰り返し予定の依存は混ぜない。
- 祝日固定日、春分/秋分、振替休日、国民の休日、年間キャッシュ、ローカル日付変換の実装は不変。今後の法改正・過去年の祝日制度の正確性を今回保証するものではない。
- Firebase、Rules/Auth、保存処理、UI、manifest Release304、Pages配布資産、既存旧URL/PNG、CSSは不変。

## 検証と受入条件
- `tests/holiday-nth-monday-v452.spec.mjs`：新旧月曜算式が1900〜2100年・4祝日で一致すること、祝日マップの各該当日ラベルが一致すること、振替休日の一例、既存キャッシュと主要固定日を検証。
- Dateは別Realmだと `instanceof Date` が異なるため、独立VM内でDateを生成する。テストはアプリを起動せず、本番Firebaseへ接続しない。
- PR latest exact-headのProtocol/Browser両shard/Firebase/Regressionを全成功させる。失敗時はDraftのまま修正。mainへの正式受入前にmainの更新有無を再確認。
- expected-headでマージ後、同SHAのmain Regression/Pages全successとcheckpoint ref再取得・同一比較を確認して初めて正式完了。

## 残件
`app.js` にはタスク更新、予定、個人ToDo、UIなど多責務がある。今回の小整理は全体的な責務分離の完了を意味しない。旧PNG8件、保持文書11件は復元・キャッシュ互換の理由で維持。Security Issue #368は保留。
