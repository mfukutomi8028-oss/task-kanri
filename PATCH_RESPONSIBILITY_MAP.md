# パッチ責務マップ（Ver.186 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.186では動的CSS **24本**、動的JS **34本**、合計 **58本**をロードします。

## 整理ルール

1. 古いバージョン番号だけを理由に削除しない。
2. activeな動的CSS/JSは `patch-responsibilities.json` のいずれか1グループに必ず属させる。
3. Firebase書込、削除、revision/Transaction、コメント、関連タスク、予約タスク等は、対応するEmulator E2Eを先に固定する。
4. CSS整理は対象画面・画面幅の視覚回帰を先に固定する。
5. active manifestから外した旧資産は、旧manifestキャッシュ互換のため直ちに物理削除しない。
6. 読込順が意味を持つ場合は静的契約テストで固定する。
7. ブランド画像はファイル名だけで不要判定しない。`assets/brand-v184.*` はVer.185以降も現行画像本体である。

## 現在の主要責務

| グループ | リスク | 現状 |
| --- | --- | --- |
| 基盤・旧安定化 | 高 | 保留 |
| ToDo・タスク軽量操作 | 中 | 書込E2E拡充後に整理候補 |
| ワークフロー・タスク詳細 | 高 | Ver.182〜186で段階分離 |
| ユーザー・コメント補助 | 高 | 保留 |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合、`ui-v157.css`は独立 |
| 業務メモ・予約タスク | 高 | 保留 |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | 視覚回帰後に候補 |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜186 ワークフロー整理

### Ver.182

旧 `archive-duplicate-v153.js` の責務を分け、`archive-ui-v182.js` と `duplicate-merge-v182.js` をactive化しました。旧ファイルはキャッシュ互換用に残しています。

### Ver.183

旧 `inbox-v153.js` を、表示担当の `inbox-ui-v183.js` と通知イベント生成担当の `inbox-events-v183.js` に分離しました。分割前後でFirebase Emulatorの「担当変更→通知自動生成」を同じE2Eで検証しています。

### Ver.186

`ui-v152.css` / `ui-v153.css` に混在していた責務を次の2本へ分離しました。

- `ui-workflow-detail-v186.css`: 関連タスク、フォローアップ、リマインダー、今日のリマインダー、整理・重複フォーム等
- `ui-inbox-archive-v186.css`: 自分への通知、通知ドロワー、メンション補助表示、アーカイブ文脈、アーカイブモーダル等

旧 `ui-v152.css` / `ui-v153.css` はactive/requiredから外しますが物理保存します。旧通知/アーカイブ左メニューを前段で装飾し、後段で `display:none` にしていた上書き連鎖は現行CSSへ持ち込みません。

整理前のVer.185表示を、PC 1366pxとスマホ390pxで「通知入口・通知ドロワー・アーカイブ入口・アーカイブモーダル」の8枚のPNGとして固定しています。`ui-v157.css` のモバイルz-index、100dvh、タッチ領域、overscroll補正は今回は変更せず、Ver.186 CSSより後段で引き続き適用します。

## Ver.185 ブランド仕様（現行）

ブランド関連は `icon-system / low risk` として管理します。

- 現行制御: `brand-v185.js`, `ui-brand-v185.css`
- 現行画像本体: `assets/brand-v184.svg`, `assets/brand-v184.png`
- 旧コード互換: `assets/brand.png`
- 旧制御コード: `brand-v184.js`（Ver.185で置換済み）

`assets/brand-v184.*` は名称がv184でも現行資産です。全参照移行とテスト確認が完了するまでは `assets/brand.png` や `brand-v184.js` も古い名前だけを理由に削除しません。

Ver.185ではPCサイドバーcollapsed時のブランド領域を非表示、expanded/pinned時は表示します。favicon/shortcut icon/apple-touch-icon/Notification APIも新ブランドへ統一します。

## 既に整理済みの表示基盤

- Ver.178: `ui-v169.css` / `ui-v170.css` / `ui-v171.css` → `ui-icon-system-v178.css`
- Ver.179: タスクツールバーCSS → `ui-task-toolbar-v179.css`
- Ver.180: sidebar CSS 4本 → `ui-sidebar-v180.css`
- Ver.181: sidebar JS 3本 → `desktop-sidebar-v181.js`

旧物理ファイルはキャッシュ互換のため段階的に保持しています。

## 復旧地点

今回のVer.186整理では次を固定しています。

- `backup/ver185-before-workflow-css`: Ver.185確定SHA `e73d9be9209c7e53d6828c9b24ac132369082fe6`

問題があれば、この地点を基準にrevert PRを作成します。

## 次の工程

次候補は `ui-v157.css` の責務分離です。同ファイルには通知・アーカイブだけでなくメンションUIとタスク表のモバイル補正が混在しています。390/430/860pxで通知・アーカイブ・メンション・タスク表の視覚/操作回帰を固定してから整理します。
