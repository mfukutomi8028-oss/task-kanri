# パッチ責務マップ（Ver.198 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.198では動的CSS **21本**、動的JS **34本**とロード順を維持したまま、基本状態5種の**削除保護だけ**を `app.js` の正本責務へ移しました。名称編集は従来どおり `完了` だけ固定し、`stable-fixes-v108.js` にあった重複削除ガードを退役しています。`mobile-fixes.js` の同等ガードは移行期間の互換層として残し、別工程で扱います。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction等は対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. 基盤JavaScriptは現在の振る舞いを個別テストで固定してから、1責務ずつ最小変更する。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| お知らせダイアログ・一覧ソート表示 | 低 | Ver.193で機能所有名へ整理済み |
| 基盤・旧安定化ロジック | 高 | **Ver.198で基本状態削除保護をapp.jsへ正本化、stable重複ガード退役** |
| ToDo軽量操作 | 中 | Ver.189でCSS責務整理済み |
| タスク軽量操作 | 中 | Ver.189でCSS責務整理済み |
| スケジュール・モバイル表示 | 低 | Ver.189でCSS責務整理済み |
| ワークフロー・タスク詳細 | 高 | Ver.192で旧世代CSSを機能所有名へ整理済み |
| ユーザー・コメント補助 | 高 | Ver.191で機能所有名へ整理済み |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合済み |
| 業務メモ・予約タスク | 高 | Ver.190で表示責務整理済み |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | Ver.188で整理済み |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.194〜197 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一
- Ver.195: stable/mobileの重複・近接責務を監査し、通常UI安全網を60→63件へ拡張
- Ver.196: stable側の `7日間` ラベル補正だけを `schedule-today-lock-v129.js` へ移管
- Ver.197: 基本状態5種の削除保護が `app.js` / stable / mobileへ分散している状態を静的・実ブラウザ契約で固定

## Ver.198 基本状態削除保護の正本化

基本状態5種は `未着手` / `対応中` / `確認待ち` / `保留` / `完了` です。

Ver.198では `app.js` に `isProtectedDeleteStatus()` を追加し、`DEFAULT_STATUSES` を使って5基本状態の削除拒否をアプリ本体で判定するようにしました。状態管理UIでも、名称編集可否と削除可否を別々に判定します。

- 名称編集固定: `isCompletedStatus()`。従来どおり `完了` のみreadonly
- 削除保護: `isProtectedDeleteStatus()`。5基本状態すべて対象
- 削除ボタン: app自身がdisabled、`aria-disabled="true"`、削除不可titleを付与
- `deleteStatus()`: UIを迂回して呼ばれても5基本状態を拒否
- カスタム状態: 従来どおり削除可能

`stable-fixes-v108.js` からは、状態削除に関する以下の重複責務だけを除去しました。

- 基本状態配列
- 削除保護predicate
- 削除ボタンpatch
- capture clickによる削除阻止・alert

日付制約、Todayフィルタ、モバイル状態タブの横スクロール補正、manifest版表示など、stableの他責務は変更していません。

`mobile-fixes.js` は今回変更せず、同じ5状態削除ガードを移行期間の互換層として保持しています。一度にstable/mobile双方を外さず、app正本化後の実ブラウザ回帰を確認してから別工程でmobile側だけを評価します。

## 復旧地点

- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`
- `backup/ver197-before-status-delete-canonicalization`: `a2365af90d95add7b76ac4726be96af3f92e2d70`

## 次の工程

Ver.198がPRとmainの両方でgreenになった後は、`mobile-fixes.js` に残る**基本状態削除保護だけ**を対象に監査・退役します。モバイルメニュー、状態タブ、Today表示、日付補正など他のモバイルUX責務は同じ変更に混ぜません。
