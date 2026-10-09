# Ver.375 今日画面の担当者・分類フィルター整合

更新日：2026-10-09。Issue #285。正式起点 Ver.374 / Release・baseline 301/301、main `892588c80285981fcafec6a8b50d5b626097c128`、`backup/ver374-checkpoint`。本ファイルは **Ver.375候補の開発記録であり、正式公開完了宣言ではない**。

## 再現した不具合
既存 `renderTodayView()` は「自分の担当」だけを抽出時に適用し、サイドバーで選択できる「担当者」と「分類」を無視していた。両セレクトは既存の `render()` を呼び出すため、選択しても今日の予定・期限超過・今日まで・未整理・空き時間のパネルで表示が変わらない。タスク/予定の他画面では両条件が適用されるため挙動に不整合があった。

GitHub PagesのVer.374正式成果物（同一main SHA `892588c80285981fcafec6a8b50d5b626097c128` のartifact）を使用し、本物の `renderTodayView()` をNode VMで実行して赤テストを確認：既定/自分の担当の2条件は一致し、担当者単独・分類単独・複合条件・該当なしの4条件では **表示されたタスクと予定が期待値に一致しなかった**。

## 採用した改善
- Todayだけのタスク・予定各パネルには選択中の担当者・分類を追加適用。既存の「自分の担当」および保留/完了除外の正本は維持。
- 「今日の予定」と4つのタスクパネルの**双方**に同じ条件を適用する。フィルター0件なら「表示条件に該当する項目はありません」と明記し、無条件の0件文言と区別。
- Todayの通知、お知らせ、個人ToDoは元の独立したデータ表示を維持する。これを明示する状態ラベルをToday内の5パネル直前に配置。
- 状態ラベルに選択中の条件と「条件をクリア」操作を設置し、既存の `elements.resetFilters.click()` を再利用。選択条件ラベルはHTMLエスケープ。
- CSSは既存 `style.css` に限定。狭幅では縦並びにし、別のメニューや追加Observer/Timerは作らない。

## 変更と回帰保護
製品：`app.js` / `style.css`。Release/baselineは候補 **302/302**。Node 10件の `test-harness/today-sidebar-filters-v375.test.mjs` と、全アプリPlaywright PC 1366px・スマホ 390px 各4件の `tests/today-sidebar-filters-v375.spec.mjs` を追加した。

Ver.219に由来する既存の文字列一致監査3件は、旧判定を緩めず「自分の担当＋担当者・分類」の追加条件まで要求する強い正規表現へ更新。対象は `test-harness/stable-today-retirement-v219.test.mjs`、`test-harness/foundation-overlap-v200.test.mjs`、`test-harness/version-source-v194.test.mjs`。

- 修正前の実ソースNode VM：**2/6**一致（4条件で不具合再現）。
- 修正後の実ソースNode VM：**6/6**一致（通知・個人ToDoスタブ維持）。
- Node 10件：**10/10成功**。
- ローカル全Protocol/release-contract：**497/497成功、fail=0、skip=0**。Pages artifactは `.github/workflows` が含まれないため、実際のmain `.github/workflows/pages.yml` と同じファイルを検証用ディレクトリだけに復元（製品候補へワークフロー変更は含めない）。
- JS構文/JSON構文チェック成功。
- PC/スマホ全アプリPlaywright 8件はPR CIで初めて判定する。管理環境のlocalhostブラウザは既知の制限により実行できない。隔離VMを全アプリ合格と誤認しない。
- 本番Firebaseの業務データを読み書きしない。localStorage合成テストのみ。保存正本、Firebase API、通知、個人ToDo、今日の日付境界、ルーム/ユーザー選択、UIメニュー構成を変更していない。

## 正式完了ゲート
PRのexact headでProtocol／Browser／Firebase Emulator全成功 → mainとPR head・レビュー再取得 → exact-head merge → 同一新mainで回帰全成功・Pages build/deploy成功 → Release/baseline 302/302一致 → `backup/ver375-checkpoint`作成・SHA一致 → Issue #285完了。

いずれか不達ならDraft/未マージまたは受入待ちで停止し、Ver.374チェックポイントを正式な復旧地点とする。
