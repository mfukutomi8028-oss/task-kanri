# Ver.393：旧JS/CSSの物理退役判断に必要な証拠を定型化

## 目的と起点

起点は Ver.392 main `b534de7aa7a2b6e67b5c2a6be99a49479a111beb`、Issue #292 の旧ファイル整理。Ver.392のmain後CIがすべて成功するまでは、ここから次のmainマージを行わない。

現行の `test-harness/build-pages-runtime-v382.mjs` はルート直下のJS/CSSをすべてPagesへ配布している。そのため、**release-manifest未登録でも公開URLは実在する**。さらに、過去に取得したHTMLやmanifestが旧URLを要求する可能性がある。未登録ファイルや文字列参照が見つからないファイルを、そのまま「不要・削除可能」と扱うのは誤り。

## 再現可能な棚卸し

- `node test-harness/legacy-retirement-evidence-v393.mjs`：Markdownの判断材料表
- `node test-harness/legacy-retirement-evidence-v393.mjs --json`：同じ材料のJSON
- 対象：root直下のJS/CSSのうちrequired/optionalに未登録の実ファイル
- 記録：容量、現行コードの文字列参照元、テスト内の文字列参照元、文書参照数、宣言済み資産とのGit blob互換の可能性
- 完全一致ファイルも「公開URLを同じバイトで生成する方式」を別途設計・テストするまでは削除を許可しない
- 実行時の新規ダウンロード、Firebase操作、ファイル削除、manifest変更は行わない
- `.pages-runtime/` 等の生成物は棚卸しに含めず、同時並行のBrowser検証に結果が左右されないようにする

基準mainの未登録rootファイル数は **JS 35件 + CSS 21件 = 56件、373,659 bytes**。これは調査分母であり、削除可能件数ではない。Ver.393のCIで正本から再計算した集計を確認する。

## 判断ルール

各ファイルは次の5点が確認できるまで物理退役を保留する。

1. 現行HTML/JS/CSSの直接・間接ロード元と動的パス生成
2. Protocol/Browser/Firebaseのファイル内容・存在に関するテスト契約
3. GitHub Pagesの旧URLを同一内容で維持する方法
4. 現行資産への機能統合済みか、完全一致または意味的な非同一性
5. exact-headのProtocol/Browser/Firebase/Regression、mainのRegression/Pages、復旧チェックポイント

単なる`fs.readFileSync`等の存在やテスト・文書の文字列一致は、実際の実行依存を過大・過小評価する可能性がある。出力は**判断補助**であり、自動削除許可を出さない。

Ver.393は監査コード・テスト・文書の整備のみ。製品HTML/JS/CSS、Firebase、Rules、Release304、公開資産、ローダーは変更しない。
