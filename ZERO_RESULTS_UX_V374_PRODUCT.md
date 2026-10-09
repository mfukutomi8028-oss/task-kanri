# Ver.374: タスク0件時の条件案内と解除導線

2026-10-09。Issue #283。基準main `bc645bdbbc9befcda59b7f0fe5ea4441b036576a`（Ver.373、Release/baseline 300/300）。PR #284の現行候補は301/301。正式完了ではない。

## 利用者上の問題と実装
既存のタスク一覧は検索/担当/状態/完了等で0件でも「新しいタスク」を主に案内し、絞り込みによる非表示を説明していなかった。ボードでは空列案内のみで、絞り込み全体を解除する入口がなかった。
- タスク配列そのものが空なら「まだタスクがありません」＋既存の新規作成。
- タスクは存在するが絞り込みで0件なら「この条件に一致するタスクはありません」＋主要な条件の説明＋「条件をクリア」。
- デフォルトの未完了条件で0件の場合は、完了表示へ切り替える案内を表示し、意味のないクリアボタンは追加しない。
- 検索語は短縮してHTMLエスケープ。保存・データ取得・フィルタ式・ユーザー切替は変更しない。
- ボードは既存の `elements.boardView.innerHTML = columns + addColumn;` を維持し、0件のときだけ案内を先頭に挿入。各状態の追加/モバイル状態タブ/Observer境界はそのまま。
- 一覧の0件行にも同じ案内を使い、通常の既存 `resetFilters.click()` のみを呼び出して条件解除する。
- CSSは既存style.cssへ小さく追加、狭幅では0件行をテーブル全幅に配置。

## 変更境界
`app.js`, `style.css`, `release-manifest.js`, `patch-responsibilities.json`, `package.json`と、テスト2件。既存Firebaseトランザクション、データ構造、通知、Today専用表示、left nav、アーカイブ/予約の除外処理は無変更。新しいサイドカーやtimer/Observerは追加しない。

## 検証
- 最新GitHubの原本blobから改修。生成した7個のソース/テストblobは、ローカルで評価したファイルのGit SHAと一致確認。
- JavaScript構文チェック成功。
- ローカルProtocol/release-contract: **487/487成功、fail/skipなし**。既存Observer所有権テストを変更せず維持。新規NodeソースVMテスト5件。
- 新規Playwright全アプリ8件（1366px/390px 各4件）：初期タスク0件、検索絞り込みのboard/list往復とEnterでの解除、担当＋完了、HTMLエスケープと再読込。localStorage合成fixture・本番通信遮断。
- 管理環境のlocalhostは `ERR_BLOCKED_BY_ADMINISTRATOR` で遷移不可だった。制限回避は行っていない。ローカルProtocol・VM検証を全アプリブラウザ合格と同一視しない。
- PR CIでProtocol・Browser Regression・Firebase Emulatorを全成功させる。これらは現時点で未確認。
- 実機スマホ、Safari/Firefox、スクリーンリーダーは未検証。

## 正式完了ゲート
PR #284 exact headに紐づく3系統CI完了→最新main/head・差分・レビュー/競合再取得→exact-head merge→新しいmain回帰・Pagesの同一SHA成功→Release/baseline 301/301→`backup/ver374-checkpoint` SHA再取得→Issue #283を完了。
