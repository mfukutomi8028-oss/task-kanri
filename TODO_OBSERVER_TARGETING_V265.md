# Ver.265 ToDo / Today Observer Targeting

## 目的

Ver.264監査で確認した `todo-controls-v144.js` / `todo-tools-v145.js` / `todo-preview-v147.js` の広い subtree `MutationObserver` と observer 起点 `requestAnimationFrame` 再scanを、ToDo保存正本・Firebase同期境界を変更せず縮小する。

## Ver.264 baseline

Ver.264監査では以下を実測した。

| 対象 | callback | mutation | rAF scheduled |
|---|---:|---:|---:|
| ToDo `todo-controls-v144.js` | 50 | 87 | 25 |
| ToDo `todo-tools-v145.js` | 50 | 87 | 25 |
| Today `todo-controls-v144.js` | 28 | 31 | 27 |
| Today `todo-preview-v147.js` | 28 | 31 | 27 |

また、無関係な子孫DOM mutationでもobserverが起床し、操作停止後もcallback / rAFが増加するidle churnを確認した。特に `todo-tools-v145.js` は自身のDOM書込をsubtree observerが再検知する自己誘発ループを持っていた。

## Ver.265実装

`app.js` がToDo / Todayの各view rootを再描画時に置換する既存契約を利用し、対象3sidecarを次の境界へ変更した。

- `#todoView` / `#todayView` の直下 `childList` のみ監視し、`subtree:true` を廃止。
- observer callbackは `addedNodes` に含まれるsemantic targetだけをadoptする。
- observer起点の `requestAnimationFrame` patch / full-root再scanを廃止。
- `todo-tools-v145.js` の結果件数・完了トグル等の文字列書込をidempotent化。
- 検索中の詳細タイトル・メモ編集は既存 `input` eventから直接検索状態を更新する。

## 実ブラウザ結果

PR #149 Regression #598のVer.265専用Browser監査で以下を確認した。

| 対象 | Ver.264 callback | Ver.265 callback | Ver.265 mutation | Ver.265 rAF |
|---|---:|---:|---:|---:|
| ToDo `todo-controls-v144.js` | 50 | 1 | 1 | 0 |
| ToDo `todo-tools-v145.js` | 50 | 1 | 1 | 0 |
| Today `todo-controls-v144.js` | 28 | 1 | 1 | 0 |
| Today `todo-preview-v147.js` | 28 | 1 | 1 | 0 |

ToDo側はcallback 50→1、Today側は28→1となり、observer起点rAFは0になった。

さらに次を確認した。

- rerender後のidle期間でcallback / mutation / rAFが一切増加しない。
- `#todoView` 内の無関係な子孫mutationでcontrols/toolsのcallbackは0。
- `#todayView` 内の無関係な子孫mutationでcontrols/previewのcallbackは0。
- 各observer scopeは `childList:true / subtree:false / attributes:false`。

## 維持する境界

今回変更しないもの:

- `todo-sync-v136.js` の同期・競合処理。
- ToDo CRUD / Firebase persistence。
- ToDo→タスク化処理。
- canonical ToDo / Today DOM生成を所有する `app.js` の保存・同期責務。
- `app.js` へのcustom render event追加。
- sidecarのsemantic owner統合。

正式releaseは動的JSのキャッシュ更新のため **255** とし、`patch-responsibilities.json` の `baselineRelease` も255へ同期する。

## 回帰確認

- Protocol: direct-root observer / addedNodes adoption / rAF撤去 / idempotent writeを固定。
- Browser: callback・mutation・rAF・idle安定・無関係mutation非起床を実測。
- Browser: 検索・完了・完了済み折り畳み・Today preview詳細遷移を確認。
- Firebase Emulator: 既存ToDo追加・完了・編集・タスク化・履歴同期を維持する。

## 次工程

Ver.266では `todo-history-v146.js` を監査する。同ファイルが持つ `#todoView` subtree MutationObserver、requestAnimationFrame patch、60秒intervalの三重更新契約について、canonical rerender・検索入力・storage同期・日跨ぎのどの契機が本当に必要かを実測し、direct-root adoption / event駆動 / 日付境界timerへの縮小可否を判断する。
