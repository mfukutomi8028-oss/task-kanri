# Ver.428候補：旧お気に入りObserver監査3文書の履歴化

## 起点と目的

Issue #292 Stage D。先行Ver.427 PR #345は正式受入済み。main `71beb54e3a52b4bf46f4fc4ed3c8ffb2f8b0fd87` と独立exact-head候補は同一Gitツリーで、Protocol/Browser/Firebase/Regressionとmain同SHA Pagesがすべて成功。復旧branch `backup/ver427-historical-root-audits-validated-checkpoint` を作成した。本Ver.428の正式受入には、Ver.428独立CI、main同SHA回帰/Pages、専用checkpointを要求する。

Ver.426正式受入main `92b309e75ef58d29c0ed4a6578060df3133147b7` における読み取り専用参照スキャンは、ルートMarkdown81件・対象テキスト482件を調べ、47件に他のGit管理ファイルからの完全一致名称参照がないと報告した。次の3件はそのサンプルに含まれ、旧Releaseの経緯と当時の注意点を記録する文書である。**文字列参照ゼロは動的参照・外部リンク不存在の証明ではない**ため、対象を少数に限定し、原本を固定Git SHAで保持する。

## 退役候補と復元先

GitHub上の原本正本：`92b309e75ef58d29c0ed4a6578060df3133147b7`。

| 旧ルートMarkdown | 原本Git blob SHA | バイト数 | 復元用固定URL |
| --- | --- | ---: | --- |
| `FAVORITE_OBSERVER_SEMANTIC_AUDIT_V366.md` | `f444b4a0467036700d69edf3c3b0699786cfd4db` | 2,576 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FAVORITE_OBSERVER_SEMANTIC_AUDIT_V366.md) |
| `FAVORITE_OBSERVER_BROWSER_AUDIT_V367.md` | `a00a5c6d9a385719118e475f3ac46f2ec9e82905` | 1,750 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FAVORITE_OBSERVER_BROWSER_AUDIT_V367.md) |
| `FAVORITE_OBSERVER_TARGET_AUDIT_V370.md` | `919e0134b190889c2e6a2ac1ca89f96acde9c56c` | 1,463 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FAVORITE_OBSERVER_TARGET_AUDIT_V370.md) |

旧3ファイル合計 **5,789バイト**。Gitの現行ツリーからの退役であり、履歴からの消去・リポジトリ全体の物理容量削減ではない。

## 内容上の注意と判断

- `FAVORITE_OBSERVER_SEMANTIC_AUDIT_V366.md`：Ver.366：変更せずにObserverの意味的対象を測定した監査。現役機能の実装正本ではないが、再発防止のため過去の観測・注意点は固定URLから引き続き参照できる。
- `FAVORITE_OBSERVER_BROWSER_AUDIT_V367.md`：Ver.367：ブラウザ監査で過剰反応の課題を記録。現役機能の実装正本ではないが、再発防止のため過去の観測・注意点は固定URLから引き続き参照できる。
- `FAVORITE_OBSERVER_TARGET_AUDIT_V370.md`：Ver.370：更新対象の境界条件を監査。現役機能の実装正本ではないが、再発防止のため過去の観測・注意点は固定URLから引き続き参照できる。

- 元の文書本文・Git blob SHAを改変しない。過去の監査意図を削除や無効と誤解しない。
- 現在のGit管理テキスト内の完全一致参照はVer.426実測で見つからなかった。ただしGitHub Issue/PR、利用者のブックマーク、外部文書や動的パスは調査対象外。旧 `blob/main/` URLは切れる可能性があり、固定URLへの手動置換が必要な場合がある。
- 変更対象は旧Markdown3件の現行rootからの削除、当索引、新規Protocolの追加と `package.json` の該当実行コマンドへの登録のみ。Release304、HTML、アプリJS/CSS、manifest、Firebase/Rules、認証・保存データ、GitHub Pages配布アセットに触れない。
- Ver.428の整理内容を正式受入済みVer.427 mainへ差分不変で同期する。PR exact-head Protocol/Browser/Firebase/Regression全success→expected-head merge→main同SHA Regression/Pages全success→復旧checkpointの順で受入する。

## 復旧手順

必要時は上記固定コミットにある原文を同じ元パスへ復元し、package.jsonの現行Protocol/Browser/Firebaseで回帰を再実行する。復旧前に既存runbookや外部参照への影響を確認する。
