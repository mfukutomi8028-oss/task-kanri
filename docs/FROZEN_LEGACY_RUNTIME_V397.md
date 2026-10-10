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

---

## Ver.400追加：旧アイコンCSS3件の公開URL互換

Ver.399候補head `7e3702ccc0c4867f29d1f30b3f9428f0a68dd3dc` 起点（Ver.398正式main `a6571c910ec5c2b94d10fc3f5268601b87c2d5a2`）。Issue #292。

Ver.399の精密監査で、3つの旧アイコンCSSの現行コード側の言及は `ui-icon-system-v178.css` の統合履歴コメントに限定され、テストの正確な旧ファイル名参照は検出されなかった。**ただし、旧キャッシュからの公開URL利用は否定できないためURLと内容を維持する。**

| 旧CSS | バイト数 | Git blob SHA1 | 原本 |
| --- | ---: | --- | --- |
| `ui-v169.css` | 1,884 | `466c6ccaade9f7633865b69b95c1712647f37797` | [Ver.398原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/a6571c910ec5c2b94d10fc3f5268601b87c2d5a2/ui-v169.css) |
| `ui-v170.css` | 3,968 | `f4e05002204406b2bd3d6fe2608eeeebae151c42` | [Ver.398原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/a6571c910ec5c2b94d10fc3f5268601b87c2d5a2/ui-v170.css) |
| `ui-v171.css` | 5,882 | `3761e279fc5193abba84742e258a57c30763cf08` | [Ver.398原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/a6571c910ec5c2b94d10fc3f5268601b87c2d5a2/ui-v171.css) |

旧3ファイル計11,734 bytesを現行Git rootから退役し、`compat/frozen-icon-css-v400.json` に原文固定保存。Pagesステージングで元ファイル名に同一バイトを復元。原本の不変Git blob SHA・総バイト数・配布ファイル内容をProtocolで、HTTP200と本文一致/アーカイブ404をpackaged Browserで検証。原文の破損・欠損・旧URL重複時はfail-closed。

変更は旧CSS3件退役、アーカイブ、Pagesビルダー、既存/新規検証、説明文書、package.jsonのProtocol登録のみ。**現役HTML/JS/CSS、manifest/Release304、Firebase/Rules・業務データは不変**。gitツリーの件数削減はGit履歴や配布バイト数の削減を保証しない。

Ver.399が正式完了するまでは本PRをDraft保留。先行mainへ差分同期し、本PR exact-head4CIとmain同SHA Regression/Pages成功と復旧checkpointを条件にする。

## Ver.399のmain統合後の取扱い

Ver.399監査はPR #317として main `4c23290430990b89442b54846de1e9374f06ef19` へ統合した。Ver.400候補にも同コミットを二重親として取り込み、**main基準で旧CSS3件の削除と互換実装・検証関連10ファイルだけ**の差分であることを確認している。main側Ver.399 Regression/Pagesと復旧ポイントの正式完了確認まではVer.400をDraftとして保持し、先行するPR CIの成功だけでmainへ統合しない。

公開される旧アイコンCSS3件のHTTP応答は元ファイルのバイト完全一致を維持するため、公開容量削減ではなくGit現行ルートの依存関係整理を目的とする。旧CSSを参照した実ブラウザ利用者が皆無であるという推測には依拠しない。

## Ver.401追加：旧ToDo/作業機能CSS 2件をURL互換のまま退役

Ver.400正式完了main `91031a46f9a934f49c7daae2da12894d5e745b87` を起点に、`ui-v147.css` および `ui-v173.css`（合計2,421 bytes）のGit root実体を整理する。両ファイルは現行release-manifestで宣言されず、旧Ver.189/190のテストが「旧manifestのため物理ファイルがあること」を検査していた。**削除するだけでは既存の検証契約を壊すため**、`compat/frozen-legacy-runtime-v397.json` に原文を追加し、Pages公開先の同名URLへ元のバイトを復元する方式へ契約を移行する。

| 旧URL | 原本容量（bytes） | 元Git blob SHA1 | 元のファイル |
| --- | ---: | --- | --- |
| `ui-v147.css` | 677 | `048f7084a09f473a567a992216ac5a8ef84a2e11` | [Ver.400原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/91031a46f9a934f49c7daae2da12894d5e745b87/ui-v147.css) |
| `ui-v173.css` | 1,744 | `ef244b75a132fd21b1cb50aacd9dedadf3f1f7f6` | [Ver.400原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/91031a46f9a934f49c7daae2da12894d5e745b87/ui-v173.css) |

- 元のVer.397アーカイブ10件（合計62,756 bytes）のGit SHA・総バイト契約はそのまま残し、Ver.401追加の2件（合計2,421 bytes）を別の不変マップで検査する。アーカイブ全体には12件だけを許可し、欠損・重複・改変はPagesビルド時に停止する。
- 既存のVer.189/190テストでは、現行manifestに旧CSSが入っていないことと、旧URLへ再生成するための原文・固定SHAが存在することを確認する。新しいProtocolテストで元Git blob SHA・2,421 bytes・Git root不存在を検証し、既存のPagesステージングとpackaged Browser試験で**旧URLのHTTP200・内容の完全一致**を検証する。
- 製品で実行するHTML/JS/CSS、manifest/Release304、Firebase/Rules/認証、業務データ、既存のコピー保存処理は変更しない。Gitツリー内のファイル数は2減るが、アーカイブに原文を残すためGitツリー総容量やPages公開容量を削減する施策ではない。

本工程はDraft PR exact-headのProtocol・Browser・Firebase・Regression全成功 → expected-head mainマージ → main同SHA Regression/Pages成功 → 復旧チェックポイントを完了条件とする。実ブラウザの旧キャッシュ利用者数がゼロという推測は置かない。

## Ver.402候補：旧ToDo CSS 3件のURLを維持してGit rootから整理

Ver.401候補コミット `4c83752966f7a5176ad2bae62eb0a4eaec3ed482` に依存する、旧ToDoデザインCSS3件・合計**21,022 bytes**の物理ファイル整理。現行manifestには宣言されず、旧Ver.189契約のためテストがrootの存在を確認していた。元のCSSを既存アーカイブ `compat/frozen-legacy-runtime-v397.json` に追加し、Pagesで従来どおり旧3 URLに同一バイトで提供する。Ver.397の10件/62,756 bytes、Ver.401の2件/2,421 bytesの原本試験を維持し、追加の3件/21,022 bytesについて別の固定Git SHAと総容量を検証する。

| 旧ファイル名 | 元容量 | 元Git SHA1 | 原本 |
| --- | ---: | --- | --- |
| `ui-v144.css` | 12,517 | `8839cbd03f931d3b314560ef8641434caafb0521` | [Ver.400原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/91031a46f9a934f49c7daae2da12894d5e745b87/ui-v144.css) |
| `ui-v145.css` | 4,193 | `092d7ddda75c3399bd333407ae41aa29b7a0737e` | [Ver.400原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/91031a46f9a934f49c7daae2da12894d5e745b87/ui-v145.css) |
| `ui-v146.css` | 4,312 | `5539eb3a751f7ab6d92715332c03cb118d8a3a20` | [Ver.400原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/91031a46f9a934f49c7daae2da12894d5e745b87/ui-v146.css) |

- Ver.189のProtocolテストはmanifest非宣言とGit root不存在、互換原文・SHA固定の検査へ移行する。Ver.188の旧ToDo CSS参照フォールバックも既存アーカイブから原文を取得する。テストの機能的な期待値を削除しない。
- Pages stagingテストとpackaged Browserはアーカイブ全15 URLを実際に再生成・HTTP200・内容一致で検証する。元データ欠損・SHA相違・公開URL衝突はfail-closed。
- 現役HTML/JS/CSS、release-manifest/Release304、Firebase/Rules、認証、業務データには変更を加えない。rootから旧CSS3件が消えてもGit履歴と旧URLから原文を復元可能。アーカイブ・検証追加によるGit総容量は別途計測する。
- **Ver.401が正式完了するまでは本変更をmainに反映しない。** #319完了後、最新mainに同期し、PR exact-head4CI → main同SHA Regression/Pages → 復旧checkpointの受入条件を満たす。

## Ver.403候補：旧ワークフロー・モバイルCSS3件の原本固定と公開URL保全

Ver.402 PR #320 の検証用同期コミット `910b2c2a78c2b5c366f8907cbf9ff1916a5addfd` を起点に、manifest未登録の旧 `ui-v152.css`、`ui-v153.css`、`ui-v157.css` をGit現行ルートから整理する候補。原本は3件・**17,168 bytes**。旧HTMLのキャッシュや旧manifestがこれらを読み込む可能性があるため、公開URLは**同名HTTP200/元バイト完全一致**で残す。

| 旧CSS | 原本容量 | 不変Git blob SHA1 | 元Gitファイル |
| --- | ---: | --- | --- |
| `ui-v152.css` | 10,822 | `0b69629d6e953b953afa312aa9f0bfd14f3ab0c6` | [Ver.401原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/3db1c2cf5df8718f9def0f95f239f531d713b984/ui-v152.css) |
| `ui-v153.css` | 4,174 | `bc0ea83a2417721d18a4a1b7618ac9977529e8cc` | [Ver.401原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/3db1c2cf5df8718f9def0f95f239f531d713b984/ui-v153.css) |
| `ui-v157.css` | 2,172 | `c241129803d6a1fc4c6ff660a42c8940effc1e01` | [Ver.401原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/3db1c2cf5df8718f9def0f95f239f531d713b984/ui-v157.css) |

- 原本は既存 `compat/frozen-legacy-runtime-v397.json` へ追加し、Ver.397/401/402からの合計**18 URL**を不変マップで完全照合する。既存15件の本文は一切変更しない。新たなファイルは作らない。
- 旧 `workflow-css-v186` および `mobile-css-v187` のProtocolテストは、単純なroot存在確認を「現行manifestで読み込まない」「Git rootから削除済み」「アーカイブに原本保全」「SHA固定」へ置き換える。既存の実装CSSルール・順序に関するassertは残す。
- 追加したVer.403原本Git SHA/バイト検査とPages staging確認を通し、packaged Browserで旧18 URLのHTTP200/本文バイト一致を検証。改変・欠損・配布衝突時はfail-closed。
- **現役HTML/JS/CSS、manifest/Release304、Firebase/Rules、認証、業務データ、既存コピー保存処理は変更しない**。Git現行ファイル件数は3減る一方、アーカイブ増加があるため配布量減少やGit全履歴削除ではない。
- **Ver.402正式完了前のmain統合はしない**。先行main同期とPR exact-head 4CI、main同SHA Regression/Pages、checkpointをすべて要求する。

## Ver.404候補：旧デスクトップサイドバーCSS4件を旧URL互換のまま整理

Ver.403の先行完了を条件とする依存Draft PR。旧Ver.158/159/160/164のCSSは現行manifestと初期HTMLにはなく、現行 `ui-sidebar-v180.css` がサイドバースタイルを担当する。旧キャッシュが要求するURLは元のファイル名・同一バイトで維持する。

| 旧公開URL | 原本サイズ（bytes） | Git blob SHA |
| --- | ---: | --- |
| `ui-v158.css` | 7094 | `1a534e1300206d4ee2abbffc38df2746e205ee0b` |
| `ui-v159.css` | 2680 | `b211c2335405b579bbf345357a13c1fdc35ab801` |
| `ui-v160.css` | 6347 | `5b2b913b3cef0e9e8d606eaecb5431e0c4a9f7d6` |
| `ui-v164.css` | 3373 | `eb78f70e80dc414a1a7e8a335c0d62107238a168` |

旧CSS4件、合計 **19,494 bytes** をGitルートから退役し、既存18件と合わせた22件を `compat/frozen-legacy-runtime-v397.json` に原本保存する。既存アーカイブ項目・Git SHA・本文は不変。Pages builderは欠損・改変・キー重複・出力URL衝突・manifestへの旧資産再登録をfail-closedで検出し、packaged Browserが公開同名URLのHTTP200と本文一致を検証する。

Ver.180の旧CSS root存在確認テストを、root不在・固定SHAアーカイブ保持の契約に置換。現行CSS順序、旧CSSに由来するUI挙動の確認、本番HTML/JS/CSS、Release304、Firebase/Rules、認証、業務データには変更しない。Gitルートのファイル数整理であり、Git履歴・Pages配布容量を削減する施策ではない。

先行Ver.403のmain同SHA Regression/Pages成功・復旧checkpoint確認後に独立PR CIを実行し、exact-head4系統success→mainマージ→main同SHA Regression/Pages→checkpointを完了するまで、本Draftを正式反映しない。

## Ver.405候補：残存する旧コメント・業務メモ・表示密度CSS 4件の整理

前段Ver.404の正式完了を前提とする依存Draft。Gitルートでmanifest未宣言の残存旧CSS `ui-v165.css` / `ui-v167.css` / `ui-v168.css` / `ui-v176.css` の4件・合計23,262 bytesを対象とする。現行実行にはそれぞれ `ui-comment-reactions-v191.css` / `ui-work-memo-v190.css`・`ui-reserved-task-v190.css` / `ui-core-density-v188.css` の既存所有レイヤーがある。現行HTML、release-manifest、業務コード、保存処理は変更しない。

| 旧ファイル | 原本サイズ (bytes) | 固定Git blob SHA |
| --- | ---: | --- |
| `ui-v165.css` | 2,804 | `4d397719260b4328547216ae5b2b5b3c1eff54ad` |
| `ui-v167.css` | 8,216 | `dad6a9b8e866355762d9dcb6b34b394ef2e5c2f6` |
| `ui-v168.css` | 6,836 | `c1de2b5597c11361fe2ba642aeb275c02c0306c0` |
| `ui-v176.css` | 5,406 | `30eb5370132fa54e89a1f82bb8e2e7e3207bd830` |

既存アーカイブ22件を一切改変せず4件の原本を加え、26件の固定SHAと元URLをPagesで維持する。原本不一致・欠損・URL衝突・現行manifestへの誤登録はfail-closed。旧CSSを直接読むVer.191/190/188のProtocolテストは原本アーカイブ参照へ移し、過去のHTMLキャッシュ互換と現役CSSの役割分担を検査する。Packaged Browserの元バイトHTTP200検証も26件に拡張する。

次工程のmain受入はVer.404の正式完了（独立PR4CI、main同SHA回帰/Pages成功、checkpoint）以降のみ。Ver.405自身もmain retarget・exact-head4CI・expected-headマージ・main同SHA Regression/Pages・checkpointまでDraft維持。Git現行ルートのファイル数整理であり、公開旧URLやGit履歴・Pages配布容量の削減ではない。
