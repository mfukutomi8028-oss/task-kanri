# 回帰テスト基盤（Ver.223）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.223では、Ver.222でTodayへ行った正本化をScheduleにも適用します。従来は `app.js` が旧Schedule headerを描画した後、`core-view-density-v188.js` がtoolbar・日付・検索UIへ再構成していました。Ver.223では `renderScheduleView()` が最終DOMを直接生成し、Schedule MutationObserverとDOM後処理を退役します。

検索条件の正本は引き続き既存 `#searchInput` です。Schedule専用検索欄は `app.js` 内の表示proxyとして同期し、検索による再描画後もfocus/caretを復元します。

## CIで確認する範囲

### 構造・契約

- release versionが **223** であること。
- dynamic CSS **21本** / dynamic JS **33本**と既存読込順を維持すること。
- `stable-fixes-v108.js` がrequired/dynamic scriptから外れたままであること。
- `core-view-density-v188.js` はactive manifestに1リリース残す互換shellだが、Today/ScheduleのDOM後処理・MutationObserverを持たないこと。
- Todayの意味論と最終DOMは `app.js` が正本であること。
- Scheduleのtoolbar/date/search最終DOMも `app.js` が正本であること。
- Schedule検索proxyは既存 `#searchInput` に同期し、Scheduleデータフィルタの正本を二重化しないこと。
- Ver.220の共同編集時返信保存は、コメントとhistoryを同一task transactionで更新しrevisionを1回だけ増やすこと。
- ルートJavaScriptの構文確認と責務台帳のactive asset 1対1対応。

### Browser回帰

- `core-view-density-v188.js` をテスト上無効化してもTodayとScheduleが完成形で描画される。
- Schedule toolbarの順序は「新しい予定 / 表示期間 / 表示日を移動 / 表示形式」を維持する。
- `.schedule-date-v176` と `.schedule-search-v176` がapp.jsから直接生成される。
- Schedule検索入力が `#searchInput` に同期し、予定一覧を実際に絞り込む。
- 検索で同期renderが発生してもSchedule検索欄へfocus/caretが復元される。
- range/mode切替後もObserverなしでtoolbar/search/dateが維持され、検索値も保持される。
- 通常runtimeの `__WB_CORE_VIEW_DENSITY_V188__.observers` は `today: null, schedule: null`。
- Ver.220の左メニュー予定通知・Today区切り線、Ver.221のhidden-marker退役、Ver.222のToday正本化を維持する。
- desktop / compact / mobile各viewportの既存visual・responsive回帰を維持する。

## Firebase Emulator E2E

Ver.223では保存モデルを変更しません。タスク、ToDo、予定、業務メモ、コメント/返信、reaction、revision、transaction処理は既存のままです。

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信を遮断した既存write回帰を全件維持します。

## Ver.223で変更するもの

- `app.js`
  - Schedule最終toolbar/date/search DOMを直接描画。
  - Schedule検索proxyとfocus/caret復元を `app.js` へ移管。
- `core-view-density-v188.js`
  - Schedule DOM後処理とMutationObserverを退役。
  - `patchAll()` とobserver APIだけを持つno-op互換shellへ縮退。
- `release-manifest.js`
  - Ver.223へ更新。active asset本数・順序は変更しない。
- Schedule/Today Browser回帰、static責務契約、責務台帳・整理文書。

## 変更しないもの

- Scheduleのデータ抽出・期間計算・保存処理。
- `#searchInput` を正本とする検索値と `getFilteredSchedules()` の検索ロジック。
- タスク / ToDo / 業務メモ / コメント・返信 / reactionの書込モデル。
- `ui-core-density-v188.css` を含むactive CSS本数。
- `core-view-density-v188.js` のmanifest参加そのもの。ファイル退役は次工程で別監査する。

## 復旧地点

- Ver.222正式main: `39ed52d1dfc8014d98f1f6cfea9d008bfff505ca`
- Schedule責務監査main: `4b4e29f37b2f674f2c1608f65b1d8c4135b2b30d`
- Ver.223製品化前: `backup/ver222-schedule-audit-main-before-v223-product`

## 実行方法

```bash
npm install
npx playwright install chromium
npm run test:protocol
npm run test:ui
npm run test:firebase
```

PRとmainへのpushでは `.github/workflows/regression-checks.yml` が構造・Browser・Firebase Emulatorを順番に実行します。

## 次工程

Ver.223正式green後、no-op互換shellとなった `core-view-density-v188.js` 自体をactive manifestから外せるか、製品コード無変更の監査から確認します。
