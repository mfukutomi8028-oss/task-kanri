# Ver.508 — app.jsライフサイクル所有元の検証（Issue #292）

## 対象と結論

- 起点：正式Ver.507 main `91b364bfb55a39b80a09384da92c06f6e0aa61dd`。Ver.507 main側Regression 5/5、Pages build/deploy成功、復旧checkpoint identicalを確認。
- 前工程で作成した `Ver508_Lifecycle_Audit_Preflight.zip` のread-only監査と模擬4テストを参考に、GitHub最新mainの `app.js` に対する検査を実装した。模擬試験成功を製品試験成功として扱わない。
- `init()`、`setupEvents()`、`installScheduleTodayLifecycle()`、`startScheduleReminderWatcher()` は各1定義・1静的呼出箇所。唯一のモジュール末尾 `init()` から3監視関数をそれぞれ1回呼び出す。
- `document.visibilitychange` は予定の当日表示更新と予定リマインダーでそれぞれ1件（計2件）。`window.focus` と `window.pageshow` も各2件。`setupEvents()`の`document.dragend`と`document.drop`は各1件。全8件は異なる責務を持つ。
- 当日境界タイマーは`clearTimeout`してから再予約する設計。予定リマインダーには`state.scheduleReminderWatcherStarted`で二重起動防止がある。`app.js`本体には`setInterval`なし。
- 実行時の二重登録を裏付ける根拠が得られないため、**製品コードから監視処理を削除・統合しない**。

## 追加した検証（既存テストを緩和しない）

1. `test-harness/app-lifecycle-ownership-v508.test.mjs`：現行`app.js`の静的呼び出し、監視ごとの責務、当日タイマーの停止・再予約、リマインダー再入防止を確認。二重起動の疑似変異も検出する。
2. `tests/app-lifecycle-listener-singleton-v508.spec.mjs`：実Chromium上で`EventTarget.addEventListener`をページ初期化前から監査。`app.js`直接呼び出しに限定して8件が重複なく登録されることを確認。`focus`/`pageshow`/`visibilitychange`を5サイクル発火し、リロード後も8件のままであることを確認する。
3. `test-harness/README.md`：同検証の運用入口を追記。

## 検証方法と限界

- `npm run test:protocol` → Ver.508静的契約を含む全Protocol実行。
- `npm run test:ui -- --grep Ver.508` → Ver.508のブラウザ試験を実行（既存CIでは全UI試験を2-shardで実行）。
- Browser監査はapp.jsの**直接**登録（スタックの即時呼び出し元）だけを数える。他パッチ、SDK、動的文字列、すべてのタブやブラウザ拡張、動的import経路を含めた完全性証明ではない。
- 静的試験は実コードの名称・前後境界をピン留めした回帰契約であり、AST全解析ではない。コード移動や改名時は同等の責務とブラウザ検証を保って更新する。
- Firebaseはテスト用のlocal-onlyモードに固定し、本番データ・Firebase接続先への操作は行わない。

## 変更制約・受入

- **製品`app.js`/`style.css`、release304/manifest、Firebase Auth/Rules/Writer、業務データ、旧URL互換、Pagesビルダー/workflow、既存Browser/Firebaseテストの期待値・timeout・retryは不変更**。旧資産の削除なし。
- 公開パッケージはVer.507と同じ内容を保つ想定。Ver.507 Pages SHA-256基準：`c58b95e999c732e9c6abbeab4686bd727a02d31ed66dfdaf26d6c1f9069741c9`（156ファイル、13,057,029bytes）。main統合後にGitHub ActionsのSHA-256ログを照合して判定する。
- PR最終headでProtocol/Browser(1)/(2)/Firebase/Regression全成功 → expected-headでmain統合 → main同SHAの全回帰/Pages成功 → 復旧checkpointをmainとidentical照合したとき正式完了。
- セキュリティ改修は従来どおり保留。
