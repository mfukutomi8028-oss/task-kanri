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

## 公開前に残る確認（未確認）

- 100人登録・同時50セッションの負荷実測（2人試用では対象外、拡大時の条件）。
- 本番 Firebase Rules の読み戻しと合成（`recordLinks` 追加分を含む）、実 Supabase Edge Runtime・Storage・IAM、実際の無料枠使用量。
- Android 実機（現状は Pixel 7 設定の代替検査）。iPhone での新SHA再確認。
- 最終候補での全体CI（Protocol・認可/PostgreSQL・Firebase・ブラウザ4分割）と、独立再レビュー。
