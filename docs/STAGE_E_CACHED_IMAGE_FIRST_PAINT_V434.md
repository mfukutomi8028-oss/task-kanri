# Ver.434 / Stage E — 過去HTMLの画像参照と現行SVGへのfirst paint移管

Issue #292。Ver.433のmain統合コミット `f509c45ae64dafba7d2d0bb8face6bc8496f0934` から分離したDraft候補。Ver.433 main同SHA CI/Pagesと復旧checkpointが完了するまで、統合しない。

## 既存の検証との関係

Ver.380では現行HTMLが最初から現行SVGを使うことを、Ver.433では旧画像13 URLが配布物のHTTPで取得でき、PNG元bytesと一致することを検証する。しかし、**旧形式のHTMLが古い画像参照のまま起動し、Release304のfirst-paint補正を通過するシナリオ**は、その2検査だけでは保証されない。

## 追加する検査

- Ver.433の旧互換マップにある画像12 URLを使い、旧 `?v=143` 参照がある最小合成HTMLをブラウザ内に用意する。過去の実HTML全体を復元して動かす試験ではない。
- `/task-kanri/` 配下のVer.433検証済みPagesパッケージを使用し、実 `release-manifest.js?v=143` により互換補正を実行する。
- 1366pxと390pxのブラウザで、`workboard:assets-ready` 後の各画像が明示した現行SVG `?v=304` へ切り替わり、first-paintが解除されることを確認する。
- local HTTP 4xx以上と実行時JavaScript例外が発生した場合は失敗とする。

既存の配布パッケージE2Eファイルの2テスト追加とこの文書以外は変更しない。現役HTML/JS/CSS、release-manifest、Pagesビルダー、画像blob、Firebase/Rules、認証、保存データ、Release304はすべて不変。旧画像の削除・圧縮もしない。

**制約**：合成マークアップによる静的起動確認であり、過去リリース全HTML/JSや利用者の実キャッシュ、Service Worker、CDN、オフライン起動、外部ブックマークを完全再現するものではない。テスト成功だけで旧PNGの削除は許可しない。

受入順序：Ver.433正式checkpoint→Ver.434独立exact-head Protocol/Browser/Firebase/Regressionすべてsuccess→expected-head main merge→同SHA main Regression/Pagesすべてsuccess→Ver.434 checkpoint。
