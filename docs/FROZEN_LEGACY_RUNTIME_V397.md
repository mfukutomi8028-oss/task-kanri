# Ver.397候補：旧JS/CSS 10件のURL互換を保った固定アーカイブ整理

起点: Ver.395 main `36dcbc4ae3b64b98966e4d558f2b40896300e756`。Ver.393監査の後、Ver.395で更新された実計測では、manifest未宣言・現行ランタイム/テストからのファイル名文字列参照の検出がない旧ルートJS/CSSが10件残っている。**参照文字列が見つからないことは削除許可ではない**ため、旧HTMLやブラウザキャッシュ用の公開URLはすべて残す。

## 変更内容

旧ルートのJS8件/CSS2件（Git tree上合計 **62,756 bytes**）をGit現行ツリーから退役し、原文を `compat/frozen-legacy-runtime-v397.json` にまとめる。Pagesのステージング工程で旧URLに原文と同一バイトを復元する。各旧ファイルのGit blob SHAとUTF-8バイト合計を固定検証し、一件でも相違があれば配布ビルドを失敗させる。

| 旧公開URL | 原本サイズ（bytes） | 不変Git blob SHA1 | 復元用原本 |
| --- | ---: | --- | --- |
| `archive-duplicate-v152.js` | 14,026 | `321b0822a36025e8939a9027ef4d98fe9ba1c914` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/archive-duplicate-v152.js) |
| `inbox-v152.js` | 10,421 | `7615e5d2296d50ca1634f3946d2840f66dab5902` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/inbox-v152.js) |
| `reminders-v150.js` | 8,030 | `ed723292877e6bdebcf5b6fbdd660372f49c0d3e` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/reminders-v150.js) |
| `relationships-v150.js` | 5,758 | `afa46dc4b8998589d2d8b964919f26ecd37882b2` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/relationships-v150.js) |
| `workflow-core-v149.js` | 5,754 | `d6d8e370ddef06c5dd3380f30e6244af199ebab8` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/workflow-core-v149.js) |
| `dependencies-v148.js` | 4,774 | `3773fe78bf1562cfaba2fbb8e05275ceea5bf5f8` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/dependencies-v148.js) |
| `workflow-core-v148.js` | 4,679 | `319d4628ef9cd930d0dad458082431c22e2d2825` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/workflow-core-v148.js) |
| `ui-v162.css` | 4,285 | `825e57c790446abf8213ae1e2673c9adf2a2912c` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/ui-v162.css) |
| `brand-v184.js` | 2,663 | `732ef22a611782a3ddb074a4abcd4c794db09353` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/brand-v184.js) |
| `ui-v163.css` | 2,366 | `e3098b5e1e48fa9ec604fb8e61dc0e79516b0411` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/36dcbc4ae3b64b98966e4d558f2b40896300e756/ui-v163.css) |

変更対象は互換アーカイブ・Pagesビルダー・Protocol/packaged Browserテスト・登録のみ。**実行する製品HTML/JS/CSS、release-manifest、Firebase/Rules、認証、Release304は変更しない**。アーカイブJSONはPages公開対象外。旧JS/CSSの公開URLはHTTP 200で元バイトを返し続ける。

## 検証と制約

- Node Protocol: 原本10ファイルのルート不存在、manifest非宣言、一覧件数、固定Git SHA、総バイト数、旧URL復元ファイルの全件バイト一致
- Browser (1366 / 390px): Pages相当の `/task-kanri/` で旧URL HTTP200と原文バイト完全一致、アーカイブURLは404、本番Firebase通信遮断
- Firebase Emulator: 従来の合成データ検証を維持し、製品保存処理を変更しない
- GitHub上の旧ファイルへの `main` 直リンクは404になり得るため、この文書の不変コミット固定リンクを使用する
- アーカイブ保存とテスト追加のため、**Git現行ツリーのファイル数削減と、配布容量・Git履歴の容量削減は別**。旧ブラウザ版すべての業務動作を保証するものではない

Draft PRのexact-head 4CIすべて成功→前段の正式main取り込み→main同SHA Regression/Pages成功→復旧checkpointまでは正式完了としない。
