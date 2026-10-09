# Ver.379 候補：物理ファイル整理の参照棚卸し基盤

基準：main `24b462b0c566564dad8df5b0ea897f61d46513e3`（PR #290 merge後）。Issue #292。**監査のみで製品runtimeは一切変更しない**。正式Release 303 / baseline 303を維持。本PRはマージ済み機能修正 #290、物理削除候補 #291 と独立し、後続に再取得・統合確認する。

## 背景

古いJS/CSS/画像が大量に残っているが、`release-manifest.js`に宣言がないだけで直ちに不要とはいえない。キャッシュ済みHTML、非同期生成の画像、テスト契約、過去版へのロールバックなどが理由になりうる。手作業で少量ずつ削除するだけでは優先順位や保守上の全体像がつかみにくい。

## 追加する監査

- `node test-harness/asset-retirement-inventory-v379.mjs --json`：読み取り専用のJSON
- `node test-harness/asset-retirement-inventory-v379.mjs`：Markdown表
- 調査対象：root直下のJS/CSS、`assets/`のPNG/SVG。テストのsnapshot画像は対象にしない。
- 分類：manifest宣言済、現役HTML/JS/CSSから文字列参照あり、テストから参照あり、**人による精査候補**。
- 現役参照元にHTML、`app.js`、`config.js`、`release-manifest.js`、required/optionalのJS/CSSを含める。テスト参照と文書での言及も別に保持する。
- バイト数、件数、宣言済みだが実ファイルが存在しないものを表示する。
- 自動削除、名称変更、バンドル再配置、manifest更新、Firebaseデータ操作、ネットワーク通信は**一切行わない**。

## 品質保証と制限

`test-harness/asset-retirement-inventory-v379.test.mjs` を既存Protocol suiteへ追加し、合成fixtureで分類の4区分、旧ブラウザ起動時画像の参照認識、テスト依存、読み取り専用、既存の `work-features-v167.js` が参照する `assets/nav-memo-v167.svg` の保持、manifest宣言漏れを確認する。

**文字列検索は参照の過小評価や過大評価がある。** 動的パス連結、過去キャッシュ、GitHub Pagesの旧配信、過去ロールバックには適用限界がある。したがって「candidate-manual-review」は削除許可ではない。削除PRでは別途実ブラウザのネットワークリクエストと復旧可能性の確認が必要。

## 受入と統合

PRのlatest headでProtocol・Browser・Firebase Emulator全success、main反映後Regression/Pages successとcheckpointまで行い正式完了。本PRは監査道具であり現行機能やリリース番号を変更しない。PR #290が先にmainへ入った場合は、package.jsonのtest:protocolを現在のmain内容に統合し、追加試験の登録が欠落しないか確認する。PR #291が先にmainへ入った場合は、削除済みファイルを棚卸し対象から自然に除外し、既存旧ファイル保持テストの整合を再確認する。

同じ起点SHAの分類数と候補ファイルごとの保持理由を Issue #292 に継続記録する。
