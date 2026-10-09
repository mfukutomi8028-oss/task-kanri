# Ver.382 Pages公開資産の分離（候補）

Issue #292の新工程。前提：Ver.381 main `595a384642dc70f7a4ab0d5777c9c18792726c78`。**製品JS/CSSやリリース304は変更しない**。

## 課題
従来のPages workflowは `path: .` でリポジトリ全体を公開対象にしていた。監査文書、回帰テスト、PNGスナップショット、Firebase規則、package等はサイト公開に不要。一方、旧ブラウザが要求する旧JS/CSS・画像は削除できない。

## 変更
`test-harness/build-pages-runtime-v382.mjs` は静的ホスティング対象のみを `.pages-runtime/` に**バイト単位でコピー**する。具体的にはrootの `.html` / `.js` / `.css` / `.nojekyll` および `assets/`全ファイル。旧リリースから参照される未宣言JS/CSS・画像も残すため、新旧キャッシュ互換は従来どおり維持する。rootのテスト・文書・非ランタイムJSONや設定を配布せず、Git履歴・リポジトリの元ファイルはすべて保持する。Pages workflowで上記stageの後にuploadする。

ビルド時はmanifestのrequired/optional/dynamic scripts/styles/mobile scriptsの存在とindex直接参照の存在を検査し、欠損時はデプロイを停止する。シンボリックリンクは assets内で許可しない。

## 検証とリスク
Protocolでビルドの正本ファイルとのbyte一致、旧PNG/旧画像の残存、開発資産の未配布、missing manifest時のfail-closedを確認。3系統CIをall successとしてからPRを採用し、mainのRegressionとPagesを同一merge SHAで確認する。実ページURLでは初回描画・PC/390px・画像404、キャッシュ済み旧HTML参照の実機確認も必要。これは**配布範囲を変更するPR**なので、Pages失敗や404が出たら元の `path: .` とworkflowをロールバックして再確認する。

今後の削除では、リポジトリ上の旧PNGは別工程で参照契約とキャッシュ残存期間を評価したうえで削除する。**このPRでは物理削除しない。**
