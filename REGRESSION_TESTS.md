# 回帰テスト基盤

このテストは、既存の業務管理ボードを安全に整理・改修するための安全網です。

## 自動確認する内容

- 既存の削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産欠落、重複、読込順
- `ui-sidebar-v180.css` が `ui-task-toolbar-v179.css` より先に読み込まれ、旧sidebar CSS 4本がactive manifestへ戻っていないこと
- `patch-responsibilities.json` が動的CSS/JSを1対1で漏れなく分類していること
- 責務グループの重複、存在しないパッチ参照、整理優先順位の不整合
- ルート直下JavaScriptの構文エラー
- GitHub PagesデプロイWorkflowの二重化
- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360px の初期表示
- 861px以上のPCサイドバー折りたたみ
- hover展開時にメイン画面を押し動かさないこと
- 固定時のみ左側276px程度を確保すること
- 1366 / 981 / 980 / 861pxでcollapsed→expanded→pinnedの各状態が成立すること
- 860pxでdesktop sidebar class/stateが解除されること
- 1366 / 980 / 861pxでdetail-openにしても左側予約位置とページ横スクロールが崩れないこと
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログと開始日フィールド
- F5後も現行リリースと新アイコンが維持されること
- 同一オリジンの404やJavaScript例外
- 動的CSS/JSの読込失敗
- PC 1366pxのcollapsed/expandedナビゲーションのPNG視覚差分
- スマホ390pxのナビゲーションとタスクサマリーのPNG視覚差分
- タスクツールバーの1920 / 1720 / 1719 / 1450 / 1449 / 1366px視覚差分
- タスクツールバーのcollapsed / expanded / pinned、detail-open / detail-closedの主要状態
- Quick Addボタンのクリップ、Quick Add入力欄・検索欄の極端な縮小、主要コントロール同士の重なり
- サイドバーの1366 / 980 / 861pxにおけるcollapsed / expanded / pinned主要状態のPNG視覚差分

パッチ整理の責務・リスク・統合順は `PATCH_RESPONSIBILITY_MAP.md` と `patch-responsibilities.json` を正本として管理します。

Ver.180時点の通常CIでは、構造・プロトコル系 **32件**、ブラウザ系 **37件**を実行します。

## 視覚回帰

### アイコン

`tests/icon-visual.spec.mjs` と `tests/icon-visual.spec.mjs-snapshots/` は、Ver.177の統合前表示をGitHub Actions上のChromiumで撮影した基準です。

Ver.178では `ui-v169.css` / `ui-v170.css` / `ui-v171.css` を `ui-icon-system-v178.css` へ統合しました。通常のSmokeだけでなくPNG基準と比較することで、アイコン寸法・余白・フレームなどの意図しない表示差を検出します。

### タスクツールバー

`tests/task-toolbar-visual.spec.mjs` と `tests/task-toolbar-visual.spec.mjs-snapshots/` は、Ver.178の `ui-v162.css` / `ui-v163.css` 統合前表示をGitHub Actions上のChromiumで撮影した基準です。

Ver.179ではこの2層を `ui-task-toolbar-v179.css` へ統合しました。適用境界である1450/1449px、固定サイドバー側の1720/1719px、1920pxのcollapsed/expanded/pinned、1366pxの通常状態を固定しています。

### デスクトップサイドバー

`tests/sidebar-visual.spec.mjs` と `tests/sidebar-visual.spec.mjs-snapshots/` は、Ver.179のsidebar CSS統合前表示をGitHub Actions上のChromiumで固定した基準です。

Ver.180では `ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` を `ui-sidebar-v180.css` へ統合します。専用テストは16件で、1366/981/980/861pxのcollapsed→expanded→pinned、860pxのdesktop/mobile境界、detail-open時のsidebar安定性、8条件のPNG視覚比較を行います。

PNG基準は1366pxのcollapsed/expanded/pinned、980pxのcollapsed/expanded/pinned、861pxのcollapsed/expandedです。表示が変わっていないことだけでなく、collapsed時の68px前後、pinned時の276px前後、expanded時に作業領域を押し動かさないこと、横スクロールを発生させないことも数値で検証します。

基準画像の更新は通常の改修で自動実行しません。デザイン変更として見た目を意図的に変える場合だけ、差分内容を確認してから基準を更新します。

## 本番Firebaseを触らない仕組み

ブラウザテストでは、ページ読込前に `window.firebaseConfig` をテスト側で無効化します。またFirebase SDKおよびFirebase Databaseホストへの通信をブラウザ側で遮断します。

そのため、このSmoke/視覚テストは本番ルームのタスク・予定・ToDo・コメント・業務メモを読み書きしません。UIと配信資産の回帰確認に限定しています。

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

main向けPull Requestとmainへのpushでは `.github/workflows/regression-checks.yml` が自動実行します。ブラウザテスト失敗時はPlaywrightレポートをActions artifactとして7日間保存します。

## 次の段階

次の中リスク整理候補は `desktop-sidebar-v158.js` / `desktop-sidebar-compat-v159.js` / `sidebar-polish-v160.js` のJavaScript側です。CSS側とは別PRにし、keyboard focus、pointer navigation、Escape、resize/orientation、固定状態のlocalStorage永続化を追加検証してから統合可否を判断します。

書込系については、その後Firebase Emulator専用ルームでタスク作成/編集/削除、一括変更、コメント/メンション/リアクション、ToDo、予約タスク、スケジュール、業務メモ、2ブラウザでのrevision/Transaction競合試験を追加します。本番Firebaseを使った自動テストは行いません。
