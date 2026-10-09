# Ver.383：配布パッケージの実ブラウザ検証（候補）

起点main：`8ef43e663000bd69b6ab45f6babe4e8cf237de40`（Ver.382 Pages成果物整理）。
Issue #292。Release/baselineは**304/304のまま**。製品JS/CSS、業務データ構造、Firebase通信・保存処理、公開ビルド、Release値を変更しない。

## なぜ必要か

Ver.382のProtocolは「配布対象のコピーとmanifest登録ファイルの存在」を検証する。しかし既存のBrowser回帰はリポジトリrootを静的配信するため、実際のPages向け `.pages-runtime/` をブラウザで起動した場合の404や、配布対象から除外した開発ファイルが本当にアクセスできないことまでは確認できない。

## 追加する検証

`tests/pages-packaged-browser-v383.spec.mjs` は、既存の読み取り専用ビルダー `buildPages()` を使ってStageを生成し、同一Playwrightジョブ内でローカルランダムポートから `/task-kanri/` サブパスとして配信する。以下を**1366px/390px**でそれぞれ確認する。

- リリース304、assets-ready、初回表示guard解除、ブランド・ナビSVGの現行参照
- 今日→タスク→今日のナビ、画面内エラー・配布済み資産HTTP 404の不存在
- 旧ブラウザ互換資産 `assets/nav-done.png` および `date-keyboard-fix-v127.js` はHTTP 200で取得可能
- `README.md`、`package.json`、`firebase-rules.json`、`REGRESSION_TESTS.md`、`test-harness/static-server.mjs` はHTTP 404
- ブラウザ外部通信はブロックし、Firebase本番データを書き込まない
- 作成した `.pages-runtime` とHTTPサーバーをテスト終了時に削除/終了する

## 受入と注意

- exact-headでProtocol/Browser/Firebase/最終regressionゲートすべてgreen後のみマージ
- マージ後main Regression・Pages success、および復旧checkpoint
- PlaywrightはPagesの成果物コピーそのものを再現するが、GitHub Pages CDN・キャッシュ・カスタムドメイン・公開認証を完全には再現しない。Pagesの成功とライブHTTPの実測は別扱い
- 旧PNGの**物理削除は別工程**。旧HTMLキャッシュ互換を保ち、リポジトリから旧URLを消さない

これにより、公開配布の事故を先に検知してから次の旧ファイル削除へ進める。
