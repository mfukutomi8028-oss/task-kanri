# Ver.384 — v108の単発GitHub Actions移行処理を退役

## 背景と狙い

現行mainは Ver.383 / Release304。旧Ver.108のソース修復を実行する3つのワークフローが、長年 .github/workflows/ に残っていた。これらはそれぞれ **そのYAML自身の変更を条件に発火するpushイベント**を設定し、contents: write 権限で app.js、mobile-fixes.js、index.html の一部を書き換えたうえでGitHubへpushする。

これは2026年の継続開発、Release304、現行CI・デプロイに不要。後から誰かが過去のYAMLを編集すると、意図せずVer.108の古い仕様・cache versionへ巻き戻す危険がある。

## 最小変更

以下を **物理ファイル削除**（コミット履歴からは復元可能）：

- .github/workflows/apply-v108-stability.yml
- .github/workflows/apply-v108-source-stability.yml
- .github/workflows/apply-v108-source-stability-v2.yml

現行の pages.yml、regression-checks.yml は一切変更しない。製品HTML/JS/CSS、Release304、Firebase業務データ・認証/権限、デプロイ対象、旧ブラウザ互換URLは変更しない。

test-harness/legacy-workflow-retirement-v384.test.mjs を既存Protocolへ登録し、旧ファイルの不存在・現行2ワークフローの機能保持・contents: write の不用意な復活防止を契約化する。

## 受入・復旧

exact-head Protocol・Browser・Firebase・regression全成功、main同SHA Regression/Pages success、復旧checkpointを正式完了条件とする。main適用前の復旧地点は backup/ver382-pages-runtime-validated-checkpoint（PR #297のmain確認後はVer.383のcheckpointも作成する）。

元のYAMLが必要になった場合はGit履歴から復元できるが、古いコードを自動上書きする危険があるため、実際のワークフローを復活させるより最新版仕様で手順を再設計する。

本PRは **古い画像やJS/CSSの削除とは独立**しており、名前だけで配布互換資産を削除することはしない。
