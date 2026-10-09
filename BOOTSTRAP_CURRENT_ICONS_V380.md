# Ver.380 製品候補：初期HTMLの旧ナビ・集計画像を現行SVGへ統一

## 問題と目的

2026-10-09 時点の現行 `index.html` は、初期ナビゲーションとサマリー画像の大半を大容量の旧PNG/`?v=143`で定義していた。初回描画後に `release-manifest.js` のlegacy mapや `icon-system-v169.js` が現行SVGへ補正しているが、現行HTML自身もすでに同じSVGを指定できる。

このPRは**画像の初期参照のみ**を変更する。11件の静的`<img>`ソースを現行SVGに向け、10種の旧画像名を初期HTMLから除く。見た目や機能の既存仕様は維持する。Release/baselineを **304/304** に同期する。

## 明示的に変更しない範囲

- `index.html`の `brand.png?v=143`（favicon、サイドバー、通知icon）は変更しない。ブランド初回同期と旧ブラウザ復帰は別の専門テストに依存しているため、別監査で扱う。
- `release-manifest.js?v=143` / `config.js?v=143`、バージョン表示のVer.143プレースホルダーは従来のfirst-paint/version handoff契約を維持する。
- manifestの `legacyIconMap`、observer、assets-ready最終sweep、4秒fallback、`icon-system-v169.js`を変更しない。**キャッシュ済みの旧HTML・後から挿入される旧画像は従来通り現行SVGへ補正される**。
- 旧画像は**この段階では物理削除しない**。旧HTMLキャッシュや復旧に必要な可能性があり、物理削除は別PR/別リリースにする。
- JS業務データ処理、ToDo、スケジュール、Firebase transaction/notifications、ナビのイベント処理・CSSを変更しない。

## テスト

- `test-harness/bootstrap-current-icons-v380.test.mjs`：HTMLの旧画像不参照、現行SVGの存在、マニフェストの旧HTML互換表と旧ファイル保持、brand/bootstrap契約とRelease304/ledger304一致。
- `tests/bootstrap-current-icons-v380.spec.mjs`：1366px/390pxで現行ナビ/集計画像・brand画像、旧PNGのimageリクエストがなくassetsから404も出ないことを確認。
- 既存の全Protocol / Browser / Firebase Emulator、および厳格なアイコン視覚snapshot、Ver.276/277 first-paint、Ver.268/269旧画像補正、Ver.274以降のversion lifecycle、Brand/BFCacheの回帰をすべて実行する。

## 採否

PR exact-head全CI成功、最新main比較と依存競合確認、exact-head merge、main同SHA Regression/Pages green、復旧checkpoint確保。既存スナップショットはむやみに更新しない。ブラウザで旧PNG要求が観測された場合は対象を調べ、削除へ進まず修正する。旧キャッシュ参照の存続期間については観測可能データがないため**ゼロと仮定しない**。

本PRの段階では、Git上の旧PNGの物理サイズ削減はまだ生じない。次のリリースで必要な互換ファイルを選別し、数件ずつ削除する。Issue #292 のStage Bに対応。
