# パッチ責務マップ（Ver.181 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを「古い順に消す」のではなく、**現在も有効な責務・依存関係・変更リスク**で整理するための台帳です。

正本は `release-manifest.js` の `dynamicStyles` / `dynamicScripts` です。機械可読な分類は `patch-responsibilities.json` に置き、CIが正本との1対1対応を検証します。

Ver.181では、Ver.178のアイコンCSS統合、Ver.179のタスクツールバーCSS統合、Ver.180のサイドバーCSS統合に続き、サイドバーJavaScript 3本を `desktop-sidebar-v181.js` へ統合しました。動的CSS **23本**、動的JS **31本**、合計 **54本**をロードします。

## 整理ルール

1. バージョン番号が古いことだけを理由に削除しない。
2. `release-manifest.js` に載る動的パッチは、必ず `patch-responsibilities.json` のどれか1グループに所属させる。
3. Firebase・削除・revision/Transaction・コメント・関連タスク・予約タスクなど書込系は、Emulator E2Eがない状態で統合しない。
4. CSS統合は、対象画面・画面幅・サイドバー状態の視覚回帰を先に固定する。
5. JavaScript統合は、操作回帰を先にmainへ導入し、最初の統合ではロジックを書き換えず実行順を維持する。
6. 統合は一度に1責務領域だけ行い、PR上とmain上の回帰テストを両方通す。
7. active manifestから外した旧CSS/JSは、端末に旧manifestが残る可能性を考慮し、少なくとも次の安定化段階までは物理削除しない。
8. 後続パッチとの読み込み順が意味を持つ場合、その順序を静的契約テストで固定する。

## 責務グループ

| グループ | リスク | 方針 | 主な責務 |
| --- | --- | --- | --- |
| 基盤・旧安定化 | 高 | 保留 | 初期安定化、日付、当日固定、一覧ソート、バージョン表示 |
| ToDo・タスク軽量操作 | 中 | 書込テスト後 | ToDo完了、検索、履歴、プレビュー、タスク詳細の軽量操作 |
| ワークフロー・タスク詳細 | 高 | 保留 | 依存、コメントタブ、リマインダー、関連、通知、アーカイブ、複製、詳細IA |
| ユーザー・コメント補助 | 高 | 保留 | ユーザー追加、メンション、リアクション |
| レスポンシブ・サイドバー・ツールバー | 中 | **Ver.181まで段階統合済み** | モバイル補正、861/860px境界、サイドバー状態、タスクツールバー |
| 業務メモ・予約タスク | 高 | 保留 | 業務メモ、開始日、予約タスク |
| アイコン表示 | 低 | **Ver.178で統合済み** | ナビ/サマリーアイコンの統一、サイズ・表示領域補正 |
| 一括操作 | 高 | 保留 | 一括削除・一括変更 |
| 画面密度・見出し整理 | 中 | 視覚回帰後 | 今日ビュー等の重複見出し・主要操作密度 |

詳細な資産一覧・理由は `patch-responsibilities.json` を参照してください。

## 確認できた上書き連鎖

### 通知・アーカイブ

`ui-v152.css` で追加した旧通知/アーカイブ用ナビゲーションは、`ui-v153.css` で明示的に非表示にされ、今日ビュー側の通知入口とコンテキスト型アーカイブへ置き換えられています。

これは統合余地がありますが、通知既読・アーカイブ・復元・複製にJS処理があるため、Firebase Emulatorの書込E2Eを追加するまでは整理しません。

### タスクツールバー（Ver.179で整理済み）

`ui-v162.css` と `ui-v163.css` の最終有効状態を `ui-task-toolbar-v179.css` へ統合済みです。1450/1449px、1720/1719pxの境界、1920pxのcollapsed/expanded/pinned、1366pxの通常状態をPNG基準で固定し、文字切れ・幅不足・コントロール重なりも自動検証しています。

### デスクトップサイドバーCSS（Ver.180で整理済み）

`ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` は、68px collapsed、276px expanded/pinned、固定サイドバー、コンパクトPC補正など同一機能の段階パッチでした。Ver.180では**元のソース順を維持したまま** `ui-sidebar-v180.css` へまとめました。

`ui-v157.css` は調査の結果、モバイル幅での通知・アーカイブ・メンションのz-index、100dvhドロワー、タッチ領域、オーバースクロール等の回帰補正だったため、サイドバー統合には混ぜず独立維持しています。

また `ui-v160.css` に含まれていたタスクツールバー前段ルールも統合CSS内に保持し、`ui-sidebar-v180.css` → `ui-task-toolbar-v179.css` の順序をCIで固定しています。

サイドバー視覚回帰は1366/981/980/861pxのcollapsed→expanded→pinned、860px境界、detail-open時の配置、8枚のPNG基準を確認します。pinned時にChromiumが固定ボタンへフォーカスした結果、サイドバー内部だけがスクロールするテスト揺らぎも確認したため、PNG撮影時は内部scrollTop/scrollLeftを0へ正規化してから比較します。

### デスクトップサイドバーJavaScript（Ver.181で整理）

Ver.180までは次の3本が順番に読み込まれていました。

- `desktop-sidebar-v158.js`: hover/focus/drag、collapsed/expanded/pinned、固定状態localStorage、ナビゲーションのアクセシビリティ属性を管理する本体
- `desktop-sidebar-compat-v159.js`: 860px以下でdesktop class/stateを確実に解除する互換層
- `sidebar-polish-v160.js`: 動的生成された固定ボタンの絵文字を除去しtext-only表示にする補正層

Ver.181ではこれらを `desktop-sidebar-v181.js` 1本へ収容します。ただし最初のJS統合でロジック改善まで同時に行うのは危険なため、**3本のIIFE本文を一切変更せず、元の実行順で連結するだけ**に限定します。旧クラス名、`work-board-desktop-sidebar-pinned-v158` のlocalStorageキー、各イベント、MutationObserverもそのまま維持します。

CIのrelease-contractでは、旧3ファイルの全文が新ファイル内にそのまま存在すること、順序が `v158 core → v159 compatibility → v160 polish` のままであること、active manifestには新ファイルが1回だけ入り旧3本がactiveでないことを検証します。

統合前に `tests/sidebar-js-behavior.spec.mjs` を別PRでmainへ追加し、Ver.180自身に対して以下を固定しました。

- 起動時に固定ボタンが1つだけ生成され、text-only補正とaria属性が成立すること
- hoverで展開し、ポインターによるナビ操作後にfocusが残らず収納へ戻れること
- キーボードfocusで展開し、Escapeで収納してもfocus自体は維持すること
- pinned状態がlocalStorageへ保存され、reload後も復元されること
- 861px→860pxでdesktop stateを解除し、861pxへ戻ると記憶済みpinned状態を復元すること
- dragenterで展開し、dragend後に収納へ戻れること

旧3JSファイルは旧manifestキャッシュとの互換性のため物理削除しません。

### アイコン（Ver.178で整理済み）

旧 `ui-v169.css` → `ui-v170.css` → `ui-v171.css` の3層は `ui-icon-system-v178.css` へ統合済みです。`icon-system-v169.js` は画像差し替え等のJavaScript責務があるためactiveのまま維持します。

## 復旧地点

サイドバーJavaScript整理では、GitHub上に次の2つの退避ブランチを固定しています。

- `backup/ver180-before-sidebar-js`: Ver.180確定SHA `01f2689c7041be5d2aca181224cfb543c8c4cc71`
- `backup/ver180-with-sidebar-js-tests`: Ver.180の本番資産を維持したままJS操作回帰を追加したSHA `3862d3dca700c5d444633f15e3238e4c6b15fcb7`

Ver.181で問題が見つかった場合、通常は後者を基準にrevert PRを作ることで、強化したテストを残したまま本番資産だけVer.180相当へ戻せます。

## 今回は触らない領域

`ui-v157.css`、`bulk-actions-v174.js`、削除プロトコル、Firebase同期、revision/Transaction、コメント/メンション/リアクション、関連タスク、予約タスク、業務メモ保存はVer.181の変更対象から外します。サイドバーJSについても、3本を1本へ収容する以外の内部リファクタリングは行いません。

## 次の工程

次の候補は通知・アーカイブ領域ですが、書込処理を含むため先にFirebase Emulator E2Eを追加します。本番RTDBを使わず、通知既読、アーカイブ表示/復元/複製、さらに既存の作成・編集・削除・競合処理まで確認できる安全網を整えてから整理可否を判断します。
