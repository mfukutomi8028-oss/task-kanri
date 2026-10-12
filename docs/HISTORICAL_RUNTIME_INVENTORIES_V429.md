# Ver.429候補：過去のランタイム棚卸し監査3文書の固定履歴整理

## 目的と依存関係

Issue #292 Stage D。先行Ver.428 PR #346は正式受入済み。main `1bb1e56d6a0c3ca3015ea8773622b96a107f8b8c` に対する独立CI・main同SHA Protocol/Browser/Firebase/Regression/Pagesが成功し、復旧branch `backup/ver428-favorite-observer-audits-validated-checkpoint` を確保した。本Ver.429はこの検証済みmainを起点として独立CIと復旧checkpointを要求する。

Ver.426正式受入時の静的参照スキャンでは、ルートMarkdown81件・対象管理テキスト482件を走査し、47件に別管理テキストからの完全一致ファイル名参照が見つからなかった。以下3件はそのサンプル内の古いランタイム監査記録。**完全一致文字列の参照ゼロは実行時依存・外部リンク・動的参照がない証明ではない。**

## 元の監査記録と復旧原本

正式受入済みVer.426 mainの固定原本SHA：`92b309e75ef58d29c0ed4a6578060df3133147b7`。

| 旧ルート監査Markdown | Git blob SHA | 元バイト数 | 固定コミット原本 |
| --- | --- | ---: | --- |
| `FINAL_RUNTIME_INVENTORY_AUDIT_V325.md` | `88cb27f9c6d23736e7c9779bfae4b86e574b2cb8` | 3,529 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FINAL_RUNTIME_INVENTORY_AUDIT_V325.md) |
| `FINAL_RUNTIME_INVENTORY_AUDIT_V345.md` | `138e3a858d5bc9e0773b1ab8b9932bed1041e443` | 5,704 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FINAL_RUNTIME_INVENTORY_AUDIT_V345.md) |
| `FINAL_RUNTIME_WAKEUP_INVENTORY_AUDIT_V355.md` | `662fb34be2f6fce68bc5c39925e11636a0ecd26e` | 4,234 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/92b309e75ef58d29c0ed4a6578060df3133147b7/FINAL_RUNTIME_WAKEUP_INVENTORY_AUDIT_V355.md) |

合計 **13,467バイト**。対象文書はVer.325（Release280）、Ver.345（Release288）、Ver.355（Release292）の当時の静的監査結果・議論を記録している。現在のRelease304のランタイム構成の正本ではなく、結果値をそのまま現在の実装判断に流用してはいけない。ただし監査手法・リスク評価・過去対応の経緯は有用なため、原本を消失させずGit履歴で維持する。

## 安全性・保持すべき契約

- 元の文書本文・Git blob SHAを変更せず、旧パスの現行root配置だけを退役する。固定GitHub URLから復元できる。
- Git管理テキスト内の完全一致参照がゼロでも、GitHub Issue/PRの旧URL、外部の保存リンク、旧キャッシュなどは未評価。旧 `blob/main/` 形式のリンクが切れる可能性があり、必要な利用者は固定コミットURLへ更新する。
- 削除は監査Markdown3件のみ。新たな案内索引とProtocolテスト、package.jsonのtest:protocolへの該当テスト登録以外に変更しない。Release304、HTML/アプリJS/CSS、release-manifest、Firebase/Rules、認証・業務データ、GitHub Pages配布アセットを変更しない。
- Git現行ツリー上の追跡ファイルは減るが、Git履歴容量や実配布容量が同じだけ減るとは限らない。稼働中のObserver/Timerの削減施策ではない。

## 受入・復元

正式受入済みVer.428 mainから旧監査3件の削除・固定リンク索引・Protocol検証・package.jsonのテスト登録だけを移植する。旧候補の `node --test` 重複を除去したうえで、Ver.429 exact-head Protocol/Browser/Firebase/Regression全success→expected-head main merge→main同SHA Regression/Pages全success→復旧checkpointを必須とする。

必要時は固定コミット `92b309e75ef58d29c0ed4a6578060df3133147b7` の原本を旧パスに戻し、現在のProtocol/Browser/Firebase回帰を実行してから復元を採用する。
