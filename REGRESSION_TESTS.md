# 回帰テスト基盤（Ver.186）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183の既存契約
- Ver.186の `ui-workflow-detail-v186.css` / `ui-inbox-archive-v186.css` がactive/requiredであること
- 旧 `ui-v152.css` / `ui-v153.css` はactive/requiredへ戻らず、物理ファイルのみキャッシュ互換用に残ること
- Ver.186 workflow CSSが旧通知/アーカイブ左メニュー用セレクタを再導入しないこと
- `ui-v157.css` がVer.186 workflow CSSより後段でモバイル補正を適用すること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、次を確認します。

- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360pxの主要表示
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログ、開始日、リロード
- sidebar collapsed / expanded / pinned、861/860px境界
- sidebar hover/focus/drag/Escape/localStorage永続化
- アイコン、タスクツールバー、サイドバーの視覚回帰
- Ver.185ブランド仕様: collapsed時ブランド非表示、expanded/pinned時表示、faviconが現行ブランドを参照
- Ver.186通知・アーカイブ視覚回帰
- 同一オリジン404、JavaScript例外、動的資産読込失敗、横スクロール発生の検出

## Ver.186 通知・アーカイブ視覚回帰

`tests/workflow-inbox-archive-visual.spec.mjs` は、CSS整理前のVer.185表示をGitHub Actions Chromiumで固定した基準です。本番Firebaseは使用せず、テスト専用roomとlocalStorageのworkflowV152 sidecarだけで状態を作ります。

対象はPC 1366pxとスマホ390pxです。それぞれ次の4状態をPNG比較し、合計8枚を基準として保持します。

1. 今日ビューの「自分への通知」入口と未読バッジ
2. 通知ドロワー
3. 完了タスク画面のアーカイブ入口
4. アーカイブモーダル

旧 `.workflow-inbox-nav-v152` / `.workflow-archive-nav-v152` がDOMへ復活していないこと、横スクロールが発生していないことも確認します。

基準画像は `tests/workflow-inbox-archive-visual.spec.mjs-snapshots/` に保存します。通常の整理作業では更新せず、意図したデザイン変更時だけ差分確認後に更新します。

## 既存の視覚・操作回帰

- `tests/icon-visual.spec.mjs`: ナビ/サマリーアイコン
- `tests/task-toolbar-visual.spec.mjs`: 1920/1720/1719/1450/1449/1366pxのタスクツールバー
- `tests/sidebar-visual.spec.mjs`: sidebar geometry、861/860px境界、Ver.185ブランド表示仕様とfavicon
- `tests/sidebar-js-behavior.spec.mjs`: hover/focus/drag/Escape/pinned永続化/reload
- `tests/ui-smoke.spec.mjs`: 主要画面幅と主要導線

## Firebase Emulator E2E

本番RTDBではなく、次の隔離環境だけを使用します。

- project: `demo-task-kanri`
- Realtime Database Emulator: `127.0.0.1:9000`
- room: `test-firebase-emulator-e2e`
- `firebaseio.com` / `firebasedatabase.app` へのブラウザ通信を遮断

現在確認する内容は次のとおりです。

1. Emulator接続で共同編集ONまで到達する
2. 完了タスクをアーカイブし、文脈UIから表示・復元できる
3. 自分への通知を保存し、未読表示・通知一覧・既読状態が一致する
4. 担当者変更から通知イベントが自動生成される
5. 2ブラウザが同じ通知IDを書いても1件だけ残る
6. 重複タスク統合が原子的に保存され、archive/duplicateメタデータとUI表示が成立する

## Ver.185ブランドとの境界

Ver.186ではブランド関連を変更しません。現行仕様は以下です。

- `brand-v185.js`
- `ui-brand-v185.css`
- 現行画像本体 `assets/brand-v184.svg` / `assets/brand-v184.png`
- 互換用 `assets/brand.png`

そのためworkflow CSS整理でブランドvisual baselineを更新したり、v184画像本体を旧資産扱いで削除したりしません。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`

## 実行方法

通常回帰:

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
```

Firebase Emulator:

```bash
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・ブラウザ・Emulatorを順番に実行します。失敗時だけPlaywright/Firebaseログをartifactへ保存します。

## 次の段階

次は `ui-v157.css` が候補です。通知・アーカイブのモバイル補正だけでなく、メンションUIとタスク表の補正も含むため、390/430/860pxの追加回帰を先に固定してから責務分離します。
