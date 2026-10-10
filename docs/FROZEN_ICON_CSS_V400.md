# Ver.400候補：旧アイコンCSS3件の物理退役と旧URLの完全互換

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
