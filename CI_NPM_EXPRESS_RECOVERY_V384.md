# CI npm依存取得の復旧（Express 5系の限定固定）

基準：Ver.383正式main / Release304、Issue #299。製品JS/CSS・Firebase本番設定・業務データ・ビルド成果物は変更しない。

## 発見した障害

PR #298（旧Ver.108の単発GitHub Actions廃止）のCI run #37933502899にて、attempt 1・2ともProtocol/Browser/Firebase全ジョブがnpm installの段階で失敗。両試行とも共通原因は npm error E404: GET https://registry.npmjs.org/express/-/express-5.3.0.tgz。PR #298はアプリコード・直接依存のバージョンを変更しておらず、テスト本体は未実行だった。npm公式公開一覧のExpress 5.x最新は5.2.1で、5.3.0 tarballが得られない。

## 最小限の処置

package.jsonのルートoverridesに **express@5 → 5.2.1** を追加する。Express 4系の依存を巻き込まないため、Express全バージョンに対するグローバルoverrideは避ける。npmがダウンロードしていたExpress5系だけを存在する配布版へ固定する。

これは **テスト・Firebase Emulatorを起動する開発用依存の解決を安定化する修正**であり、GitHub Pagesのランタイム資産やアプリのRelease/baseline304を変えない。

## 受入

- PR exact-headのnpm install成功、Protocol/Browser/Firebase/最終回帰の全success
- Firebase Emulatorのデータ読み書き契約維持
- main同SHAのRegression・Pages success後にcheckpoint記録
- PR #298はこの修正がmainへ入った後にbaseを更新し、全CI再実行してから採否を判断
- 将来的には再現性のあるlockfileとnpm ciの整備を別工程で検討する。今回ロックを新規生成していないので全間接依存が固定されたわけではない

## 復旧

不具合が判明した場合は本コミットのoverridesを取り消し、npm依存解決方法を調査し直す。既存main `backup/ver382-pages-runtime-validated-checkpoint` を保持する。
