# Ver.206 foundation MutationObserver 監査

## 目的

Ver.205でモバイル状態タブCSSの通常表示責務を `mobile-fixes.js` へ一本化した後、次の整理候補である `stable-fixes-v108.js` / `mobile-fixes.js` の **body-wide MutationObserver** を、製品コードを変更せず監査する。

公開版 `release-manifest.js` は Ver.205 のまま維持する。

## 現行Observer

### stable-fixes-v108.js

`document.body` に対して次を監視している。

- `childList: true`
- `subtree: true`

任意の子要素追加・削除が発生すると `scheduleFixes()` が呼ばれ、requestAnimationFrameで同一フレーム内をまとめた後、`applyFixes()` 全体を再実行する。

`applyFixes()` の責務は次の4つ。

1. `installStyle()`
2. `patchDateInputs()`
3. `applyTodayFilters()`
4. `setVersion()`

このうち動的DOM追従が実際に必要と確認済みなのは少なくとも次の2系統。

- 起動後に追加された native `date` / `datetime-local` へのmin/max等の制約付与
- Today再描画後に追加されたtask/schedule cardへの最終可視性適用

既存の `tests/stable-fixes-audit-v195.spec.mjs` が、動的date入力と後挿入Today cardの両方を実ブラウザで固定している。

### mobile-fixes.js

同じく `document.body` に対して `childList: true, subtree: true` で監視し、任意の子要素追加・削除から `schedulePatch()` → `patchAll()` 全体を再実行する。

`patchAll()` の責務は次の7つ。

1. `installStyle()`
2. `ensureMobileHeader()`
3. `patchMobileBoardTabs()`
4. `syncMobileHeaderTitle()`
5. `syncMobileMenuButton()`
6. `patchVersion()`
7. `bindGlobalClicks()`

状態タブは `.board-column` のラベルと `.task-card` 件数からsignatureを作るため、board内のタスク再描画後に再計算する必要がある。

一方、style/header生成、version、global click bindingは冪等化されているものの、boardと無関係なDOM変更でも同じ `patchAll()` に含まれて再走査される。

## Ver.206監査で追加する安全網

### 1. static contract

`test-harness/foundation-overlap-v200.test.mjs` に、次を固定する。

- stable/mobileの両Observerが現時点では `document.body + childList/subtree` であること
- stableのObserver callbackが `applyFixes()` 全体へ流れること
- mobileのObserver callbackが `patchAll()` 全体へ流れること
- 各full passに含まれる責務を明示し、今後scopeを変更する際に黙って責務を落とさないこと

### 2. 実ブラウザObserver計測

`tests/foundation-observer-audit-v206.spec.mjs` では、ページ起動前にnative MutationObserverを薄くラップし、製品コード自体は変更せず次を計測する。

- `scheduleFixes` と `schedulePatch` がともにBODYを監視していること
- board / Today / dateと無関係な単純DOM追加でも、両Observer callbackが発火すること
- モバイルboard列へtask cardが動的追加された際、mobile Observer経由で状態タブ件数が再計算されること

これにより「body-wide Observerが広すぎる」ことと、「Observer自体を単純削除できない」ことを同時に固定する。

## 監査結果からの判断基準

### 単純削除は不可

stable側には動的date / Today、mobile側にはboard状態タブという実利用上の追従責務があるため、Observerを丸ごと削除するのは危険。

### 次の製品変更候補

優先候補は **mobile側Observerのscope縮小** とする。

理由:

- 動的追従の主要対象がboard表示領域に寄っている
- header生成、version、global click bindingは毎回body mutationで再走査する必要性が低い
- nav操作は既存click handlerを持つため、header title同期を明示イベントへ移す余地がある

候補設計は次の順で検証する。

1. `document.body` ではなく、board差替えにも耐える安定した親領域（例: `.main`）へ監視scopeを限定できるか確認
2. nav click時のheader title/menu同期はObserver依存ではなく明示的に実行
3. `patchMobileBoardTabs()` はboard配下のchildList変化で維持
4. resize/orientationの既存経路は維持

stable側は、動的date入力の生成元を全て棚卸しするまでbody-wide Observerを先に縮小しない。Today専用監視とdate専用ライフサイクルへ分割できるかを別工程で検証する。

## この監査で変更しないもの

- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `release-manifest.js`（公開版はVer.205のまま）
- 状態タブCSS
- 状態タブ横スクロールJavaScript
- 開始日・期限日segmented入力
- Today最終可視性
- native日付制約
- モバイルヘッダー / メニュー
- Firebase書込経路

## 復旧地点

`backup/ver205-before-foundation-observer-audit` = `aa3ed9ae3d31ea2a4566d75c73dec5f8d0690361`
