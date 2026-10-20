## Ver.506：Pages配布物のバイト単位フィンガープリント

Ver.505の正式main `37dd9f97f7c4c3e001d1a277ebd22ad84269e78f` 起点。Stage C/Eの既存read-only棚卸しで資産89件（宣言済78、旧URL alias原本1、runtime参照9、開発専用設定例1）を監査し、直接の削除レビュー候補は0件でした。8つの旧大型PNGはキャッシュ互換を理由に保持し、現役assetと旧URLの削除は行いません。分類はテキスト依存を完全に網羅するものではなく、削除権限を意味しません。

以前のPages buildログの `files=156 / bytes=13,057,134` は、同じサイズの別内容・URL名変更を見逃します。`test-harness/pages-payload-fingerprint-v506.mjs` は、ステージされた `.pages-runtime` 内の全通常ファイルについてUTF-8の相対パス・実バイト数・各ファイルSHA-256を安定順序で集計し、一覧全体のSHA-256を表示します。タイムスタンプ・ファイルの作成順に依存せず、同サイズの内容破損とURL名変更を検出します。シンボリックリンクや空のステージは拒否します。

Pages Workflowに **読取専用ステップ**をステージング後・アップロード前に追加しました。ビルダー本体、生成ファイル、URL、公開先、Release304、Firebase Auth/Rules/Writer、業務データ、既存テスト基準は変更しません。SHA-256値はリリース間で比較する監査指標で、SHA一致は公開CDNが正常配信された証拠にはなりません。

再現手順：

```bash
node test-harness/build-pages-runtime-v382.mjs
node test-harness/pages-payload-fingerprint-v506.mjs .pages-runtime
```

`test-harness/pages-runtime-v382.test.mjs`で、書込み時刻・順序による非変化、同サイズ内容差、同サイズURL名変更、空ディレクトリ／リンク拒否、ステージ再構築時の完全一致、およびPages workflowへの配線を確認。PR exact-headのProtocol/Browser(1)/(2)/Firebase/Regression全成功→main expected-head merge→同SHA main RegressionとPages build/deploy成功→checkpoint一致が受入条件。
