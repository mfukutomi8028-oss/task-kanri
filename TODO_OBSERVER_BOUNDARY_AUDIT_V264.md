# Ver.264 ToDo / Today Observer Boundary Audit

## Scope

対象は active runtime の以下3sidecarです。

- `todo-controls-v144.js`
- `todo-tools-v145.js`
- `todo-preview-v147.js`

目的は、ToDo / Today再描画時に重複する `MutationObserver` と `requestAnimationFrame` patch の発火量、必要なDOM監視範囲、scope縮小・event駆動化・semantic owner統合の可否を、製品runtimeを変更せず実測することです。

## 現行Observer構成

4個の subtree observer が登録されています。

| owner | root | options | semantic target |
| --- | --- | --- | --- |
| `todo-controls-v144.js` | `#todoView` | `childList + subtree` | `.todo-check` |
| `todo-controls-v144.js` | `#todayView` | `childList + subtree` | `.todo-preview-check` |
| `todo-tools-v145.js` | `#todoView` | `childList + subtree` | `.todo-page`, `.todo-list`, `.todo-item`, tool controls |
| `todo-preview-v147.js` | `#todayView` | `childList + subtree` | `.todo-preview-checkline` |

3sidecarとも callback を `requestAnimationFrame` へcoalesceしていますが、observer自体はroot配下の全childList変更で起床します。

## 実測結果

PR #148 Regression #592 のBrowser監査で以下を確認しました。

### canonical ToDo rerender

- `todo-controls-v144.js`: callback 50 / mutation 87 / rAF scheduled 25 / executed 24
- `todo-tools-v145.js`: callback 50 / mutation 87 / rAF scheduled 25 / executed 24
- `todo-preview-v147.js`: 0

主なmutation targetは `todo-history-toggle-v146`、`todo-completed-toggle-v145`、`todo-search-result-v145` でした。

### canonical Today rerender

- `todo-controls-v144.js`: callback 28 / mutation 31 / rAF scheduled 27 / executed 26
- `todo-preview-v147.js`: callback 28 / mutation 31 / rAF scheduled 27 / executed 26
- `todo-tools-v145.js`: 0

主なmutation targetは `workflow-inbox-entry-badge-v153` で、ToDo preview自身と無関係なToday内更新でも2sidecarが起床しています。

### unrelated descendant mutation + idle observation

ToDoでは無関係な `SECTION.todo-page` mutation後、120ms時点からさらに120ms待っても callback が増加しました。

- controls: 19 -> 35
- tools: 19 -> 35
- rAF: 9 -> 17

Todayでも同様に増加しました。

- controls: 10 -> 19
- preview: 10 -> 19
- rAF: 9 -> 18

したがって、問題は「appの再描画時に一度だけ重複する」ことではなく、広いsubtree監視が他sidecar／自身のDOM後処理を再検知し、idle中にも不要なpatch waveを継続させることです。

## 原因分析

### `todo-tools-v145.js`

最優先の改善対象です。

`patch()` / `applySearch()` がobserver監視下のDOMへ継続的に書き込みます。特に `result.textContent`、completed toggleの `textContent`、一部のinsert/moveが childList mutation を発生させます。そのmutationを同じ `#todoView` subtree observer が再検知し、`requestAnimationFrame -> patch -> DOM write -> observer` の自己誘発ループを作れる構造です。

rAF coalescingは同一frame内の重複抑制には有効ですが、frameを跨ぐ自己誘発ループは止められません。

### `todo-controls-v144.js`

workspace/preview checkboxの初回upgradeは `data-*` guard により原則一度だけです。しかし `#todoView` / `#todayView` 全childList変更を監視するため、`todo-tools`、履歴UI、workflow inbox等の無関係なDOM変更でも起床し、全対象を再scanします。

必要なのは新規 `.todo-check` / `.todo-preview-check` の採用であり、root配下の全childList changeに対するfull scanではありません。

### `todo-preview-v147.js`

`.todo-preview-checkline` の初回upgradeは `data-*` guard により一度だけです。しかし `#todayView` subtree全体を監視するため、workflow inbox badge等の無関係なToday mutationでも起床します。

必要なのは新規preview lineの採用だけです。

## 監視scopeの判断

root自体 (`#todoView`, `#todayView`) はappが `innerHTML` 再描画するため監視地点として妥当ですが、callback条件が広すぎます。

次工程では次の順で縮小するのが安全です。

1. **addedNodes起点のtargeted adoption**
   - mutationの `addedNodes` 自体または子孫にsemantic targetが含まれる場合だけpatchする。
   - unrelated removal、badge text更新、既upgrade済みcontrolのtext更新では起床しない。
2. **idempotent DOM write**
   - `textContent` / attributes / classを書き込む前に現値と比較し、同値なら書かない。
   - 特に `todo-tools-v145.js` の自己誘発churnを先に止める。
3. **full-root scanの縮小**
   - callback時に `document.querySelectorAll(...)` ではなく、added subtreeだけをupgradeする。
4. **app描画event化は将来候補**
   - 現行 `app.js` にはToDo/Today render完了をsidecar向けに通知する公開custom event境界がないため、Ver.265で新規event APIを追加するより、まずtargeted observerへ縮小する方が変更面積と回帰リスクが小さい。

## event駆動化・semantic owner統合

### event駆動化

可能ですが、現時点では第二候補です。`app.js` のrender lifecycleへ新しい公開event contractを導入すると、sidecarだけでなくcanonical renderer側の変更が必要になります。今回の問題はobserver scopeと非idempotent writeで説明できるため、まず既存境界内で解消できるかを確認します。

### semantic owner統合

中期的には有効です。

- ToDo workspace最終DOMを `app.js` が直接 `todo-state-toggle-v144` / tools controls込みで生成する
- Today preview最終DOMを `app.js` が直接accessibility role/hint込みで生成する

まで進めればobserver自体を退役できます。ただしToDo保存正本・render契約へ変更が及ぶため、Ver.265では一足飛びに統合せず、targeted observer化で安全性を確認してから別工程で判断します。

## Ver.264結論

- 4個のsubtree observerが存在し、ToDoではcontrols/tools、Todayではcontrols/previewが同一mutation waveを重複処理している。
- `todo-tools-v145.js` は自身のDOM書込を再検知する自己誘発churnを持つため最優先。
- `todo-controls-v144.js` / `todo-preview-v147.js` はsemantic targetと無関係なmutationまで監視している。
- `requestAnimationFrame` coalescingだけではframe跨ぎの不要発火を防げない。
- Ver.264では製品runtimeを変更しない。
- 次工程は Ver.265 とし、**idempotent write + addedNodes限定adoption + full-root scan縮小**を先に製品化する。
- `app.js` render event追加やsemantic owner統合は、Ver.265の効果測定後に必要性を再評価する。

## Safety

PR #148では製品runtime・Firebase保存経路・release version・baselineReleaseを変更していません。

Regression #592:

- Protocol: 229 passed
- Browser: 165 passed / 55 skipped
- Firebase Emulator: success

既存ToDo CRUD、promote、履歴、Today previewを含む既存Regressionはgreenです。
