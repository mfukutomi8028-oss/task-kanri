# 回帰テスト基盤（Ver.224）

このテスト群は、業務管理ボードの整理・改修で既存挙動・見た目・書込整合性を壊さないための安全網です。

Ver.224では、Ver.223でno-op互換shellになった `core-view-density-v188.js` をactive manifestから正式退役します。監査PR #77では、テスト内の仮想manifestからsidecarを除外した状態でToday / Schedule / 検索 / range / mode / 390pxモバイルが成立し、Protocol / Browser / Firebase Emulatorがgreenであることを確認済みです。

物理ファイルは旧キャッシュmanifest / ロールバック互換のため削除しません。`ui-core-density-v188.css` はToday/Scheduleの表示スタイル正本として引き続きactiveです。

## CIで確認する範囲

### 構造・契約

- release versionが **224** であること。
- dynamic CSS **21本** / dynamic JS **32本**であること。
- `core-view-density-v188.js` が `requiredAssets` / `dynamicScripts` のどちらにも存在しないこと。
- 退役した `core-view-density-v188.js` の物理ファイルは互換用に残ること。
- `ui-core-density-v188.css` はactive / requiredのままであること。
- `stable-fixes-v108.js` もactive manifestから外れたまま物理保持されること。
- Todayの意味論と最終DOM、Scheduleのtoolbar/date/search最終DOMは `app.js` が正本であること。
- Schedule検索proxyは既存 `#searchInput` に同期し、Scheduleデータフィルタを二重化しないこと。
- Ver.220の共同編集時返信保存は、コメントとhistoryを同一task transactionで更新しrevisionを1回だけ増やすこと。
- 責務台帳がactive dynamic CSS/JSと1対1で一致すること。
- ルートJavaScriptの構文確認。

### Browser回帰

- 現行runtimeで `core-view-density-v188.js` へのHTTP requestが0件である。
- `window.__WB_CORE_VIEW_DENSITY_V188__` が未定義でも起動が完了する。
- Today操作列と予定通知sidebarが完成形のまま成立する。
- Schedule toolbar / date / search proxyが完成形のまま成立する。
- Schedule検索入力が `#searchInput` に同期し、予定一覧を実際に絞り込む。
- 検索で同期renderが発生してもSchedule検索欄へfocus/caretが復元される。
- 7日間切替・calendar切替後もtoolbar/searchと検索値を維持する。
- 390pxモバイルでも横overflowせずSchedule検索を利用できる。
- Ver.220予定通知・返信履歴、Ver.221 hidden-marker退役、Ver.222 Today正本化、Ver.223 Schedule正本化を維持する。
- desktop / compact / mobile各viewportの既存visual・responsive回帰を維持する。

## Firebase Emulator E2E

Ver.224では保存モデルを変更しません。タスク、ToDo、予定、業務メモ、コメント/返信、reaction、revision、transaction処理は既存のままです。

Realtime Database Emulator `127.0.0.1:9000`、project `demo-task-kanri`、test用roomだけを使用し、本番Firebaseへの通信を遮断した既存write回帰を全件維持します。

## Ver.224で変更するもの

- `release-manifest.js`
  - Ver.224へ更新。
  - `core-view-density-v188.js` を `requiredAssets` / `dynamicScripts` から削除。
  - dynamic JSを33本から32本へ整理。
- `patch-responsibilities.json`
  - active責務からsidecarを除外し、baselineを224へ更新。
- static / Browser契約
  - 仮想manifest退役監査から実製品退役確認へ切替。
- 責務マップ・回帰テスト文書。

## 変更しないもの

- `app.js` のToday / Schedule描画・検索・保存処理。
- `ui-core-density-v188.css` とdynamic CSS 21本。
- タスク / ToDo / 予定 / 業務メモ / コメント・返信 / reactionの書込モデル。
- Firebase transaction / revision。
- `schedule-today-lock-v129.js`。これは次工程の監査候補であり、Ver.224では変更しない。
- 退役した `core-view-density-v188.js` の物理ファイル。

## 復旧地点

- Ver.223正式main: `d524ecf13a137e97da2721c136fe80a234fe16dc`
- sidecar退役監査main: `211213907982f183329d34a4916392b6c435d82d`
- Ver.224製品化前: `backup/ver223-after-core-density-retirement-audit`

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

Ver.224正式green後、`schedule-today-lock-v129.js` が持つToday固定anchor・`7日間` 表記・Schedule MutationObserver責務を、製品コード無変更の監査から確認します。


## Ver.225 スケジュールコピー
- 保存済み予定の編集画面から「コピー」を開けること。
- 1回、複数日、毎日/N日、平日、複数曜日週次、毎月日付、第n/最終曜日、月末、最終平日、毎年を選択できること。
- 回数または終了日で生成範囲を制限でき、最大200件を超えないこと。
- コピー前に件数と日付プレビューが表示され、重複時間帯は確認を出すこと。
- コピー後も元予定を変更せず、時刻・所要時間・担当者・場所・分類・関連タスク・メモを維持した独立予定になること。
- Firebase共同編集では `schedulesRef` に対する単一transactionで複数コピーを一括保存し、transaction内でコピー元revisionを再確認すること。ローカル専用時は既存 `transactionRoom()` を利用すること。
- 390px幅でコピーdialogが横にはみ出さず、戻る／コピーする操作が利用できること。

## Ver.226 スケジュールコピーUX
- コピー方法を「単発・日付指定」「日・週単位」「月・年単位」で視覚的に整理して選択できること。
- コピー方法を変更すると、その方法で必要な入力項目だけが表示されること。
- 選択した方法ごとに、用途説明・設定する項目・設定順が即時に切り替わること。
- 週次では開始日・間隔・曜日・終了条件、毎月第n曜日では開始日・間隔・何週目・曜日・終了条件のみが表示されること。
- 複数日指定では日付追加UIだけを表示し、日付未追加時はコピー実行を無効にすること。
- プレビュー件数と「N件コピーする」ボタン表示が連動し、条件不成立時は「条件を確認してください」として実行できないこと。
- 既存のコピー日付生成ロジック、最大200件、重複警告、コピー元revision確認、Firebase `schedulesRef` atomic transactionを変更しないこと。
- 390px幅でもガイド・曜日選択・プレビュー・下部操作ボタンが横にはみ出さず利用できること。

## Ver.226 復旧地点
- Ver.225正式main: `456a9bcbae12c4422ea0bf6518242bf5c33a0c0e`
- Ver.226着手前: `backup/ver225-before-schedule-copy-ux`
