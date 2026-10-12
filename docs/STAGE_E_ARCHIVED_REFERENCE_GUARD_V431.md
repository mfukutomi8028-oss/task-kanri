# Ver.431 (Stage E) — 退役文書の実行参照ガード

Issue #292。正式受入済みVer.430 main `ac339308f5531d06295ca12a7b9b23ed8ba50150` を起点とする。Ver.430のmain同SHA Regression #38233542894 とPages #38233543007 は全成功し、復旧ブランチ `backup/ver430-shared-root-audit-ledger-validated-checkpoint` が同じSHAを指すことを検証済み。本Ver.431は独立CI・main回帰・専用checkpointで判定する。

## 背景と目的

Ver.430初回の旧モバイル監査8文書削除候補は、現役Protocolテストが退役文書を直接読み込んでENOENTとなり不採用となった（Actions #38230883779）。ファイル名検索で見つからないことだけを削除許可の根拠にできない。

## このバージョンの検査範囲

- Ver.430の共通台帳 `docs/HISTORICAL_ROOT_AUDIT_LEDGER_V430.md` から旧root文書と固定Git原本SHAを抽出する。将来の行追加も同じガードに反映する。
- Git管理された JS/MJS/TS/HTML/JSON/YAML/CSS/PowerShell/Shell 等のテスト・設定・実行用テキスト内で、退役済みMarkdownのファイル名に完全一致する参照を検出し、ファイル名と行番号を報告する。
- 元ファイルが現行Gitルートへ誤って再登録されること、検査対象の読み込みに失敗することもエラーとする。
- 過去の退役状態を宣言的に検証する既存履歴テストだけは、実行時依存とは区別して明示的に除外する。通常のProtocol/Browserテストは除外しない。
- 初回失敗事例である `MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md` の直接読み込みを人工fixtureとし、この依存を検出できることをテストする。実際の旧V299文書は今回削除しない。

## 制約と今後のStage E

この検査は静的な完全一致参照に限定される。文字列連結・動的パス・外部URL・ブラウザキャッシュ・実際のHTTP取得依存は別途検証が必要。文書内の歴史的な言及は実行依存には含めず、外部リンクは固定コミットURLを維持する。

旧PNG/旧URLの初回描画互換はrelease-manifestとPagesビルダーが維持する現行契約であり、この工程では削除・圧縮しない。

## 変更範囲・正式受入

新規監査MJS・新規Protocolテスト・この文書・package.jsonの既存単一node --testへの1件登録のみ。現役HTML/JS/CSS・manifest・Firebase/Rules・認証・業務データ・Pages配布資産・Release304は不変。

Ver.430正式受入の後、Ver.431 exact-head Protocol/Browser/Firebase/Regression全成功、expected-head merge、main同SHA Regression/Pages全成功、復旧checkpointの順で受け入れる。
