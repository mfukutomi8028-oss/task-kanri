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

## Ver.406候補：旧サイドバー補助JS・無動作密度JS 3件の原本保持とroot整理

Ver.405正式完了を前提とする依存Draft。現行manifestで読み込まれない `core-view-density-v188.js` / `desktop-sidebar-compat-v159.js` / `sidebar-polish-v160.js` の3件をGitルートから退役する。前者はVer.223でDOM更新を持たない互換シェル、後二者は現行 `desktop-sidebar-v242.js` に役割が移管されている旧補助コードである。ただし旧HTML・キャッシュには同名URLの配布を継続する。

| 旧URL | 元バイト数 | 不変Git blob SHA |
| --- | ---: | --- |
| `core-view-density-v188.js` | 614 | `3567e01412d60f63488d6a1e3af5bde362fb47d5` |
| `desktop-sidebar-compat-v159.js` | 1,139 | `16aa67ad13df990d56221dfddb6a1a7ff8c91d5b` |
| `sidebar-polish-v160.js` | 777 | `e042dabb9b440a2e0c8b461344671020ab1540a3` |

計3件・**2,530 bytes**。既存アーカイブ26件を一切改変せず、上記3件を追加して29件の原本を元Git blob SHAで固定。Pagesビルダーが旧URLへ全原文をバイト完全一致で復元し、キー不整合・原文破損・二重URLをfail-closed検知する。Ver.318/242 sidebarテストは旧補助スクリプト本文をアーカイブから参照する契約へ移行し、Ver.181に残る原実装コード・実行順および現役Ver.242の責務チェックを維持する。Ver.224 densityテストの「DOM処理・observerを持たない」確認も従来どおり実施する。

製品HTML/JS/CSS、release-manifest/Release304、Firebase/Rules、認証・業務データには変更なし。Git root物理ファイル数を減らす整理であり、旧URL、Pages配布量、Git履歴の削減ではない。

**実行ゲート**：先行Ver.403→Ver.404→Ver.405それぞれのPR exact-head4CI、main同SHA Regression/Pages、復旧checkpointを確認後、Ver.406を最新mainへretarget/同期して独立CIを実施する。それまでは本Draftをmainへ統合しない。

## Ver.407候補：旧バージョン表示サイドカーJS 1件の原本固定整理

Ver.406が独立CI・main同SHA回帰/Pages・checkpointまで正式完了した後にのみ統合する依存Draft。現行manifest・初期HTMLに読み込まれない `version-display-lock.js` をGitルートから退役する。ただし旧ブラウザキャッシュが同一URLへアクセスした場合は**元の1,679 bytesを一切変えずに配布**する。

| 旧URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `version-display-lock.js` | 1,679 | `1b19cf9d31f09af041d2894de327e05ff4f9f614` |

既存29件の互換アーカイブを不変のまま30件へ追加し、Pagesビルダーで固定SHA・キー重複・元URLの二重存在・manifest再登録をfail-closed検査する。旧Ver.194/231/232のProtocolテストはアーカイブから原文を読み、旧実装のバージョン同期・クラス変更・pageshow/focusリカバリの契約を維持する。現行 `config.js` と `ui-version-display-v232.css`、起動HTML、manifest、Release304、Firebase/Rules、ユーザーデータ、Browserシナリオは変更しない。

本Draftは旧JS1件のGit root削除と既存アーカイブ・ビルダー・5件の既存テスト・説明文書の8件修正（計9ファイル）のみ。現行root整理であり、Git履歴・Pages配布バイト数の削減ではない。Ver.406の正式main受入後にretarget/syncしてVer.407独立exact-head4CI→expected-headマージ→main同SHA Regression/Pages success→checkpointを実施するまでは、mainへ反映しない。

## Ver.408候補：旧Schedule TodayサイドカーJSの原本保持とGitルート整理

前段Ver.407のmain正式完了を前提とする依存Draft。現行 `app.js` がSchedule Todayのアンカー・移動・日付変更・画面再表示の責務を担うため、現行manifest/起動HTMLにはない `schedule-today-lock-v129.js` をGitルートから退役する候補。ただし旧HTML/ブラウザキャッシュの要求する**同名URL・元の3,277 bytes**は維持する。

| 旧公開URL | 原本バイト数 | 固定Git blob SHA |
| --- | ---: | --- |
| `schedule-today-lock-v129.js` | 3,277 | `6297fb42494ed656ee00e7589ded6f9abb158609` |

既存の互換アーカイブ30件は内容不変のまま31件に追加。Pagesビルダーの不変Git blob SHA照合と旧URLの原文復元、キー不一致・原本改変・URL重複・現役manifestへの再登録をfail-closedで拒否する契約を維持する。Ver.194/226のProtocolテストは旧Scriptのroot直接読みからアーカイブ原文へ移し、旧コードの `installScheduleTodayLockV129` と現行 `app.js` のアンカー制御・日境界・復帰時同期のassertを残す。現行HTML/JS/CSS、manifest/Release304、Firebase/Rules、認証、保存済み業務データは変更しない。

差分は旧Script1件のGit root退役と既存互換アーカイブ・Pagesビルダー・Protocol/Pagesテスト4件・説明文書の7ファイル更新（計8ファイル）。公開旧URLやPages公開容量、Git履歴の削減ではない。

**統合ゲート**：Ver.407の独立PR 4CI成功、main同SHA Regression/Pages成功、checkpointを確認した後にのみ本候補をmainへretarget・同期。独立exact-head4CI→expected-head mainマージ→main同SHA Regression/Pages成功→checkpointまでDraftを維持する。

## Ver.409候補：旧Stable Today補助JS 1件を原本固定でGitルート整理

Ver.408正式main完了を前提とする依存Draft。現行manifestと初期HTMLから実行しない `stable-fixes-v108.js` 1件をGitルートから退役し、旧ブラウザキャッシュ/HTMLが同じURLを要求した場合の原本文字列と5,088 bytesは不変のままPagesに配布する。

| 旧URL | 原本サイズ | 元Git blob SHA |
| --- | ---: | --- |
| `stable-fixes-v108.js` | 5,088 bytes | `b358b5b5ee12ada9c5e906073ae7cf339a408f5d` |

`compat/frozen-legacy-runtime-v397.json` の既存31件を一切改変せず、原本1件を追加して32件へ。現行アプリではToday表示や対象者・保管キー解決を `app.js` が担当し、旧stableの重複責務は現行実行対象外。Ver.194/219のテストとrelease契約を旧ファイルの物理存在・直接読込から不変アーカイブ参照へ移し、従来の旧実装検査と現行Today処理のassertを残す。Pagesは旧URLの元バイトを生成し、原本SHA変更・キー不整合・二重公開URL・manifest再登録をfail-closed検知する。

差分は旧JS1件削除と互換アーカイブ・Pagesビルダー・Protocol/Pagesテスト8件・説明文書の11ファイル更新（合計12ファイル）。現行HTML/JS/CSS、manifest/Release304、Firebase Rules、認証、業務データは変更しない。Gitルート整理であり、公開URL・配布バイト・Git履歴の削減ではない。

**依存ゲート**：Ver.408独立PR4CI→expected-head main merge→main同SHA Regression/Pages→復旧checkpointの正式完了後にだけ、本Ver.409をmainへretarget/syncする。Ver.409自身も独立exact-head4CI→expected-head merge→main同SHA Regression/Pages→checkpointをすべて確認するまでDraftのまま保持する。

## Ver.410候補：旧業務メモ画面補助JSの原本固定とGitルート整理

前段Ver.409が独立PR 4系統CI・main同SHA Regression/Pages・checkpointまで正式完了した後にのみ統合する依存Draft。現行manifest/初期HTMLで実行しない `work-features-ui-v168.js` をGitルートから退役する。ただし過去のHTML/ブラウザキャッシュは同名URLを要求し得るため、**元の4,709 bytesと公開URLは一切変更しない**。

| 旧URL | 原本サイズ | 元Git blob SHA |
| --- | ---: | --- |
| `work-features-ui-v168.js` | 4,709 bytes | `8e81ee3a52539caa370af0dc3282b9798d07c3d2` |

現行業務メモUIは `work-features-ui-v190.js`、CSSは `ui-work-memo-v190.css`・`ui-reserved-task-v190.css` が担当する。旧Ver.168補助コードは現行起動対象外だが、Ver.188/190のProtocolテストに旧DOM操作・UI挙動の原文契約があるため、元コードをSHA固定アーカイブで維持する。

互換アーカイブの既存32件は改変せず33件へ追加。Pagesビルダーは元Git SHAを照合して旧URLへ元バイトで再生成し、キー不一致・改変・旧URL二重存在・現行manifest再登録をfail-closedで拒否する。既存の旧DOM/UI検査と現役UI所有権検査を維持する。差分は旧JS1件のGit root退役、既存アーカイブ、Pagesビルダー、Protocol/Pagesテスト4件、説明文書の7ファイル修正（計8件）。現役HTML/JS/CSS・manifest/Release304・Firebase/Rules・保存済み業務データは変更しない。Git root整理であり、Git履歴やPages配布量を減らす工程ではない。

**安全ゲート**：Ver.409の正式main受入後にVer.410をmainへretarget・tree不変同期して独立exact-head4CIを実施。全success後にexpected-head mergeし、main同SHA Regression/Pages成功・checkpointまで確認する。ゲート完了までは本Draftをmainへ統合しない。

## Ver.411候補：旧ワークスペース表示密度JS 1件のGitルート整理

前段Ver.410の正式完了を前提とする依存Draft。現行manifestと初期HTMLに読み込まれない旧 `workspace-density-v176.js` 1件（6,561 bytes）をGitルートから退役する。旧ブラウザキャッシュからの公開URL要求には、元の本文をバイト完全一致のまま配布する。

| 旧公開URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `workspace-density-v176.js` | 6,561 | `cab53dbd3ac066b015cca1d48da079c697f67a95` |

既存の `compat/frozen-legacy-runtime-v397.json` 33件は不変で、新たな原本1件を追加して34件にする。Pages生成時に旧原本Git SHA・重複URL・manifest再登録・アーカイブキー・二重配布をfail-closed検査する。旧Ver.188/224のProtocolテストではrootに旧JavaScriptが物理存在する条件を廃止し、アーカイブに保存された元本文と固定Git SHAを確認する。現行 `ui-core-density-v188.css`、`app.js`、HTML、manifest/Release304、Firebase Rules、業務データは変更しない。

差分は旧JS1件の削除と、既存アーカイブ・Pagesビルダー・Protocol/Pagesテスト3件・説明文書の6ファイル更新、合計7ファイル。旧URL、Pages配布バイト、Git履歴の削減ではなく、Gitルートに残る過去コードの物理的な整理を目的とする。

**統合条件**：Ver.409およびVer.410を順番にPRの独立4CI→main expected-headマージ→同SHAのRegression/Pages success→checkpointまで正式完了した後に、本Draftをmainへ同期する。本PR自身も独立exact-head4CI→expected-headマージ→main同SHA Regression/Pages success→checkpointまでDraftを維持する。

## Ver.412候補：旧Quick Task UXサイドカーJSの原本保存とGitルート整理

前段Ver.411の正式完了を前提とする依存Draft。現行manifest/初期HTMLの実行対象から外れた `task-ux-v146.js` 1件・**6,306 bytes**をGitルートから整理する。旧HTML/ブラウザキャッシュが要求する公開URLは維持し、元バイトをそのまま配布する。

| 旧公開URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `task-ux-v146.js` | 6,306 | `3597eeadbfaa414f3f171fdae47ba10adc6464c5` |

現在のクイックタスク状態変更は`app.js`が管理し、ダイアログの未保存破棄などは`dialog-lifecycle-v239.js`が担当する。旧scriptのロジックは現行実行対象外だが、Ver.238の所有権ProtocolテストとVer.189リリース契約が元コードを直接読んでいたため、アーカイブ原文・固定SHAの検証に移管する。過去のクイックステータス・ソート責務分離・ダイアログ契約は維持する。

互換アーカイブ既存34件は内容不変のまま35件へ追加し、Pagesビルダーは元Git SHAで検証して旧URLへバイト完全一致で復元する。キー衝突、原本改変、二重物理URL、現行manifestへの再登録はfail-closedとする。差分は旧JS1件削除、既存アーカイブ・ビルダー・frozen/Pages/Protocol/release検証5件と説明文書の7ファイル更新（計8件）。現役HTML/JS/CSS、manifest/Release304、Firebase/Rules、認証、業務データは変更しない。Gitルートの整理であり、公開旧URL、Pages配布量、Git履歴を減らす工程ではない。

**安全な受入順序**：先行Ver.410→411それぞれ独立PR exact-head4CI success→expected-head mainマージ→main同SHA Regression/Pages success→復旧checkpointが完了してからのみ、本候補をmainへretarget・同期。本候補自身も独立4CI→expected-headマージ→main同SHA Regression/Pages・checkpointまでDraft保持する。

## Ver.413候補：旧ユーザーUX統合補助JSの原本固定とGitルート整理

Ver.412が独立PR 4系統CI・main同SHA Regression/Pages・復旧checkpointまで正式完了することを前提とする依存Draft。現行manifestと初期HTMLが読まない `user-ux-polish-v208.js` 1件をGitルートから退役する。一方、旧HTML/ブラウザキャッシュが要求する公開URLは元バイトのまま継続提供する。

| 旧公開URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `user-ux-polish-v208.js` | 7,458 | `78b32923d6e64f33197e55e26f12118dc0cb5980` |

現行の「お気に入り」表示・旧コントロール非表示は `favorite-ui-v237.js`、未保存破棄ダイアログは `dialog-lifecycle-v239.js` が担当する。旧補助JSの内容は変えず固定アーカイブで保持する。既存35件の原文は変更せず1件追加して36件へ拡張。Ver.237 Protocolテストの旧root物理存在条件はアーカイブ原文・固定Git SHA検査へ移管し、現行所有権assertとブラウザ回帰テストは維持する。

Pagesビルダーは旧公開URLへの原本バイト復元を継続し、archiveキー不整合・Git SHA変化・重複URL・manifestへの再登録をfail-closedで拒否する。旧JS1件物理削除と既存アーカイブ・Pagesビルダー・frozen/Pages/所有権テスト・文書6件の更新、計7ファイル。現行HTML/JS/CSS、manifest/Release304、Firebase Rules・認証・保存済みデータには変更なし。Git履歴・Pages配布バイトの削減ではない。

**依存ゲート**：Ver.412正式受入後に本Draftを最新mainへ内容不変で同期し、独立exact-head4CI全success→expected-head merge→main同SHA Regression/Pages成功→復旧checkpointまで確認する。Ver.412が未完了の間はmainへマージしない。

## Ver.414候補：旧デスクトップサイドバーV158原本固定とGitルート整理

先行Ver.413が独立PR4CI・main同SHA Regression/Pages・復旧checkpointまで正式完了してから統合する依存Draft。旧 `desktop-sidebar-v158.js` は現行manifest/初期HTMLから起動されず、現役サイドバー状態管理は `desktop-sidebar-v242.js` に統合済み。歴史的ブラウザキャッシュが旧URLを要求しても同じ原文を提供する。

| 旧公開URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `desktop-sidebar-v158.js` | 7,921 | `fec221ed24293d7139dcaedd7967588efae8ce34` |

固定アーカイブの既存36件は変更せず1件を追加して37件。元Git SHA・原文・公開URL・アーカイブキー全一致、manifestへの再登録やGit rootとの二重URLをビルダーでfail-closed検査する。Ver.318のリリース契約はv158の旧root物理存在からアーカイブ原文とSHA固定へ移行し、従来のv158→v159→v160原文実行順序と `desktop-sidebar-v181.js` の旧互換ロジック検査を維持する。

差分は旧JS1件物理削除とアーカイブ/ビルダー/frozen・Pages・releaseテスト/説明文書6件更新（計7ファイル）。現役HTML/JS/CSS、manifest/Release304、Firebase Rules/認証・業務データは一切変更しない。Git履歴・旧公開URLやPages配布バイトの削減ではない。

**安全ゲート**：Ver.412→Ver.413が正式完了してから本Draftを最新mainへ内容不変同期。自身のexact-head Protocol/Browser/Firebase/regression 4CI全成功後にexpected-headマージし、main同SHA Regression/Pages成功・復旧checkpointまで完了するまではDraftを維持する。

## Ver.415候補：旧統合デスクトップサイドバーJSの原本固定とGitルート整理

Ver.414の独立PR4CI・main同SHA Regression/Pages・復旧checkpointまで正式完了した場合に限り統合する依存Draft。旧 `desktop-sidebar-v181.js` は現行manifest・初期HTMLから起動されず、現役サイドバー状態制御は `desktop-sidebar-v242.js` が担当する。旧ブラウザキャッシュがV181 URLを要求した場合は、元本文をバイト完全一致で配布し続ける。

| 旧公開URL | 元サイズ | Git blob SHA |
| --- | ---: | --- |
| `desktop-sidebar-v181.js` | 10,302 bytes | `6f4a3b5002a0025e25361fc56c3294cf7e7ce09e` |

既存の互換アーカイブ37件は変更せず元原本1件を追加し38件へ拡張。PagesビルダーはGit原本SHA、URL重複、原本欠損、現行manifestへの誤登録をfail-closed検査する。旧V158→V159→V160の結合順序と、現役V242のサイドバー責務を確認するProtocolは維持し、旧V181のGitルート存在・直接読込に依存した部分だけ原本アーカイブ参照へ移管する。旧URLと元バイトのPages提供は継続する。

差分は旧JS1件の削除、互換アーカイブ・Pagesビルダー・frozen/Pages・release/sidebar Protocolテスト・説明文書7件の更新、計8ファイル。現役HTML/JS/CSS、release-manifest/Release304、Firebase Rules、認証・保存済みデータは変更しない。Git履歴やPages配布バイトを削減する目的ではない。

**安全ゲート**：Ver.414正式main受入後のみ本Draftを最新mainに内容不変で同期。独立exact-head Protocol/Browser/Firebase/regression全success→expected-head mainマージ→main同SHA Regression/Pages success→復旧checkpointを完了するまでDraft維持。

## Ver.416候補：旧メンション選択補助JSの原本固定・Gitルート整理

Ver.415の独立4系統CI・main同SHA Regression/Pages・復旧checkpointまで正式完了することを前提とした依存Draft。現行manifestと初期HTMLに登録のない旧 `mention-picker-v156.js` は現役実行対象から外れており、現在のメンション選択処理は `comment-mentions-v191.js` が担当する。現行処理の所有権・UI/入力操作・既存業務データには触れない。

| 旧公開URL | 原本バイト数 | 元Git blob SHA |
| --- | ---: | --- |
| `mention-picker-v156.js` | 9,329 | `1b42dff9e70c584592c70a4abb0bc35e1437461b` |

旧ブラウザキャッシュの同名URLを継続提供するため、互換アーカイブの既存38件は変更せず、元原本1件を追加して39件へ拡張。Pagesビルダーは固定Git blob SHA、URL重複、原本欠損、現役manifestへの再登録をfail-closedで検査する。旧原本の物理的削除に加え、frozen/Pagesテストを原本・公開URLバイト一致検証へ拡張し、現役 `comment-mentions-v191.js` の実行責務は維持する。

差分は旧JS1件の削除と既存アーカイブ・Pagesビルダー・frozen/Pages・Ver.191/215所有権テスト・文書6件の更新、計7ファイル。現役HTML/JS/CSS、release-manifest/Release304、Firebase Rules、認証、保存済みデータは変更しない。Git履歴・配布バイトの削減ではなくGitルート整理を目的とする。

**安全ゲート**：Ver.415の正式main受入後に本Draftを最新mainへ内容不変で同期し、独立exact-head Protocol/Browser/Firebase/regression全成功→expected-head mainマージ→main同SHA Regression/Pages成功→復旧checkpointを完了するまでDraft維持。

## Ver.417候補：旧コメントリアクションV165 JSの原本固定・Gitルート整理

前段Ver.416の正式main受入（独立4CI→main同SHA Regression/Pages→checkpoint）を必要とする依存Draft。現行manifestと初期HTMLから起動しない旧 `comment-reactions-v165.js` を整理する。現役コメントリアクションの操作・書込・通知は `comment-reactions-v191.js` が担当し、同ファイルや保存済み業務データには変更を加えない。

| 旧URL | 元サイズ | Git blob SHA |
| --- | ---: | --- |
| `comment-reactions-v165.js` | 12,462 bytes | `903fb43ff47debe831c5a66f67e259aa8a69988e` |

既存39件の不変アーカイブ原本は維持し、V165原本1件を追加して40件へ。Pagesビルダーは元Git blob SHA、旧URL衝突、manifest誤登録、原本欠損をfail-closed検査。frozen/Pages Protocolを旧URLと原本バイトの検証に拡張する。

旧JSのGit root削除1件＋互換アーカイブ/ビルダー/frozen・Pages・Ver.191/215所有権テスト/文書6件更新、計7ファイル。現役HTML/JS/CSS、Release304、Firebase Rules・認証・業務データは変更しない。Git履歴やPagesの公開旧URL・配布バイト数は削減しない。

**依存ゲート**：Ver.416の正式main受入後に本Draftを最新mainへpayload不変同期。独立exact-head Protocol/Browser/Firebase/regression 4CI全成功→expected-head mainマージ→main同SHA Regression/Pages成功→復旧checkpointまで完了するまではDraftのまま保持する。
