# Ver.388: 過去監査文書5件の履歴保全と退役

Ver.387確定main `160eabe7071945a5d2ed09cd86239e43f8897a1f` を起点に、ルート直下の旧監査文書を5件整理する。退役ファイルの原文は以下の固定コミットに保持される。これはGit treeからの除外であり、Git履歴の容量削減ではない。

| 退役パス | 固定履歴 |
| --- | --- |
| `CORE_DENSITY_SIDECAR_RETIREMENT_AUDIT_V223.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/CORE_DENSITY_SIDECAR_RETIREMENT_AUDIT_V223.md) |
| `DATE_KEYBOARD_BOUNDARY_AUDIT_V230.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/DATE_KEYBOARD_BOUNDARY_AUDIT_V230.md) |
| `USER_UX_POLISH_BOUNDARY_AUDIT_V236.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/USER_UX_POLISH_BOUNDARY_AUDIT_V236.md) |
| `TODO_OBSERVER_BOUNDARY_AUDIT_V264.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/TODO_OBSERVER_BOUNDARY_AUDIT_V264.md) |
| `TODO_OBSERVER_TARGETING_V265.md` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/TODO_OBSERVER_TARGETING_V265.md) |

この変更ではアプリ本体、HTML、JS、CSS、画像、manifest、Firebase、リリース番号、回帰テスト実行ファイルは変更しない。コード検索で対象ファイル名の参照は検出されなかったが、過去のコミット・PRや検索インデックス外の参照まで存在しないとは保証できない。PRのexact-head CIおよびmainのRegression/Pagesが成功するまで正式完了としない。
