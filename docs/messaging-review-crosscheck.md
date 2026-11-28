# PR #1014 独立レビュー指摘・合意済み仕様の照合（2026-11-27）

対象：`b032ae3` への独立レビュー（REVISE）と、承認済み設計 [design](superpowers/specs/2026-11-26-workboard-messaging-design.md)・[公開条件](superpowers/plans/2026-11-26-workboard-messaging-release-gates.md)。
旧候補 `e6fc12b` の CI 9/9・iPhone 確認は旧SHAの証拠であり、本ファイル以降の候補には引き継がない。

凡例：**対応済**＝実装とテストがコミット済み／**要再確認**＝最終候補の全体検査で再実行して確定／**未確認**＝実サービス・実機・運用者作業が必要。

## 独立レビュー指摘

| 指摘 | 状態 | 対応コミット | 証拠（テスト・記録） |
| --- | --- | --- | --- |
| Critical 1 下書き・送信再試行の消失 | 対応済・要再確認 | 36f4f919, 9542bbac, d7cd0d30 | `messaging-store.test`、`origin-messaging-live.spec`、[検証記録](messaging-pilot-verification.md) |
| Critical 2 業務連携が未接続 | 対応済 | 52af2651, 15255932, 88ea996c | `origin-messaging-business.spec`、`origin-messaging-record-link.spec`（恒久リンク・古い履歴への移動）、Rules Emulator `MESSAGING_RECORD_LINK_RULES_OK` |
| Critical 3 永続的な全体・本人予算がない | 対応済・要再確認 | 812b04b0, 9542bbac | `messaging-runtime.test`、`messaging-api.test`、`messaging-postgres-regression.sh`（実PostgreSQL、最終検査で実行） |
| Critical 4 有効化候補での停止・ストア横断復元が未確立 | 一部対応・未確認あり | cda64534 | 隔離Deno・Auth/RTDB Emulator・PostgreSQL・合成添付で停止・購読取消・復元を確認済（検証記録）。実Edge Runtime・実Storage・本番Rules読み戻しは未確認 |
| Important 1 一覧の個人設定が選択切替で失われる | 対応済 | 4deed4a3, 3bea9eb9 | `messaging-personal.test`、`messaging-live-commands.test`、`origin-messaging-live.spec` |
| Important 2 確保済み・未確定添付の孤立 | 対応済・要再確認 | 2c7f2904, f3e6ed30 | `messaging-attachment-send.test`、`messaging-attachment-recovery.test`、保守SQL smoke |
| Important 3 検索ページング・共有ファイル絞り込み | 対応済 | 4deed4a3, 3bea9eb9 | `messaging-references.test`、`origin-messaging-preview.spec` |
| Minor 承認確認の重複 | 対応済（Codex記録）・要再確認 | cda64534 | `messaging-session.test`、`messaging-launch.test` |

## 合意済み仕様の残件（今回の引き継ぎで対応）

| 仕様 | 状態 | コミット | 証拠 |
| --- | --- | --- | --- |
| 画像の自動再エンコード・EXIF除去・原本選択 | 対応済（画面上の5場面は最終検査で確認） | be85e894 | `messaging-file-draft.test`（11件）、`origin-messaging-preview.spec` |
| 個人・グループ別容量表示、600/720MB警告 | 対応済 | 47a5a137, df5b9600 | `messaging-attachment-usage*.test`（Node・PGlite）、`origin-messaging-preview.spec` |
| 業務レコードから元メッセージへの恒久リンク | 対応済 | 88ea996c | 上記 Critical 2 欄 |
| 古い履歴の復帰位置 | 対応済 | 88ea996c | `origin-messaging-record-link.spec`（50件より古いページを取得して移動、未取得・削除は失敗扱い） |
| 将来の正式ログインへの移行性 | 設計対応 | 88ea996c | [進捗記録](messaging-handoff-progress.md) の移行方針。全データが personId キー、認証は uid→personId 対応表のみ |

## 第2回独立レビュー（272f6539、REVISE）への対応

| 指摘 | 状態 | 修正内容 | 修正前の再現 | 修正後の証拠 |
| --- | --- | --- | --- | --- |
| 1 通常起動時の恒久リンク | 対応済 | 詳細に「元メッセージを確認」を常に表示。押下時だけ接続し、本人の承認済み端末として接続できるまで（最大10秒）待ってからリンクを読む。未承認・オフライン・失効は接続案内だけでリンクを読まない | 旧272f653で新E2Eが失敗 | `origin-messaging-record-link.spec`（通常起動・再読み込み・未承認・オフライン・失効、Chromium/WebKit） |
| 2 共有と認可 | 対応済 | 業務記録ごとの共有リンク。各リンクの階層だけでRulesが読む人の承認・所属・加入時点・削除・緊急停止を確認。親階層の読み取りは不可。書き込みは業務記録の実在、作成者=本人、所属・加入後・未削除を確認し、書き換え・削除は不可 | 旧Rulesで新Emulator検査が失敗（作成者以外が読めない） | Rules Emulator `MESSAGING_RECORD_LINK_RULES_OK`、E2E（別の所属者は開ける・非所属者は「確認できる元メッセージはありません」） |
| 3 複数日予定・保存失敗 | 対応済 | 一括作成が作成IDを返し、全IDにリンク。タスク本体の保存直後にリンクするため開始日の保存失敗でも失われない。未保存リンクは本人・ルーム別に端末へ保存し、再読み込み・再接続後と「元メッセージを確認」で1回だけ保存。失効・拒否・競合で破棄 | 旧272f653で新E2Eが失敗 | E2E（3件の予定に3件のリンク、開始日失敗→再保存で重複なし、失敗→再読み込み→1回保存）、Node（保留リンクの分離・破損耐性） |
| 4 原本送信の設定 | 対応済 | 「原本のまま送る」は1回の添付操作だけに適用し、添付・会話切替・利用者切替で解除。準備済みの添付は再送で同じデータ | 旧272f653で新E2Eが失敗（チェックが残る） | `origin-messaging-preview.spec`（原本はメタデータ保持、次の添付は除去、会話切替で解除） |
| 5 古い履歴と表示位置 | 対応済 | 対象IDを指定した範囲取得（`until`、最大300件、作業単位308）。対象の実在・加入後・未削除をサーバーで確認。範囲外は「古いため移動できません」等を表示し成功扱いにしない。検索期間も復元 | 旧実装は最大40ページの順次取得 | `messaging-history.test`・`messaging-store.test`・履歴Emulator `MESSAGING_HISTORY_RANGE_OK`、`messaging-references.test`、E2E（範囲取得1回・順次ページなし） |
| 6 検証・資料 | 対応済 | 本表、進捗記録、試用検証書、運用手順を実装に合わせて更新 | — | 最終候補の全体検査は [進捗記録](messaging-handoff-progress.md) |

## 第3回独立レビュー（337e6ac1、REVISE）への対応

設計と実装前レビューの記録は [再設計書](messaging-record-origin-design.md)。

| 指摘 | 状態 | 根本原因と修正 | 修正前の失敗 | 修正後の証拠 |
| --- | --- | --- | --- | --- |
| 1 恒久リンクの登録認可 | 対応済 | 原因：ブラウザがリンクを書き、記録IDを任意に指定できた。修正：サーバー（`recordReserve`）が認可済みメッセージに対して推測不能な新しい記録IDを発行し、同じ要求でリンクを書く。ブラウザの書き込みはRulesで拒否。作成要求IDで再送しても同じID。旧リンク書き込み経路（`writeLink`、`linkRecords`）は削除 | 旧Rules・旧コードで新検査が失敗（ブラウザから既存記録へリンク作成可） | Rules Emulator `MESSAGING_RECORD_LINK_RULES_OK`、実SDK `MESSAGING_RECORD_ORIGIN_EMULATOR_OK`、Node（発行IDの非連番・API予算224）、E2E（既存記録にリンクなし、単発・複数日、結果不明の再送で1件、予約不可時の選択、開始日失敗） |
| 2 古い履歴の取得方式 | 対応済 | 原因：対象から現在まで連続取得するストア（300件上限、作業単位308は予算上限304超）。修正：対象の前後最大50件の `around` と、新しい側を1ページずつ追加する `after`。未取得区間を明示し、またいで既読にしない。新着で置き換えない | 旧コードで新検査が失敗（4,950件先へ移動不可） | 実SDK `MESSAGING_HISTORY_WINDOW_OK`（5,200件で300・301・4,950件先）、Node（ウィンドウ・既読抑止・最新復帰）、E2E（ウィンドウ1回、追加取得、最新復帰、320px・390px） |
| 3 保留リンクの管理 | 対応済 | 原因：リンク登録の正本がブラウザだった。修正：作成時にサーバーがリンクを書くため、保留状態自体をなくした。localStorage の旧保留データは起動時に削除。作成画面ごとのメモリ上の要求IDだけ | 旧コードで新検査が失敗（保留ストアが残る） | Node（旧データ削除）、E2E（端末に会話・メッセージIDが残らない、2タブ同時作成、失効後の再読み込み、脱退・再加入） |

## 公開前に残る確認（未確認）

- 100人登録・同時50セッションの負荷実測（2人試用では対象外、拡大時の条件）。
- 本番 Firebase Rules の読み戻しと合成（`recordLinks`・`recordOrigins` を含む）、実 Supabase Edge Runtime・Storage・IAM、実際の無料枠使用量。
- Android 実機（現状は Pixel 7 設定の代替検査）。iPhone での新SHA再確認。
- 最終候補での全体CI（Protocol・認可/PostgreSQL・Firebase・ブラウザ4分割）と、独立再レビュー。
