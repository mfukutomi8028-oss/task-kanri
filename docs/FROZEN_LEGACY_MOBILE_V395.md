# Ver.395候補：旧モバイル補正JS6件を互換用固定アーカイブへ統合

起点: Ver.392確定main `b534de7aa7a2b6e67b5c2a6be99a49479a111beb`。Ver.393のread-only棚卸しで、今回選定した6件はいずれも現行ソースとテストからファイル名の文字列参照を検出していない。ただし、**旧ブラウザのHTML・manifestキャッシュが旧URLを要求しうるため、配信ファイルは削除しない**。

## 固定アーカイブ方式

Gitのルートから重複・退役済みの旧補正JavaScript6件（合計 **34,593 bytes**）を除外し、配布専用のUTF-8原本テキストを `compat/frozen-mobile-scripts-v395.json` に集約する。Pagesビルドはこのデータを読み、固定Git blob SHA1を照合して旧名のURLへ**元と同一バイト**で復元する。完全一致しない場合は配布ビルドを失敗させる。

| 旧URL（Gitのルートから退役） | 原本容量 | 固定Git blob SHA | 原本リンク |
| --- | ---: | --- | --- |
| `mobile-board-scroll-fix.js` | 4659 | `984cab660098f133e5490a3d6fb21ccb7f806308` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-board-scroll-fix.js) |
| `mobile-interaction-filter-v104.js` | 8120 | `f1ab7249e7ea777fd2d31d9bc099dd86029f2c8d` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-interaction-filter-v104.js) |
| `mobile-native-scroll-version-v106.js` | 1599 | `831e40713d0e52796864c6cda2d29e6ecb54bb8e` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-native-scroll-version-v106.js) |
| `mobile-native-tabs-today-filter-v105.js` | 9068 | `d6eb3592c0ed1e06c98a842dcc001a502b473201` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-native-tabs-today-filter-v105.js) |
| `mobile-safe-final-v107.js` | 4070 | `d36dfc519bd34d48ccd3a8c28109949b3d5f064b` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-safe-final-v107.js) |
| `mobile-scroll-unlock-v103.js` | 7077 | `85e49c71e33df57d4bc73b0f1579150a25267853` | [退役前の原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/b534de7aa7a2b6e67b5c2a6be99a49479a111beb/mobile-scroll-unlock-v103.js) |

配布検証はNode Protocolで原本SHAとソース不存在・manifest非宣言を確認し、Pages buildのステージングとPlaywrightのHTTP 200・バイト一致を確認する。移行対象のスクリプトを**製品で新規実行することはない**。現行アプリ・Firebase・Rules・Release304は変更しない。

## リスクと受入条件

- Gitのmainから旧パスのソースファイルは消えるため、GitHubのmainへの**直接rawリンク**は影響を受ける。固定コミットへのリンクで復元可能。
- 旧キャッシュが要求するPagesのURLはバイト単位で維持する。互換性の範囲は旧URL/旧バイトであり、過去版アプリ全体の挙動保証ではない。
- Git現行ツリーのファイル数を減らす整理であり、アーカイブには原本を保存するため**配布サイズとGit履歴容量の削減を保証しない**。
- 本PRはDraftから開始し、exact-head4系統CI、main回帰・Pages同SHA成功、復旧チェックポイントを確認した時点で正式完了とする。
