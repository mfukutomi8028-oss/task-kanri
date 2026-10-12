# Ver.426：ルートMarkdownの参照証拠を再現可能にする（Issue #292）

## 起点と目的

Ver.425依存候補。本PRはVer.425をmainへ正式受入する前に作成したDraftであり、Ver.425のCI・main同SHA Regression/Pages・復旧checkpoint完了までVer.426をmainへ統合しない。

ルートMarkdown 81件について、ファイル名がどのGit管理テキストファイルに記載されているかを、レビューできる証拠として出力する。単なるファイル名文字列の一致で削除を決定しない。

## 使用方法

```bash
node test-harness/root-markdown-reference-v426.mjs
node test-harness/root-markdown-reference-v426.mjs --json
node --test test-harness/root-markdown-reference-v426.test.mjs
```

- `git ls-files --stage -z`を起点に、Git管理下にあるルート`.md`のパスとGit blob SHAを固定する。
- 他の管理対象テキスト（Markdown、JS、MJS、HTML、JSON、YAML、スクリプト等）から、正確なファイル名境界を考慮した文字列一致を集める。部分文字列だけの誤検知を減らす。
- JSON出力では、参照元のファイルパス、行番号、短い該当行、文書・テスト/ツール・その他コードの概分類を記録する。
- レポート自身とスキャナのフィクスチャテストは参照元から除外し、記録によって集計が自己汚染されないようにする。
- ファイル読取失敗はJSONの`readErrors`へ記録し、CLIの終了コードを非ゼロにする。ゼロ一致を削除許可と解釈しない。
- Git管理ファイルを追加・削除・更新する処理はない。レポートをファイル化する場合も一時領域を選び、監査対象へ混ぜない。

## 解釈上の限界

ファイル名への**静的言及**と、動作時の**実際の依存**は別のもの。コード内のコメント、歴史的引用、テスト文字列は過剰に数えられる可能性がある。一方、動的なパス生成、旧HTMLのキャッシュ、ブラウザの旧URL要求、GitHub Issue内のリンクなどは捕捉できず、ゼロ件でも削除の根拠にはならない。対象は列挙された拡張子のGit管理テキストのみ。

出力を参考に、README/他文書/コード/テスト/CIからの実依存を個別確認し、現行入口・過去監査・復旧証拠に分類する。最初の整理候補は少数の別PRとして独立させ、Git SHAと復旧手順、必要なリンク修正、CI回帰を証明する。

## 変更境界・安全ゲート

追加：スキャナ1ファイル、Protocolテスト1ファイル、説明文書1件。変更：package.jsonの`test:protocol`へのテスト追加のみ。現役アプリJS/CSS/HTML、Release304、配布アセット、Firebase/Rules、保存データは不変。

Ver.425正式受入後に最新mainへ差分を内容不変同期し、Ver.426独立exact-head Protocol/Browser/Firebase/Regression全成功、expected-head mainマージ、main同SHA Regression/Pages成功、復旧checkpointを必要とする。
