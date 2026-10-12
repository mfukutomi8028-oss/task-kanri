# Ver.427 候補：旧監査文書5件の固定コミット履歴案内

## 目的と正本

Issue #292 Stage D。Ver.426候補の実Git checkoutスキャンで、root Markdown81件・対象テキスト482件のうち47件に完全一致の文字列参照がないことを確認した。このうち古い監査履歴5件のみを少数の独立PRで現行Git rootから整理する。

先行Ver.426は独立4CI、main同SHA Regression/Pagesがすべて成功し、main `92b309e75ef58d29c0ed4a6578060df3133147b7` に対する復旧checkpoint `backup/ver426-root-markdown-reference-audit-validated-checkpoint` を確保済み。Ver.427は独立したexact-head CI全成功、mainマージ後のRegression/Pages成功、専用checkpoint作成を正式受入条件とする。

以下の原本はGitHub上の**正式受入済みVer.425 mainコミット**で内容と旧パスを参照できる。原本の削除ではなく現行ツリーからの退役であり、Git履歴の容量は減らない。

原本正本：`dda377253979b6975d5148bad1028beab0d38394`。

| 旧ルートMarkdown | Git blob SHA | バイト数 | 固定コミット原本 |
| --- | --- | ---: | --- |
| `BRAND_BFCACHE_RECOVERY_AUDIT_V288.md` | `ce01999e7c07d6f914a15901eefe49dc283f1847` | 2,002 | [原本を表示](https://github.com/mfukutomi8028-oss/task-kanri/blob/dda377253979b6975d5148bad1028beab0d38394/BRAND_BFCACHE_RECOVERY_AUDIT_V288.md) |
| `BRAND_DATASET_IDEMPOTENCY_AUDIT_V286.md` | `c03f52471fcad7534b8e2cc31fcc0e938fbec13d` | 2,800 | [原本を表示](https://github.com/mfukutomi8028-oss/task-kanri/blob/dda377253979b6975d5148bad1028beab0d38394/BRAND_DATASET_IDEMPOTENCY_AUDIT_V286.md) |
| `MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md` | `c7d53cee9b8038146b11d58b6dd28c9d7bf20dad` | 6,118 | [原本を表示](https://github.com/mfukutomi8028-oss/task-kanri/blob/dda377253979b6975d5148bad1028beab0d38394/MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md) |
| `COMMENT_MENTION_ESCAPE_AUDIT_V326.md` | `cd9faafce1ad028c65f717d081852340b81310b9` | 1,783 | [原本を表示](https://github.com/mfukutomi8028-oss/task-kanri/blob/dda377253979b6975d5148bad1028beab0d38394/COMMENT_MENTION_ESCAPE_AUDIT_V326.md) |
| `FAVORITE_OBSERVER_REFINED_AUDIT_V368.md` | `cf6520a5c23036694d4a31b8647227ab26e16fab` | 1,465 | [原本を表示](https://github.com/mfukutomi8028-oss/task-kanri/blob/dda377253979b6975d5148bad1028beab0d38394/FAVORITE_OBSERVER_REFINED_AUDIT_V368.md) |

## 選定根拠と残るリスク

- 5件はGit管理テキスト482件の文字列参照監査で、別ファイルから旧ファイル名の完全一致を検出しなかった。これは**現在の静的証拠のみ**であり、GitHub Issue/PRからの過去リンク、外部ブックマーク、動的参照の不存在を証明しない。
- これらは旧Releaseの観測・設計判断・監査履歴であり、現行UI/保存仕様の正本ではない。原文の改変なく過去コミットと元のGit blob SHAから復元可能とする。
- GitHubの `blob/main/<旧ファイル>` 形式のURLは退役後に参照不能となる可能性がある。過去コミット固定URLへ変更できる現在の内部リンクが存在する場合は事前に修正し、外部リンクは完全把握できない旨を記録する。
- GitHub Pagesが公開する `.pages-runtime/` はこの履歴文書を含まない。現役HTML/JS/CSS、Release304、manifest、Firebase Rules・認証・業務データには変更を加えない。
- 本工程で削除するroot Markdownは5件・合計14,168バイト。追加する案内と検証テストの容量は別計上し、GitHub全体の履歴サイズ削減と混同しない。

## 独立検証・復旧

Git rootでの旧パス不存在、上記の固定コミットリンクとGit SHAの存在、現行README・回帰/責務/リリース案内の参照不存在をProtocolで確認する。PR exact-head Protocol/Browser/Firebase/Regression全success後のみexpected-head main mergeし、main同SHA Regression/Pages successと復旧checkpointを確認する。

復旧が必要な場合は上記固定コミットから元パスと原文を復元し、同じCIを再実行する。
