# パッチ責務マップ（Ver.179 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを「古い順に消す」のではなく、**現在も有効な責務・依存関係・変更リスク**で整理するための台帳です。

正本は `release-manifest.js` の `dynamicStyles` / `dynamicScripts` です。機械可読な分類は `patch-responsibilities.json` に置き、CIが正本との1対1対応を検証します。

Ver.179では、Ver.178のアイコン統合に続き、タスクツールバーの `ui-v162.css` / `ui-v163.css` を1層へ統合したため、動的CSS **26本**、動的JS **33本**、合計 **59本**をロードします。

## 整理ルール

1. バージョン番号が古いことだけを理由に削除しない。
2. `release-manifest.js` に載る動的パッチは、必ず `patch-responsibilities.json` のどれか1グループに所属させる。
3. Firebase・削除・revision/Transaction・コメント・関連タスク・予約タスクなど書込系は、Emulator E2Eがない状態で統合しない。
4. CSS統合は、対象画面・画面幅・サイドバー状態の視覚回帰を先に固定する。
5. 統合は一度に1責務領域だけ行い、PR上とmain上の回帰テストを両方通す。
6. 後続パッチが旧UIを `display:none` 等で無効化していても、対応JSの生成・イベント・データ処理を確認するまでは旧コードを消さない。
7. active manifestから外した旧CSSは、端末に旧manifestが残る可能性を考慮し、少なくとも次の安定化段階までは物理削除しない。

## 責務グループ

| グループ | リスク | 方針 | 主な責務 |
| --- | --- | --- | --- |
| 基盤・旧安定化 | 高 | 保留 | 初期安定化、日付、当日固定、一覧ソート、バージョン表示 |
| ToDo・タスク軽量操作 | 中 | 書込テスト後 | ToDo完了、検索、履歴、プレビュー、タスク詳細の軽量操作 |
| ワークフロー・タスク詳細 | 高 | 保留 | 依存、コメントタブ、リマインダー、関連、通知、アーカイブ、複製、詳細IA |
| ユーザー・コメント補助 | 高 | 保留 | ユーザー追加、メンション、リアクション |
| レスポンシブ・サイドバー・ツールバー | 中 | 視覚回帰後 | 861/860px境界、サイドバー、タスクツールバー |
| 業務メモ・予約タスク | 高 | 保留 | 業務メモ、開始日、予約タスク |
| アイコン表示 | 低 | **Ver.178で統合済み** | ナビ/サマリーアイコンの統一、サイズ・表示領域補正 |
| 一括操作 | 高 | 保留 | 一括削除・一括変更 |
| 画面密度・見出し整理 | 中 | 視覚回帰後 | 今日ビュー等の重複見出し・主要操作密度 |

詳細な資産一覧・理由は `patch-responsibilities.json` を参照してください。

## 確認できた上書き連鎖

### 通知・アーカイブ

`ui-v152.css` で追加した旧通知/アーカイブ用ナビゲーションは、`ui-v153.css` で明示的に非表示にされ、今日ビュー側の通知入口とコンテキスト型アーカイブへ置き換えられています。

これは統合余地がありますが、通知既読・アーカイブ・復元・複製にJS処理があるため、CSSだけを先に削除するのは危険です。

### タスクツールバー（Ver.179で整理）

`ui-v162.css` は詳細パネルopen時の1行ツールバーについて、Quick Add入力欄と検索欄を20:80の割合で圧縮しました。一方、同ファイルではQuick Addボタン自体も88pxに固定していたため、`ui-v163.css` がボタンを自然幅へ戻しています。

Ver.179ではこの**最終的に有効な状態だけ**を `ui-task-toolbar-v179.css` へ統合しました。旧2ファイルはactive manifestから外しますが、旧manifestのキャッシュ互換のため物理ファイルは残します。

統合前にGitHub Actions上のChromiumで以下8条件をPNG基準として固定しました。

- 1920px / collapsed / detail-open
- 1920px / expanded / detail-open
- 1920px / pinned / detail-open
- 1450px / collapsed / detail-open（非固定サイドバー側の適用境界）
- 1449px / collapsed / detail-open（境界直前・複数行レイアウト）
- 1720px / pinned / detail-open（固定サイドバー側の適用境界）
- 1719px / pinned / detail-open（境界直前・複数行レイアウト）
- 1366px / collapsed / detail-closed（通常状態の非影響確認）

視覚比較に加えて、Quick Addボタンがクリップされていないこと、Quick Add入力欄・検索欄が実用幅を維持すること、主要コントロールの矩形が重ならないことも自動確認します。

### アイコン（Ver.178で整理済み）

旧 `ui-v169.css` → `ui-v170.css` → `ui-v171.css` の3層は、最終的に有効な指定を `ui-icon-system-v178.css` へ統合しました。

統合前にPC collapsed/expanded、スマホ390pxナビ、スマホ390pxサマリーの4つをPNG基準として固定しています。旧3ファイルはactive manifestから外しましたが、キャッシュ互換用として物理ファイルを残しています。

`icon-system-v169.js` は画像差し替え等のJavaScript責務があるためactiveのまま維持します。

## 今回は触らない領域

`bulk-actions-v174.js`、削除プロトコル、Firebase同期、revision/Transaction、コメント/メンション/リアクション、関連タスク、予約タスク、業務メモ保存は整理対象から外します。

また、active manifestから外した旧CSSや、`requiredAssets` に存在しても `dynamicStyles` / `dynamicScripts` ではない静的・互換資産は、動的パッチ台帳とは別管理です。物理削除候補にする場合はHTML・manifest・JS参照とキャッシュ移行を別途確認します。

## 次の工程

次の中リスク候補は、`ui-v157.css` / `ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` の**サイドバー表示レイヤー**です。

1. 861/860px境界を含むPC/モバイル切替の視覚基準を拡張する。
2. collapsed / expanded / pinned × detail-open / detail-closedを固定する。
3. JS側 `desktop-sidebar-v158.js` / compat / polish の責務とCSS責務を分離して整理する。
4. 書込系の整理へ進む前にFirebase Emulator E2Eを追加する。
