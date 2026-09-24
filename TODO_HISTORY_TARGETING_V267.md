# Ver.267 ToDo履歴 Observer / Timer Targeting

## 目的

Ver.266監査で確認した `todo-history-v146.js` の広い `#todoView` subtree `MutationObserver`、observer起点 `requestAnimationFrame`、60秒intervalを、ToDo保存正本・Firebase同期境界を変えずに縮小する。

## Ver.266 baseline

PR #152 Regression #607 / #608 では次を実測した。

- canonical ToDo描画直後: callback 14 / mutation 26 / rAF scheduled 14。
- 追加idle後: callback 26 / mutation 38 / rAF scheduled 26。
- 無関係な子孫DOM mutation後: callback 9 / mutation 9 / rAF scheduled 8。
- `#todoView` を `childList:true, subtree:true` で監視していた。
- 60秒 `setInterval` を常時保持していた。
- Observerを切断しても、検索input・storage・timerはそれぞれ独立した更新契機として成立した。

自己誘発churnの主因は `applyVisibility()` が同じtoggle labelを `textContent` へ繰り返し書き、そのchildList変更を同じsubtree observerが再検知する循環だった。

## Ver.267実装

### Observer

- `#todoView` 直下の `childList` だけを監視する。
- `subtree:true` を廃止する。
- callbackでは `addedNodes` 内に `[data-todo-lists]` を含むcanonical ToDo再描画だけを採用する。
- observer起点 `requestAnimationFrame` schedulerを撤去する。
- 履歴section自身の追加・更新はview rootの子孫なのでobserver対象外となる。

### Event-driven refresh

- 検索inputは履歴データを再読込せず、既存sectionの開閉状態だけを直接 `applyVisibility()` する。
- cross-tabのToDo保存またはcurrent user変更は `storage` eventから直接 `patch()` する。
- 同一tabのToDo更新はcanonical app rendererによるview root再描画をdirect-root observerが採用する。

### Date boundary

- 60秒pollingを廃止する。
- 次のローカル日付境界までのone-shot `setTimeout` を1本だけ保持する。
- timeout発火後に履歴を更新し、次の境界timerを再設定する。
- sleep/BFCache復帰で日付を跨いだ場合は `pageshow` / `visibilitychange` から日付差分を検出して補正する。

### Idempotent DOM write

- collapse class、`hidden`、toggle label、`aria-expanded` は現在値と異なる場合だけ書き換える。
- 履歴本文の再生成は従来どおりsignature変更時だけ行う。

## 維持する境界

今回変更しないもの:

- `todo-sync-v136.js` の同期・競合処理。
- ToDo CRUD / Firebase persistence。
- ToDo→タスク化。
- canonical ToDo DOM生成を所有する `app.js`。
- 履歴の7日範囲、当日完了除外、current user所有条件。
- 履歴の折り畳み保存keyとUI文言。

## 回帰安全網

Protocolで以下を固定する。

- direct-root `childList` observer。
- subtree監視、observer-owned rAF、60秒intervalの撤去。
- input/storage event駆動。
- local date boundary timeoutとresume補正。
- idempotent DOM write。
- release 256 / baselineRelease 256一致。

Browserで以下を実測する。

- canonical rerender時のcallbackが1〜2回以内、rAF 0。
- rerender後idleでcallback / mutationが増加しない。
- 無関係な子孫mutationでcallback 0。
- 検索による履歴開閉がobserver/rAFなしで成立する。
- storage eventで履歴内容が直接更新される。
- 7日前の履歴が日付境界timeout発火後に期限外となり、timerがone-shotで再設定される。

既存Firebase Emulator ToDo追加・完了・編集・タスク化・履歴同期回帰もそのまま維持する。

## 次工程

Ver.268では `release-manifest.js` の初回描画互換用legacy icon observerを監査する。現状はdocumentElement subtreeを広く監視し続けるため、assets-ready後に本当に監視継続が必要か、現行runtimeが旧画像srcを後から生成する実需があるか、`brand-v185.js` / `icon-system-v169.js` との責務重複がないかを実ブラウザで測定する。
