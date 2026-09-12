# パッチ責務マップ（Ver.187 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.187では動的CSS **23本**をロードします。Ver.186まで独立していた `ui-v157.css` はactive/requiredから外し、同ファイルに混在していたモバイル回帰補正を本来の所有CSSへ戻しました。旧 `ui-v157.css` 自体は旧manifestキャッシュ互換のため物理保存します。

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
| ワークフロー・タスク詳細 | 高 | Ver.182〜187で段階整理 |
| ユーザー・コメント補助 | 高 | メンション表示補正はVer.187で所有CSSへ移管、JS整理は保留 |
| レスポンシブ・サイドバー・ツールバー | 中 | Ver.179〜181で統合、Ver.187で混在モバイルパッチを解消 |
| 業務メモ・予約タスク | 高 | 保留 |
| アイコン表示 | 低 | Ver.178統合＋Ver.185ブランド制御 |
| 一括操作 | 高 | 保留 |
| 画面密度・見出し整理 | 中 | **次の整理候補** |

詳細資産一覧は `patch-responsibilities.json` を参照します。

## Ver.182〜187 ワークフロー整理

### Ver.182

旧 `archive-duplicate-v153.js` の責務を `archive-ui-v182.js` と `duplicate-merge-v182.js` へ分離しました。旧ファイルはキャッシュ互換用に保持します。

### Ver.183

旧 `inbox-v153.js` を、表示担当の `inbox-ui-v183.js` と通知イベント生成担当の `inbox-events-v183.js` に分離しました。Firebase Emulatorで担当変更から通知生成まで固定しています。

### Ver.186

`ui-v152.css` / `ui-v153.css` に混在していた責務を次の2本へ分離しました。

- `ui-workflow-detail-v186.css`: 関連タスク、フォローアップ、リマインダー、整理・重複フォーム等
- `ui-inbox-archive-v186.css`: 自分への通知、通知ドロワー、アーカイブ文脈、アーカイブモーダル等

旧 `ui-v152.css` / `ui-v153.css` はactive/requiredから外しましたが、物理保存しています。

### Ver.187

`ui-v157.css` に後段パッチとして混在していたモバイル補正を、それぞれ本来の所有CSSへ移管しました。

- タスク一覧の経過時間余白 → `ui-v148.css`
- タスク詳細タブ／操作ボタンの44pxタップ領域 → `ui-v149.css`
- メンションpickerのz-index／overscroll → `ui-v156.css`
- 通知／アーカイブ／toast／100dvh／通知ボタン配置 → `ui-inbox-archive-v186.css`

そのうえで `ui-v157.css` をactive/requiredから外しました。390 / 430 / 860pxのVer.186表示を事前にPNG基準化し、Ver.187整理後も同一表示であることをVisual Regressionで確認します。

## Ver.185 ブランド仕様（現行）

ブランド関連は `icon-system / low risk` として管理します。

- 現行制御: `brand-v185.js`, `ui-brand-v185.css`
- 現行画像本体: `assets/brand-v184.svg`, `assets/brand-v184.png`
- 旧コード互換: `assets/brand.png`
- 旧制御コード: `brand-v184.js`（Ver.185で置換済み）

`assets/brand-v184.*` は名称がv184でも現行資産です。全参照移行とテスト確認が完了するまでは `assets/brand.png` や `brand-v184.js` も古い名前だけを理由に削除しません。

Ver.185ではPCサイドバーcollapsed時のブランド領域を非表示、expanded/pinned時は表示します。favicon / shortcut icon / apple-touch-icon / Notification APIも現行ブランドへ統一します。

## 既に整理済みの表示基盤

- Ver.178: アイコンCSS3層 → `ui-icon-system-v178.css`
- Ver.179: タスクツールバーCSS → `ui-task-toolbar-v179.css`
- Ver.180: sidebar CSS 4本 → `ui-sidebar-v180.css`
- Ver.181: sidebar JS 3本 → `desktop-sidebar-v181.js`
- Ver.186: workflow CSS2層 → detail / inbox-archive責務へ分離
- Ver.187: `ui-v157.css` の混在モバイル補正を所有CSSへ移管しactive退役

旧物理ファイルはキャッシュ互換のため段階的に保持しています。

## 復旧地点

- `backup/ver185-before-workflow-css`: Ver.185確定SHA `e73d9be9209c7e53d6828c9b24ac132369082fe6`
- `backup/ver186-before-mobile-css`: Ver.186確定SHA `048f065f9b4fd69e00ec3fb3e748cb8e58e2307d`

Ver.187で問題が見つかった場合は後者を基準にrevertできます。

## 次の工程

次候補は `ui-v176.css` / `workspace-density-v176.js` の画面密度・見出し整理です。今日ビュー等の重複見出し、カード密度、主要操作配置へ影響するため、PC/スマホの現行表示と操作導線を先に固定してから、前段UIへ安全に統合できるか判断します。
