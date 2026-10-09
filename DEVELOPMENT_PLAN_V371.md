# Ver.371 開発判断・通知操作の復旧性改善

更新日：2026-10-09。これは製品全体の次工程を管理する計画兼変更記録であり、Ver.371の正式完了を宣言するものではない。実際の完了状態はPR、exact commitのCI、Pages、checkpointで確認する。

## 1. 正式な起点

- Ver.370 main：`364b96a15ca1f32360286fbe145300df547d36e3`
- PR：#276。head `f540120e49d0dd2ea87809feba94c557030fcc14` を指定したexact-head merge済み。
- main Regression：run `37868879088`、Protocol / release-contract・Browser Regression・Firebase Emulatorすべてsuccess。
- Pages：run `37868879077`、build / deploy success。
- Release / baselineRelease：297 / 297。
- 正式復旧地点：`backup/ver370-checkpoint`。同じmain SHAを指すことを再取得確認。
- Ver.371変更前復旧地点：`backup/ver370-before-v371-inbox-retry`。
- Ver.371作業ブランチ：`fix/ver371-inbox-read-feedback`。

## 2. 開発方針の切替

製品の目的は業務の把握・共有・実行を簡単にすることであり、Observer・timer・listenerをゼロにすることではない。少人数で扱いやすい操作を維持し、利用者数を2人に固定しない。既存の名称・左メニュー・保存正本を無関係に変更しない。

構造整理は次の条件を満たした範囲でいったん区切る。

1. 監査済みの復旧・同期・競合保護が回帰テストで維持される。
2. フリーズ、自己誘発の無限更新、データ破壊などの再現可能な重大問題がない。テスト未実施の領域まで問題なしとは断定しない。
3. 追加整理に、利用者への影響または計測された性能・保守上の改善根拠がない場合は優先順位を下げる。

Ver.370で記録されたFavorite Observerの保守的なtarget-boundaryは復旧のため維持する。さらなる削減を既定の次工程にしない。

`patch-responsibilities.json` の `priorityCandidates` にあるVer.355 inventory項目は過去の監査経緯が残ったもので、現在の製品ロードマップとしては使わない。本書の優先順位を参照する。過去のProtocolテストがこの項目を直接検証しているため、Ver.371では保存責務台帳のbaselineのみ更新し、監査履歴と現行候補の分離は別の小さな保守作業とする。

## 3. 今回採用した改善：通知の既読ボタン復旧

### ソースと再現条件

`inbox-ui-v183.js` は個別既読操作中のIDを `inboxBusy` に保持する一方、通知本文等の `drawerSignature` が同じ場合は描画を省略する。

- 既読操作が失敗して表示データが変わらない場合、finallyでbusyを解除しても描画が省略され、ボタンのdisabled / aria-busyが残る。
- 保存中に別の表示更新が届くと行が再構築され、Set上は処理中でも再構築されたボタンに無効表示が反映されない。
- 保存APIが予期しない例外を返す経路では、UI側で拒否されたPromiseを捕捉していない。

これは隔離した実ブラウザで確認したUI不具合であり、本番で発生した件数や頻度は未調査。

### 変更範囲

表示データの署名と一時的な処理中状態を分離し、`syncInboxBusy()` で現在の個別既読ボタンだけを差分更新する。署名一致による早期return時と行の再構築後の両方で適用する。予期しない例外はUIで捕捉し、再試行を促す通知を表示する。

既存の `W.markInboxRead(id, ..., expectedReadAt)`、expected-base transaction、競合時のremote winner保護、データ構造、Firebaseパス、未読・要確認・リアクション分類、一括既読の仕様は変更しない。Observer・常設listener・timerを追加しない。既存の表示キャッシュは維持する。

製品runtimeを変更するため、候補Release / baselineReleaseは298 / 298へ同期する。mainへの正式反映前は公開版が298になったとは扱わない。

### 検証

- 変更前の実ソースを使った隔離Chromium：1366px / 390pxの双方で、失敗後のdisabled残留と保存中再描画によるbusy表示の消失を再現。
- 修正後の同条件：失敗後はenabledへ復旧、保存中の再描画ではdisabled / aria-busyを維持、完了時に解除。ページ例外・横方向overflowなし。
- ローカルProtocol / release-contract：480 / 480 success。
- JavaScript構文：変更runtime、manifest、新規specの `node --check` success。
- 新規 `tests/inbox-read-feedback-v371.spec.mjs`：PC / mobile各4件、合計8件を追加。失敗後の再試行、DOM identity維持、処理中更新・再開・重複抑止、Promise拒否、通常の既読/未読とreload永続化を対象にする。
- 新規specを含む全アプリのBrowser RegressionとFirebase EmulatorはPR CIで判定する。ローカルの隔離UI検証を全アプリ検証の代用とはしない。

テストはローカル専用データまたは既存Emulatorを用いる。新規specはローカルテストサーバー以外への通信を遮断し、firebaseConfigを無効化する。本番Firebaseの業務データは使用・変更しない。

## 4. 製品全体の優先順位

以下は調査した実装からの暫定順位であり、全機能のUX監査が完了したという意味ではない。

| 優先 | 対象 | 判断根拠と次の完了条件 |
| --- | --- | --- |
| 1 | 通知の失敗後の再操作と保存中表示（Ver.371） | 日常操作に直結し、再現済み。小さな表示修正で解消できる。PR全CI、exact-head merge、main全CI、Pages、checkpointで完了。 |
| 2 | 通知drawerのキーボード・モバイル操作 | 現行はaria-modalを宣言するが、open/closeに明示的な初期フォーカス・復帰処理が見当たらない。実ブラウザでTab / Shift+Tab / Escape、閉じた後の復帰、背面操作を確認し、既存モーダルと競合しない最小改善を行う。大規模な外観変更は不要。 |
| 3 | 今日・タスクの情報の探しやすさ | 検索・絞り込み・保存済み条件・詳細導線の実態を確認し、結果0件の理由や解除導線、PC/スマホ差を優先する。既存機能を増設し直さない。 |
| 4 | 業務支援の追加価値 | 申し送り・フォローアップ・一日の確認を、今日/タスク/メモに統合できるか評価する。既存コメント・リマインダーとの重複、追加操作、利用頻度、保守費を比較してから1件を選ぶ。独立した左メニューの追加を既定にしない。 |
| 横展開前の前提 | 認証・権限・復旧設計 | 正式な利用者認証なしで、表示名やルーム名をアクセス制御と扱わない。認証、権限、共有/個人の境界、バックアップ/復旧、移行を設計して合意後に着手する。 |

認証については現在のソースにFirebase Authenticationを前提とした利用者制御がなく、リポジトリ内の `firebase-rules.json` にはルーム配下をread/write trueとする定義がある。ただし、これは配置済み本番Rulesの取得・検証結果ではない。機密情報・医療情報の入力を安全とみなさず、画面上の注意書きだけで安全性を確保したとは扱わない。

お知らせと個人通知の区別、リアクションの分類、完了画面からのアーカイブ導線はすでに存在する。似た機能を別名で左メニューに増やさず、既存入口の分かりやすさを先に改善する。

## 5. 開発運用上の残件

- 過去のOPEN PRが残っている。#265、#259、#237、#232、#203、#191、#172、#163、#113、#83、#82、#41を、現行mainとの差分・後続PR・未採用機能に分類する。古いという理由だけでマージやcloseをしない。特に#82/#83は同じVer.227の別案なので個別確認が必要。
- READMEやHTMLメタ情報の旧「2名向け」表現は将来の要件正本にしない。現行機能を確認したうえでオンボーディング資料を更新する。
- 技術的負債は、次の機能追加を実際に妨げる部分または再現可能な問題を対象にし、製品改善と同じ判断表で比較する。

## 6. 次回再開手順

最新mainと作業PRのheadを再取得する。Ver.371のPRでProtocol / Browser / Firebase Emulatorがすべてgreenか確認し、不一致や失敗は調査する。未完了ならマージしない。

マージ直前にmainとPR headを再確認してexact-head mergeし、main RegressionとPagesの完了、Release / baselineRelease 298 / 298を確認した後にのみ `backup/ver371-checkpoint` と正式完了記録を作成する。その次は上記優先2の通知drawer操作を検証する。新たな重大バグが再現した場合は順位を見直す。
