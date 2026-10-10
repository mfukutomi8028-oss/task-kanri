# Ver.394: 古い監査・移行報告12件の履歴インデックス

Ver.392確定時点のmain `b534de7aa7a2b6e67b5c2a6be99a49479a111beb` を原本起点として、旧Ver.266～279の監査報告12件をルート直下から退役する。現行仕様は `README.md`・`REGRESSION_TESTS.md`・`release-manifest.js`・実行コード・回帰テストを参照すること。

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
| `FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md) |
| `FIRST_PAINT_VERSION_HANDOFF_V277.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/FIRST_PAINT_VERSION_HANDOFF_V277.md) |
| `POSTLOAD_VERSION_SYNC_AUDIT_V278.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/POSTLOAD_VERSION_SYNC_AUDIT_V278.md) |
| `POSTLOAD_VERSION_SYNC_PRODUCT_V279.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/POSTLOAD_VERSION_SYNC_PRODUCT_V279.md) |

**互換性**：Markdownの相対リンクで旧ファイル名を直接参照した外部の資料やブックマークは、mainのそのパスでは読めなくなる。必要な旧監査記録は上記の固定原本へアクセスする。現行runbook内に同名ファイルの参照がないことはProtocolで確認する。

**受入条件**：Ver.394候補PRのexact-head Protocol/Browser/Firebase/Regression全成功、最新mainへの統合後の同SHA Regression/Pages全成功、復旧チェックポイント作成を正式完了とする。
