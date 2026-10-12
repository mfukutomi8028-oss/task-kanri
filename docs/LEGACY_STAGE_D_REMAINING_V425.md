# Ver.425 Stage D：残存Protocolと文書の整理監査

Issue #292。基準は正式受入済みVer.424 main `9f6b76a7626c608db55e03d25fb0962c65d92fc5`。本変更は判断記録のみで、削除許可ではない。

## 実測（Ver.424 main）
- Git管理ファイル549件、ルートJS 38件、CSS 28件。
- ルートMarkdown 81件、273,679 bytes。README・REGRESSION_TESTS・PATCH_RESPONSIBILITY_MAPなどは現行入口として保存する。
- `test-harness/*.test.mjs` 125件のうち、package.jsonのnpm scriptsにパスが直接列挙されないもの7件。CI以外からの利用、import、文書のリンク、障害復旧での再実行価値は未確定。
- Playwrightの`tests/*.spec.mjs`は`testDir: './tests'`により自動収集されるので、未列挙を「未使用」とみなさない。

## 直接列挙されない7件の個別方針

| ファイル（test-harness/以下） | 調査結果と暫定判断 |
| --- | --- |
| `stable-today-data-ownership-v219.test.mjs` | 現役app.jsと凍結原本を参照、仕様回帰として再利用可能性あり。維持 |
| `stable-today-retirement-v219.test.mjs` | app.js・manifest・凍結アーカイブを参照。旧互換契約のため維持 |
| `task-dialog-polish-v321.test.mjs` | 現役詳細・mention・ブラウザspecを検査。Release 279以上を許容。維持 |
| `task-dialog-ui-v320.test.mjs` | 現役CSS/詳細/ブラウザspec、Release 279以上。維持 |
| `task-dialog-ux-v320.test.mjs` | 現役詳細レイアウトのUX契約。維持 |
| `user-reported-stability-v319.test.mjs` | 現役画像・JS/CSS・browser specを参照、Release 279以上。維持 |
| `ver321-doc.test.mjs` | 過去のcheckpoint説明文書のテスト。保守証拠として残し、再実行の必要性を別途判断 |

旧Release値に固定された8件および退役旧JSのroot存在に依存した1件はVer.424で整理済み。上記7件には同じ削除根拠を適用できない。必要なら今後、個別実行結果と現在の回帰テストとの重複を検証し、現役CIへ追加するか履歴化するか判断する。

## ルートMarkdown 81件の次の監査

現行入口（README、現行試験、責務・構成）、過去の監査候補、復旧資料の3分類とする。各ファイルのファイル名・大小・他文書/コード/テスト/CIからの参照・現在の利用価値・復旧SHAを1件ずつ記録して、移動可能なものを独立PRで少数ずつ処理する。引用やリンクが未検証のものは削除しない。Git履歴の存在は参照先の互換性を保証しない。

## 安全ゲート

本候補は新規Markdown1件のみ。Release304、現役HTML/JS/CSS、Firebase/Rules、アプリ保存、リリースmanifest、CI実行定義、Pages配布対象は変更しない。通常どおり、PR exact-headのProtocol/Browser/Firebase/Regressionとmain同SHAのRegression/Pagesを確認し、正式受入時に復旧checkpointを作成する。
