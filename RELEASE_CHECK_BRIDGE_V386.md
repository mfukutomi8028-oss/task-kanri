# Ver.386 候補 — 旧PowerShellリリースチェックの契約統合

Issue #303。起点main `5746039abd2e70e3eefada8e363a8b8653aa7820`。リリース304、業務コード・データ・配布資産は変更しない。

## 修正前の問題

- `release-check.ps1` は `release-manifest.js`の現在のバージョンを読みながら、`index.html`に残る初期の`Ver.143`表示や`?v=143`を現在番号304に一致させることを要求していた。
- 初期HTMLのVer.143指定は故意の互換プレースホルダーで、起動時にmanifestの現行release番号へ更新する契約がある。PSスクリプトの判定が古く、誤った作業（HTMLの旧URLを一括更新する等）を誘発しかねない。
- `.github/README.md`もVer.141を現在版として紹介し、旧「HTMLとキャッシュ番号を全て揃える」手順が残っていた。

## 対応

1. `release-check.ps1` を、既存Nodeの4つのテスト(`release-contract`、`patch-responsibility`、`version-source-v194`、`first-paint-version-handoff-v276`)を呼び出す薄いPowerShellラッパーへ変更。判定正本を一本化した。Windows PowerShell 5.1互換の構文のみ利用し、Node未インストールやテスト不合格では非ゼロ終了となる。
2. `.github/README.md`をルートREADMEへの案内に整理。旧版全文は変更前の固定commit URLに残す。
3. ルートREADMEにWindows/PowerShell 7での手動実行コマンドを追記。
4. `test-harness/release-check-bridge-v386.test.mjs`でラッパー契約、現行README参照、旧版表記の退役、CIのPowerShell実行を固定。
5. Protocol jobに `shell: pwsh` の検証ステップを追加。Node Protocol通過後に実PowerShell7からラッパーを実行し、Linux GitHub-hosted runnerでバージョン契約の実動作をチェックする。

## 変更しないものと受入

`index.html`のVer.143表示とキャッシュ付き旧初回URL、`release-manifest.js`の起動guard、既存manifestバージョン304、Firebase書込処理、Pages公開対象、業務UI・CSSは変更しない。旧配布キャッシュ互換資産も一切削除しない。

CI exact-headのProtocol（Node＋PowerShell実行）、Browser、Firebase Emulator、最終regression gateが全てsuccessとなった場合のみmainに採用する。main反映後も同SHAのRegression/Pages greenとcheckpointを確認する。

注意：Linux runnerではPowerShell7を実行する。Windows PowerShell5.1実機での動作確認まではこのCIだけで証明できない。構文はWindows PowerShell5.1相当で書いたが、利用現場で必要なら後続にWindows runnerでの追加試験を導入する。
