# 回帰テスト基盤

このテストは、既存の業務管理ボードを安全に整理・改修するための安全網です。

## 自動確認する内容

- 既存の削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産欠落、重複、読込順
- `ui-sidebar-v180.css` が `ui-task-toolbar-v179.css` より先に読み込まれ、旧sidebar CSS 4本がactive manifestへ戻っていないこと
- Ver.181では `desktop-sidebar-v181.js` が1回だけactiveになり、旧sidebar JS 3本がactive/requiredへ戻っていないこと
- `desktop-sidebar-v181.js` 内に旧3JSの本文が変更なしで元の順序のまま含まれていること
- `patch-responsibilities.json` が動的CSS/JSを1対1で漏れなく分類していること
- 責務グループの重複、存在しないパッチ参照、整理優先順位の不整合
- Firebase Emulator設定が `127.0.0.1:9000` / `demo-task-kanri` / `test-` ルームへ限定されていること
- Emulator E2Eで本番RTDBホストへの通信が発生していないこと
- Emulator上で共同編集ONまで到達すること
- 完了タスクのアーカイブ保存、コンテキスト表示、復元
- 自分への通知作成、未読表示、既読状態の共同保存
- 2ブラウザから同じ通知IDを書いた場合に1件だけ残るトランザクション冪等性
- ルート直下JavaScriptの構文エラー
- GitHub PagesデプロイWorkflowの二重化
- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360px の初期表示
- 861px以上のPCサイドバー折りたたみ
- hover展開時にメイン画面を押し動かさないこと
- 固定時のみ左側276px程度を確保すること
- 1366 / 981 / 980 / 861pxでcollapsed→expanded→pinnedの各状態が成立すること
- 860pxでdesktop sidebar class/stateが解除されること
- 1366 / 980 / 861pxでdetail-openにしても左側予約位置とページ横スクロールが崩れないこと
- サイドバー固定ボタンが1つだけ存在し、text-only補正とaria属性が成立すること
- pointer hover展開、ポインターによるナビ操作後のfocus解放、離脱後の収納
- keyboard focus展開、Escape収納、キーボードfocus維持
- pinned状態のlocalStorage保存、reload後の復元、unpin後の保存
- 861px→860pxでdesktop状態を解除し、861pxへ戻ると記憶済みpinned状態を復元すること
- dragenter展開とdragend後の収納
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

Ver.181時点では、構造・プロトコル系 **36件**、通常ブラウザ系 **43件**に加えて、Firebase Emulator専用ブラウザE2E **4件**を実行します。通常の `npm run test:ui` ではEmulator専用4件はskipされ、`npm run test:firebase` のときだけ有効になります。

## 視覚回帰

### アイコン

`tests/icon-visual.spec.mjs` と `tests/icon-visual.spec.mjs-snapshots/` は、Ver.177の統合前表示をGitHub Actions上のChromiumで撮影した基準です。

Ver.178では `ui-v169.css` / `ui-v170.css` / `ui-v171.css` を `ui-icon-system-v178.css` へ統合しました。通常のSmokeだけでなくPNG基準と比較することで、アイコン寸法・余白・フレームなどの意図しない表示差を検出します。

### タスクツールバー

`tests/task-toolbar-visual.spec.mjs` と `tests/task-toolbar-visual.spec.mjs-snapshots/` は、Ver.178の `ui-v162.css` / `ui-v163.css` 統合前表示をGitHub Actions上のChromiumで撮影した基準です。

Ver.179ではこの2層を `ui-task-toolbar-v179.css` へ統合しました。適用境界である1450/1449px、固定サイドバー側の1720/1719px、1920pxのcollapsed/expanded/pinned、1366pxの通常状態を固定しています。

### デスクトップサイドバー

`tests/sidebar-visual.spec.mjs` と `tests/sidebar-visual.spec.mjs-snapshots/` は、Ver.179のsidebar CSS統合前表示をGitHub Actions上のChromiumで固定した基準です。

Ver.180では `ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` を `ui-sidebar-v180.css` へ統合しました。専用テストは16件で、1366/981/980/861pxのcollapsed→expanded→pinned、860pxのdesktop/mobile境界、detail-open時のsidebar安定性、8条件のPNG視覚比較を行います。

PNG基準は1366pxのcollapsed/expanded/pinned、980pxのcollapsed/expanded/pinned、861pxのcollapsed/expandedです。表示が変わっていないことだけでなく、collapsed時の68px前後、pinned時の276px前後、expanded時に作業領域を押し動かさないこと、横スクロールを発生させないことも数値で検証します。

pinned時の固定ボタンfocusによりChromiumがサイドバー内部だけをスクロールする場合があったため、PNG撮影直前にsidebarのscrollTop/scrollLeftを0へ戻します。これは製品表示を補正する処理ではなく、同一表示を同一座標で比較するためのテスト安定化です。

### サイドバーJavaScript操作

`tests/sidebar-js-behavior.spec.mjs` はVer.181のJavaScript統合より先にmainへ導入し、Ver.180の既存3JSが持つ操作挙動を固定しました。

対象はhover/focus/drag、pointer操作後のfocus解放、Escape、pinnedのlocalStorage永続化、reload、861/860px境界、固定ボタンのtext-only補正とアクセシビリティ属性です。Ver.181ではこのテストを変更せず、統合後も同一挙動であることを検証します。

基準画像の更新は通常の改修で自動実行しません。デザイン変更として見た目を意図的に変える場合だけ、差分内容を確認してから基準を更新します。

## 本番Firebaseを触らない仕組み

通常のSmoke/視覚/サイドバー操作テストでは、ページ読込前に `window.firebaseConfig` をテスト側で無効化します。またFirebase SDKおよびFirebase Databaseホストへの通信をブラウザ側で遮断します。そのため本番ルームのタスク・予定・ToDo・コメント・業務メモを読み書きしません。

Firebase書込E2Eでは、本番設定を使う代わりにテスト初期化時だけ次の境界を設定します。

- FirebaseプロジェクトID: `demo-task-kanri`（実在クラウド資産を持たないDemo Project）
- Realtime Database Emulator: `127.0.0.1:9000`
- 共有ルーム: `test-firebase-emulator-e2e`
- `window.WORK_BOARD_TEST.emulator = true`
- `firebaseio.com` / `firebasedatabase.app` へのブラウザ通信を遮断し、1件でも試行されたらテスト失敗
- `app.js` 側でもlocalhost、正しいport、`test-`ルーム以外のEmulator設定を拒否

`database.rules.test.json` はEmulator専用のためread/writeを許可しています。このファイルを本番へdeployする処理はWorkflowに存在せず、CIは `firebase emulators:exec --only database --project demo-task-kanri` だけを実行します。

## Firebase Emulator E2E

`tests/firebase-emulator-write.spec.mjs` は通知・アーカイブ整理へ進む前の最初の書込安全網です。現在は以下を固定します。

1. Emulatorへ接続して `共同編集ON` まで到達し、本番RTDBホストへ通信しないこと
2. 完了タスクをアーカイブし、完了タスク文脈からアーカイブ一覧を開き、共同データから復元できること
3. 自分への通知を共同データへ保存し、未読バッジ・通知一覧・既読状態が一致すること
4. 2ブラウザが同じ通知イベントIDを同時に書いても、`runTransaction(current => current || item)` により1件だけ残ること

今後、別責務を整理する直前に同じEmulator基盤へ対象の書込試験を追加します。タスク作成/編集/削除、一括変更、コメント/メンション/リアクション、ToDo、予約タスク、スケジュール、業務メモなどを一度に広げず、整理対象ごとに段階追加します。

## 復旧地点

復旧用ブランチを段階的に保持します。

- `backup/ver180-before-sidebar-js`: Ver.180確定版
- `backup/ver180-with-sidebar-js-tests`: Ver.180の本番資産＋強化済みJS操作テスト
- `backup/ver181-before-firebase-emulator-tests`: Ver.181確定版（Firebase Emulator E2E導入前）

Firebase Emulatorテスト導入で問題が発生しても、Ver.181本番資産そのものへ戻せます。今回の工程では本番アプリ資産を変更しません。

## 実行方法

通常の回帰テスト:

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

Firebase Emulator書込E2E（Java JDK 11以上が必要）:

```bash
npm run test:firebase
```

main向けPull Requestとmainへのpushでは `.github/workflows/regression-checks.yml` が通常回帰に続いてEmulator書込E2Eまで自動実行します。失敗時はPlaywrightレポートとFirebase EmulatorログをActions artifactとして7日間保存します。

## 次の段階

Firebase Emulator E2EがPR上・main上の両方で安定して成功した後、通知・アーカイブ領域の既存 `ui-v152.css` / `ui-v153.css` / `inbox-v153.js` / `archive-duplicate-v153.js` を改めて解析します。

その際も一度に通知とアーカイブの両方を書き換えるのではなく、上書き関係と共有データパスを確認し、最小の統合単位へ分割して進めます。
