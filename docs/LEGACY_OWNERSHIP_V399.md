# Ver.399候補：旧JS/CSSの依存関係を監査して整理優先度を確定

## 起点と目的

Ver.398正式完了main `a6571c910ec5c2b94d10fc3f5268601b87c2d5a2`、Issue #292。Ver.397で参照文字列が見つからない旧ファイル10件の現行root物理退役は完了した。残るroot直下のmanifest未登録JS/CSSは**40件、276,310 bytes**（Ver.397のProtocolから再計測）。本工程はそれぞれの参照元、過去互換、テスト契約を可視化する**読取専用の監査**である。

| 分類（静的ファイル名の一致） | 件数 | 一次判断 |
| --- | ---: | --- |
| 現行コードとテスト両方から参照 | 13 | 現役依存を優先調査 |
| 現行コードのみから参照 | 3 | 実際のロード方式を優先調査 |
| テストのみから参照 | 24 | テストが元ファイルの実在・内容・旧URLのいずれを契約にしているか確認 |
| どちらからも参照なし | 0 | なし |

上記はVer.397基準のヒューリスティック集計であり、ファイル削除可否ではない。動的ロード、過去版HTML、ブラウザキャッシュ、CIが名前の文字列検索だけでは捉えられない場合がある。

## 再現方法と証拠

- `node test-harness/legacy-ownership-v399.mjs` は現存する旧JS/CSS全件について分類、原本Git blob SHA、参照元、該当行と推定用途（可能なファイル参照／可能なassert／文字列のみ）、維持すべき旧Pages URLの注意事項をJSON出力する
- `node --test test-harness/legacy-ownership-v399.test.mjs` は既存Ver.393監査結果との件数・バイト数・参照元一致、原本ファイルの存在、削除不可の明示、参照行の取得を検証する。CIでは `VER399_OWNERSHIP_SUMMARY` と `VER399_OWNERSHIP_ROW` を全件ログ出力する
- 「テストのみ」24件でも元ファイルを直接開くテスト、境界テストでコードとして評価するテスト、文面だけを確認するテストなど契約が異なる可能性がある。参照行の推定ラベルは**必ず原文を目視して確定**する
- 次の物理退役候補は、現行ランタイム利用がないことを別途確認し、旧URLを元バイトのまま保ち、現行テストの意味を損なわず、Git SHAとPages BrowserのHTTP200/同一バイトを検証できるものだけ選ぶ

## 変更範囲とゲート

本Ver.399は監査スクリプト、Protocolテスト、説明文書、package.jsonへのテスト登録のみ。**現役のHTML/JS/CSS、旧root JS/CSS、release-manifest、Pagesビルダー、Firebase/Rules/Authentication、業務データ、Release304を変更しない**。Git履歴容量削減やPages配布削減は本監査の目的ではない。

Draft PR exact-headのProtocol/Browser/Firebase/Regression全success、mainマージ後の同SHA Regression/Pages成功、復旧チェックポイントを必須とする。次の実削除は別PRで実施し、名前の参照ゼロ・「test-only」という分類だけでは決して削除しない。
