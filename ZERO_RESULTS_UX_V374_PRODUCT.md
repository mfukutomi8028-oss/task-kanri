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

## 既存CI失敗の復旧（2026-10-09）
- 最初の製品head `cbdff68099dc5efcc4dc592530341898927e0818` のCI `37885622745` はProtocol成功、Browser 428 passed/2 failed/55 skipped、Firebase skip。失敗1件は旧Ver.373抽出検証の独立VM fixtureで追加のVer.374表示用関数が定義されていないもの。ユーザー機能の条件判定を緩めず、テストVMのみスタブして `596eaea5e32f5d5bf2ad837708dedb21f67adc4a` に修正した。ローカルProtocol 487/487・Ver.373 matrix 12/12を再確認。
- 再CI `37886704237` では前項が通過し、新規Ver.374ブラウザ8件も通過。唯一残った旧画像テスト差分は `workflow-desktop-1366-archive-modal-linux.png` の最下端の縁／影14有意ピクセル。モーダル内部の文字、ボタン、入力、配置の違いはない。
- 2つのCI artifactから抽出した実際のPNGはバイト単位で一致（SHA-256 `68aefb93492dae5218655afc18347f63785eb5b2b616a5ad032c2fcb1be598e9`）。旧golden SHA-256 `c9d53a424ff5adc0afad65de95112a1d27399ef809dce55ecd8ae3239824fd33`。変更範囲は画像の y=339..357, x=0..418 に限られ、UIの本体ではなく丸角の周囲の背景サンプリング差。
- CI run artifactの実画像をSHA-256で検証し、隔離した一度限りのutility workflow `37887660663` で Git blob `a9c70b3c3a96f602ccf27d39202484c3e48916c5` のみ生成。**既存visualテストの比較方法・許容値・期待文言を一切変更せず、厳密な新goldenのみに置換**。utility workflowはPR/mainに含めない。新headで全CIを再実行し、ゲートを省略しない。
