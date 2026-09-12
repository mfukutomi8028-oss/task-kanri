# 回帰テスト基盤（Ver.187）

このテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。

## CIで確認する範囲

### 構造・契約

- 削除プロトコル / ToDo同期プロトコル
- `release-manifest.js` の必須資産、重複、動的資産の存在確認
- パッチ責務マップとactive CSS/JSの1対1対応
- Firebase Emulator設定がlocalhost・demo project・testルームへ限定されること
- sidebar Ver.180/181、archive Ver.182、inbox Ver.183、workflow CSS Ver.186の既存契約
- Ver.187で `ui-v157.css` がactive/requiredへ戻っていないこと
- 旧 `ui-v157.css` 自体はキャッシュ互換用に物理保存されること
- `ui-v157.css` にあったモバイル補正が `ui-v148.css` / `ui-v149.css` / `ui-v156.css` / `ui-inbox-archive-v186.css` に残ること
- ルートJavaScriptの構文確認
- GitHub Pages deployment workflowが1本だけであること

Ver.187のPR確認では構造・契約 **40/40** が成功しています。

### 通常ブラウザ回帰

本番Firebaseを無効化した状態で、次を確認します。

- 1920 / 1366 / 980 / 861 / 860 / 430 / 390 / 360pxの主要表示
- 今日 / ToDo / タスク / スケジュール / 業務メモの主要導線
- 新規タスクダイアログ、開始日、リロード
- sidebar collapsed / expanded / pinned、861/860px境界
- sidebar hover/focus/drag/Escape/localStorage永続化
- アイコン、タスクツールバー、サイドバーの視覚回帰
- Ver.185ブランド仕様: collapsed時ブランド非表示、expanded/pinned時表示、faviconが現行ブランドを参照
- 通知・アーカイブの1366 / 860 / 430 / 390px視覚回帰
- Ver.187専用のメンションpicker / タスク表示 860 / 430 / 390px視覚回帰
- 同一オリジン404、JavaScript例外、動的資産読込失敗、横スクロール発生の検出

Ver.187のPR確認では通常ブラウザ57件中、Firebase専用6件をskipし、**51/51** が成功しています。

## Ver.186〜187 通知・アーカイブ／モバイル視覚回帰

### 通知・アーカイブ

`tests/workflow-inbox-archive-visual.spec.mjs` は、本体CSS整理前の表示をGitHub Actions Chromiumで固定した基準です。本番Firebaseは使用せず、テスト専用roomとlocalStorageだけで状態を作ります。

対象幅は次の4つです。

- PC 1366px
- モバイル境界 860px
- モバイル 430px
- モバイル 390px

各幅で次の4状態をPNG比較します。

1. 今日ビューの「自分への通知」入口と未読バッジ
2. 通知ドロワー
3. 完了タスク画面のアーカイブ入口
4. アーカイブモーダル

860 / 430pxの基準はVer.187本体変更前のVer.186から生成しています。Ver.187整理後にbaselineは更新せず、そのまま一致することを確認しています。

### Ver.187 モバイル補正

`tests/mobile-regression-v187.spec.mjs` は、`ui-v157.css` をactiveから外す前のVer.186表示を860 / 430 / 390pxで固定します。

確認内容:

- メンションpickerのz-index = 1440
- メンション候補リストのoverscroll containment
- タスク一覧の経過時間余白（860/430px=10px、390px=8px）
- タスク詳細タブと主要操作ボタンの最小高44px
- toast z-index = 1500
- 横スクロールが発生しないこと
- メンションpickerとタスク表示のPNG比較

Ver.187ではこの基準を変えずに、補正ルールを本来の所有CSSへ移しています。

## 既存の視覚・操作回帰

- `tests/icon-visual.spec.mjs`: ナビ/サマリーアイコン
- `tests/task-toolbar-visual.spec.mjs`: 1920/1720/1719/1450/1449/1366pxのタスクツールバー
- `tests/sidebar-visual.spec.mjs`: sidebar geometry、861/860px境界、Ver.185ブランド表示仕様とfavicon
- `tests/sidebar-js-behavior.spec.mjs`: hover/focus/drag/Escape/pinned永続化/reload
- `tests/ui-smoke.spec.mjs`: 主要画面幅と主要導線

基準画像は通常の整理作業では更新せず、意図したデザイン変更時だけ差分を確認したうえで更新します。

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

Ver.187のPR確認では基本書込 **5/5**、重複統合 **1/1** が成功しています。

## Ver.185ブランドとの境界

Ver.187でもブランド関連は変更しません。現行仕様は以下です。

- 現行制御 `brand-v185.js`
- 現行CSS `ui-brand-v185.css`
- 現行画像本体 `assets/brand-v184.svg` / `assets/brand-v184.png`
- 互換用 `assets/brand.png`

`assets/brand-v184.*` はファイル名がv184でも現行画像本体です。プログラム整理で旧資産扱いして削除しません。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`

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

次候補は `ui-v176.css` / `workspace-density-v176.js` です。今日ビュー等の表示密度・重複見出し・主要操作配置へ影響するため、PC/スマホの現行表示と操作導線を先に固定してから整理します。
