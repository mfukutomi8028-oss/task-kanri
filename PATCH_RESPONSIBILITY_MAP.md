# パッチ責務マップ（Ver.197 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.197では動的CSS **21本**、動的JS **34本**の構成とロード順を維持し、基本状態5種の削除保護が `app.js` / `stable-fixes-v108.js` / `mobile-fixes.js` に分散している現状を安全網として固定します。製品側の削除ロジックはまだ変更しません。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction、コメント、関連タスク、予約タスク等は、対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を維持する。
5. active manifestから外した旧資産は、旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順や責務境界は静的契約テストで固定する。
7. 基盤JavaScriptは、現在の振る舞いを個別テストで固定してから、1責務ずつ最小変更する。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| お知らせダイアログ・一覧ソート表示 | 低 | Ver.193で機能所有名へ整理済み |
| 基盤・旧安定化ロジック | 高 | **Ver.197で基本状態削除保護の3層分散を契約化** |
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

## Ver.182〜193 の主な整理

- Ver.182〜183: archive / inbox をUI・イベント責務へ分割
- Ver.186〜187: workflow / inbox-archive CSSを機能所有へ分割し、混在mobile CSSを退役
- Ver.188: density責務を `core-view-density-v188.js` / `ui-core-density-v188.css` に限定
- Ver.189: ToDo・タスク・スケジュールの軽量UI CSSを機能別に分離
- Ver.190: 業務メモ・予約タスクの表示責務を整理し、Firebase Emulator安全網を拡張
- Ver.191: ユーザー登録・メンション・リアクションを機能所有名へ整理
- Ver.192: ワークフロー・タスク詳細の旧世代CSS5本を機能所有名へ置換
- Ver.193: お知らせダイアログ・一覧ソートCSSを機能所有名へ置換

## Ver.194〜196 基盤JavaScript整理

- Ver.194: `WORK_BOARD_RELEASE.version` をバージョン番号の正本へ統一
- Ver.195: stable/mobileの重複・近接責務を監査し、通常UI安全網を60→63件へ拡張
- Ver.196: stable側の「7日間」ラベル補正だけを `schedule-today-lock-v129.js` へ移管。Observer追加なし

## Ver.197 基本状態削除保護の責務監査

基本状態5種は `未着手` / `対応中` / `確認待ち` / `保留` / `完了` です。

監査の結果、現在は次の3層構造です。

- `app.js`: 5状態を `DEFAULT_STATUSES` として定義するが、直接の削除拒否と名称固定は `完了` のみ
- `stable-fixes-v108.js`: 5状態すべての削除ボタンdisabled・ARIA/title・capture click guardを担当
- `mobile-fixes.js`: モバイル互換として同じ5状態削除ガードを重複保持

単純に `app.js` の既存 `protectedStatus` を5状態へ広げると、削除だけでなく名称入力までreadonly化するため不採用です。

Ver.197では製品コードを変更せず、次を固定します。

1. `DEFAULT_STATUSES` が5基本状態の正本であること
2. 5状態すべて削除不可であること
3. `未着手`〜`保留` の名称編集は可能なままであること
4. `完了` だけ名称固定であること
5. カスタム状態の削除は可能であること
6. stable/mobileが同じ削除ガードを重複所有していること

詳細は `STATUS_DELETE_OWNERSHIP_AUDIT_V197.md` を参照します。

## 復旧地点

- `backup/ver185-before-workflow-css`: `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`
- `backup/ver188-before-todo-write-tests`: `72bfb5a27cb36572364fd3b0cf7d05d4f8431f5d`
- `backup/ver188-with-todo-emulator-e2e`: `5c42c840b65340728dd97b6fe76fe8ca62030736`
- `backup/ver189-before-work-memo-write-tests`: `6970defe13c05bd3f5b6d81feb5ca3b8a8f3ad75`
- `backup/ver189-with-work-features-emulator-e2e`: `2d64ee501b63968cd6e71129e131d09d16ca4de4`
- `backup/ver190-before-user-comment-write-tests`: `7abf2ad9d56789219ff0b593ca0dabe12e8f144a`
- `backup/ver190-with-user-comment-emulator-e2e`: `b5f50d4fd0f8ae6d293d3ce82b3522009417d624`
- `backup/ver191-before-workflow-detail-css`: `821612c3de5b5cd7c620b3e1ac529c886ad2b2a5`
- `backup/ver192-before-foundation-css`: `f0014e6c8899a0f06bbfc980e5c55b9ce0ea6c8c`
- `backup/ver193-before-foundation-js-safety`: `b57b03ba4ff3343feeef9e39b5a3de1025829b9c`
- `backup/ver193-with-foundation-js-safety`: `87cbfdebe1302e6a0c803e9d43ee4831dded541d`
- `backup/ver194-before-stable-fixes-audit`: `c16f2dd596f2d10c3b89cd38a21499138399584c`
- `backup/ver195-stable-fixes-audit-green`: `6a95605e9e4b118033dff58c07e37fa8fac8690e`
- `backup/ver196-before-status-delete-ownership`: `9961722663350be71415c078abe50bf1975c8842`

## 次の工程

Ver.197がPRとmainの両方でgreenになった後は、`app.js` に**削除保護専用predicate**を追加し、5基本状態の削除拒否をアプリ本体へ移します。名称編集固定は `完了` のまま維持します。その後、まず `stable-fixes-v108.js` の重複削除ガードだけを退役候補とし、`mobile-fixes.js` は別工程で評価します。
