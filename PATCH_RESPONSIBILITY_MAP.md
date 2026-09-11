# パッチ責務マップ（Ver.180 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを「古い順に消す」のではなく、**現在も有効な責務・依存関係・変更リスク**で整理するための台帳です。

正本は `release-manifest.js` の `dynamicStyles` / `dynamicScripts` です。機械可読な分類は `patch-responsibilities.json` に置き、CIが正本との1対1対応を検証します。

Ver.180では、Ver.178のアイコン統合、Ver.179のタスクツールバー統合に続き、デスクトップサイドバーの `ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` を `ui-sidebar-v180.css` へ統合しました。動的CSS **23本**、動的JS **33本**、合計 **56本**をロードします。

## 整理ルール

1. バージョン番号が古いことだけを理由に削除しない。
2. `release-manifest.js` に載る動的パッチは、必ず `patch-responsibilities.json` のどれか1グループに所属させる。
3. Firebase・削除・revision/Transaction・コメント・関連タスク・予約タスクなど書込系は、Emulator E2Eがない状態で統合しない。
4. CSS統合は、対象画面・画面幅・サイドバー状態の視覚回帰を先に固定する。
5. 統合は一度に1責務領域だけ行い、PR上とmain上の回帰テストを両方通す。
6. 後続パッチが旧UIを `display:none` 等で無効化していても、対応JSの生成・イベント・データ処理を確認するまでは旧コードを消さない。
7. active manifestから外した旧CSSは、端末に旧manifestが残る可能性を考慮し、少なくとも次の安定化段階までは物理削除しない。
8. 統合前後で他の後段CSSとの読み込み順が意味を持つ場合、その順序を静的契約テストで固定する。

## 責務グループ

| グループ | リスク | 方針 | 主な責務 |
| --- | --- | --- | --- |
| 基盤・旧安定化 | 高 | 保留 | 初期安定化、日付、当日固定、一覧ソート、バージョン表示 |
| ToDo・タスク軽量操作 | 中 | 書込テスト後 | ToDo完了、検索、履歴、プレビュー、タスク詳細の軽量操作 |
| ワークフロー・タスク詳細 | 高 | 保留 | 依存、コメントタブ、リマインダー、関連、通知、アーカイブ、複製、詳細IA |
| ユーザー・コメント補助 | 高 | 保留 | ユーザー追加、メンション、リアクション |
| レスポンシブ・サイドバー・ツールバー | 中 | 段階整理中 | モバイル補正、861/860px境界、サイドバー状態、タスクツールバー |
| 業務メモ・予約タスク | 高 | 保留 | 業務メモ、開始日、予約タスク |
| アイコン表示 | 低 | **Ver.178で統合済み** | ナビ/サマリーアイコンの統一、サイズ・表示領域補正 |
| 一括操作 | 高 | 保留 | 一括削除・一括変更 |
| 画面密度・見出し整理 | 中 | 視覚回帰後 | 今日ビュー等の重複見出し・主要操作密度 |

詳細な資産一覧・理由は `patch-responsibilities.json` を参照してください。

## 確認できた上書き連鎖

### 通知・アーカイブ

`ui-v152.css` で追加した旧通知/アーカイブ用ナビゲーションは、`ui-v153.css` で明示的に非表示にされ、今日ビュー側の通知入口とコンテキスト型アーカイブへ置き換えられています。

これは統合余地がありますが、通知既読・アーカイブ・復元・複製にJS処理があるため、CSSだけを先に削除するのは危険です。

### タスクツールバー（Ver.179で整理済み）

`ui-v162.css` は詳細パネルopen時の1行ツールバーについて、Quick Add入力欄と検索欄を圧縮しました。一方、同ファイルではQuick Addボタン自体も固定幅にしていたため、`ui-v163.css` がボタンを自然幅へ戻していました。

Ver.179では最終的に有効な状態を `ui-task-toolbar-v179.css` へ統合しました。1450/1449px、1720/1719pxの境界、1920pxのcollapsed/expanded/pinned、1366pxの通常状態をPNG基準で固定し、文字切れ・幅不足・コントロール重なりも自動検証しています。

### デスクトップサイドバー（Ver.180で整理）

調査の結果、当初同じ候補に入れていた `ui-v157.css` はサイドバー本体ではありませんでした。実際の責務は、モバイル幅での通知・アーカイブ・メンションのz-index、100dvhドロワー、タッチ領域、オーバースクロール等の回帰補正です。このためVer.180では統合対象から外し、独立したactive CSSとして維持します。

サイドバー本体のCSSは、次の4層が同一機能を段階的に補正していました。

- `ui-v158.css`: 68px collapsed / 276px expanded・pinned、アイコン中心の収納表示などの基礎
- `ui-v159.css`: 981px以上で固定サイドバー・固定詳細パネルモデルへ戻す互換補正
- `ui-v160.css`: app-shellの単一トラック固定、collapsed時の固定ボタン非表示、text-only固定ボタン、旧pseudo element除去などの最終polish
- `ui-v164.css`: 861〜980pxにも同じ固定サイドバーモデルを適用するコンパクトPC補正

Ver.180では、この4層を**元のソース順を維持したまま** `ui-sidebar-v180.css` へまとめました。初回の整理ではルール自体を大胆に書き換えず、まず「4ファイルを1ファイルへ集約する」ことを優先しています。

`ui-v160.css` には1450px/1720px以上のタスクツールバー前段ルールも含まれていました。これらも `ui-sidebar-v180.css` 内にそのまま保持し、Ver.179の最終ツールバー調整が後から勝つよう、`release-manifest.js` では **`ui-sidebar-v180.css` → `ui-task-toolbar-v179.css`** の順を維持します。この順序はCIのrelease-contractで固定します。

統合前のVer.179を基準として、GitHub Actions上のChromiumで16件の専用テストを追加しました。1366/981/980/861pxでcollapsed→expanded→pinnedの状態遷移と作業領域位置を確認し、860pxではdesktop class/stateが解除されることを検証します。また1366/980/861pxでdetail-openにしても左側のサイドバー予約位置と横スクロールが崩れないことを確認します。

PNG基準は次の8条件です。

- 1366px: collapsed / expanded / pinned
- 980px: collapsed / expanded / pinned
- 861px: collapsed / expanded

旧 `ui-v158.css` / `ui-v159.css` / `ui-v160.css` / `ui-v164.css` はactive manifestから外しますが、旧manifestが端末キャッシュに残った場合の404を避けるため、物理ファイルは残します。

JavaScript側の `desktop-sidebar-v158.js` / `desktop-sidebar-compat-v159.js` / `sidebar-polish-v160.js` は今回変更しません。前者は状態管理本体、compatは860px以下でdesktop stateを確実に解除する役割、polishは動的生成された固定ボタンのアイコンを除去する役割があり、CSS統合と同時に触ると回帰時の原因切り分けが難しくなるためです。

### アイコン（Ver.178で整理済み）

旧 `ui-v169.css` → `ui-v170.css` → `ui-v171.css` の3層は、最終的に有効な指定を `ui-icon-system-v178.css` へ統合しました。

統合前にPC collapsed/expanded、スマホ390pxナビ、スマホ390pxサマリーの4つをPNG基準として固定しています。旧3ファイルはactive manifestから外しましたが、キャッシュ互換用として物理ファイルを残しています。

`icon-system-v169.js` は画像差し替え等のJavaScript責務があるためactiveのまま維持します。

## 今回は触らない領域

`desktop-sidebar-v158.js` / `desktop-sidebar-compat-v159.js` / `sidebar-polish-v160.js`、`ui-v157.css`、`bulk-actions-v174.js`、削除プロトコル、Firebase同期、revision/Transaction、コメント/メンション/リアクション、関連タスク、予約タスク、業務メモ保存はVer.180の変更対象から外します。

また、active manifestから外した旧CSSや、`requiredAssets` に存在しても `dynamicStyles` / `dynamicScripts` ではない静的・互換資産は、動的パッチ台帳とは別管理です。物理削除候補にする場合はHTML・manifest・JS参照とキャッシュ移行を別途確認します。

## 次の工程

次の候補はサイドバーJavaScript 3本です。CSS統合の安全網を利用しながら、pointer/mouse、keyboard focus、Escape、resize/orientation、861/860px切替、固定状態のlocalStorage永続化を専用操作テストで固定します。その結果、3本の責務を1本へ安全にまとめられると確認できた場合だけ、別PRで統合します。

書込系の整理へ移る前にはFirebase Emulator E2Eを追加し、本番RTDBを使わずに作成・編集・削除・競合処理まで確認します。
