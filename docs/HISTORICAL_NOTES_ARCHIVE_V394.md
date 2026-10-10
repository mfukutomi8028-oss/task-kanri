# Ver.394: 古い監査・移行報告10件の履歴インデックス

Ver.392確定時点のmain `b534de7aa7a2b6e67b5c2a6be99a49479a111beb` を原本起点として、旧Ver.266～279の監査報告10件をルート直下から退役する。現行仕様は `README.md`・`REGRESSION_TESTS.md`・`release-manifest.js`・実行コード・回帰テストを参照すること。

旧文書はGitのコミット固定の履歴から同じ内容で参照・復元可能。Gitの過去コミット容量は減らない。実行アプリ・Pages配布・Firebase/Rules・Release304・現行runbookは変更しない。

| 退役文書 | 不変の原本リンク |
| --- | --- |
| `TODO_HISTORY_BOUNDARY_AUDIT_V266.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/TODO_HISTORY_BOUNDARY_AUDIT_V266.md) |
| `TODO_HISTORY_TARGETING_V267.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/TODO_HISTORY_TARGETING_V267.md) |
| `ICON_OBSERVER_BOUNDARY_AUDIT_V268.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/ICON_OBSERVER_BOUNDARY_AUDIT_V268.md) |
| `ICON_OBSERVER_TARGETING_V269.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/ICON_OBSERVER_TARGETING_V269.md) |
| `ICON_SYSTEM_POLLING_AUDIT_V270.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/ICON_SYSTEM_POLLING_AUDIT_V270.md) |
| `ICON_SYSTEM_SINGLE_PASS_V271.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/ICON_SYSTEM_SINGLE_PASS_V271.md) |
| `BRAND_LIFECYCLE_AUDIT_V272.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/BRAND_LIFECYCLE_AUDIT_V272.md) |
| `VERSION_LIFECYCLE_AUDIT_V274.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/VERSION_LIFECYCLE_AUDIT_V274.md) |
| `FIRST_PAINT_VERSION_HANDOFF_V277.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/FIRST_PAINT_VERSION_HANDOFF_V277.md) |
| `POSTLOAD_VERSION_SYNC_PRODUCT_V279.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/POSTLOAD_VERSION_SYNC_PRODUCT_V279.md) |

**既存テストの保護**：`FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md` と `POSTLOAD_VERSION_SYNC_AUDIT_V278.md` はVer.276/278のProtocolテストで原文を読み込むため、**削除せずルートに残す**。初期12件の計画から除外した。

**互換性**：Markdownの相対リンクで旧ファイル名を直接参照した外部の資料やブックマークは、mainのそのパスでは読めなくなる。必要な旧監査記録は上記の固定原本へアクセスする。現行runbook内に同名ファイルの参照がないことはProtocolで確認する。

**受入条件**：Ver.394候補PRのexact-head Protocol/Browser/Firebase/Regression全成功、最新mainへの統合後の同SHA Regression/Pages全成功、復旧チェックポイント作成を正式完了とする。

## Ver.396追加：過去のタスクダイアログ検討記録5件

Ver.394 main `746ddd728163dd23beaa432dedb3b9d49aec3ab6` に現存するVer.320〜321の検討文書5件を、現役の要件・操作説明と混同しないためGit現行ツリーから退役する。いずれもWeb公開パッケージ対象ではない。文書はGitの不変コミットで復元でき、現行UI・保存処理・Firebase・Rules・Release304・Pages公開URLは変更しない。

| 旧パス | 不変コミットにある原本 |
| --- | --- |
| `docs/ver320-task-dialog-ux.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/746ddd728163dd23beaa432dedb3b9d49aec3ab6/docs/ver320-task-dialog-ux.md) |
| `docs/ver321-regression-scope.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/746ddd728163dd23beaa432dedb3b9d49aec3ab6/docs/ver321-regression-scope.md) |
| `docs/ver321-task-dialog-polish.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/746ddd728163dd23beaa432dedb3b9d49aec3ab6/docs/ver321-task-dialog-polish.md) |
| `docs/ver321-ui-notes.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/746ddd728163dd23beaa432dedb3b9d49aec3ab6/docs/ver321-ui-notes.md) |
| `docs/ver321-user-reported-ui.md` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/746ddd728163dd23beaa432dedb3b9d49aec3ab6/docs/ver321-user-reported-ui.md) |

現行の操作仕様は現行コードとProtocol/Browserテストで判断する。Ver.320〜321の文書が将来の改修のために必要になった場合は上記コミット固定URLから読み直す。Git履歴の容量そのものは減らない。GitHub上の旧パスへのブックマークはmainでは使えなくなるため、固定URLを参照すること。Ver.396の削除不在・索引・参照不存在をProtocolで検証し、PR exact-head全CI・main Regression/Pages・復旧チェックポイントまで完了扱いにしない。
