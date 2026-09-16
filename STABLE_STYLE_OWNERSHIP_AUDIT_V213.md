# Ver.213 stable style ownership audit

## 目的

Ver.212で `stable-fixes-v108.js` の起動時責務は `installStyle()` と `applyTodayFilters()` の2つまで縮小された。
次工程では、`installStyle()` がJavaScriptから動的にCSSを注入し続ける必要があるかを、製品コードを変更せず実ブラウザで監査する。

基準main: `2784c0bdda190d6e44193e4d0dc4a5711e0160aa`（Ver.212）
復旧地点: `backup/ver212-before-stable-style-audit`

## 現在のCSS責務

`stable-fixes-v108.js` の `installStyle()` は次の3群を持つ。

1. モバイル状態タブの保護CSS
   - row: `flex-wrap / width / max-width / overflow-y / touch-action / -webkit-overflow-scrolling / overscroll-behavior / scroll-behavior / scroll-snap-type`
   - tab: `touch-action / scroll-snap-align / user-select / -webkit-user-select`
2. モバイルboardの保護CSS
   - column headの `position / top / inset`
   - board / column / task-listの `height / max-height / overflow-y`
3. Today非表示の補助CSS
   - `#todayView [data-v108-hidden] { display:none !important; }`

Ver.205ですでに状態タブの通常表示宣言（`display / gap / overflow-x / scrollbar / flex`）は `mobile-fixes.js` へ一本化済みであり、stable側には当時「保護」として残した宣言だけが残っている。

## 監査で判明したこと

### 1回目: Regression #219

stableのstyle注入を完全に外した状態で、`applyTodayFilters()` が保留カードへ `data-v108-hidden` を付けても、既存author CSSに表示を上書きされ、カードが実際には表示されたままになることを確認した。

したがって `#todayView [data-v108-hidden] { display:none !important; }` は単純削除できない。

一方、状態タブ保護をmobile所有へ移した想定のモバイル/board監査は成功した。

### 2回目: Regression #221

native `hidden` propertyを正本として扱えるかを追加確認したところ、検証時点では `data-v108-hidden` が残っている一方で `element.hidden` は別の描画経路により `false` へ戻されていた。

この結果から、Today最終可視性については次の境界を正本とする。

- stableの `applyTodayFilters()` が `data-v108-hidden` を意味論上の最終マーカーとして付与・解除する
- native `hidden` propertyは補助的に更新されるが、他の描画経路から書き換えられるため永続的な正本とはみなさない
- `#todayView [data-v108-hidden] { display:none !important; }` がauthor CSS競合に対する最終表示安全網として必要

したがって論点は「stableのCSSを全部なくせるか」ではなく、「必要なCSSを適切な所有先へ移し、stableのJavaScriptによるstyle注入だけを退役できるか」である。

## 修正後の監査仮説

- Todayの `data-v108-hidden` 強制非表示ルールは必要。ただしstable JSから動的注入する必要はなく、常時読み込まれる `style.css` 等の静的CSSへ移管できる可能性が高い。
- boardの `column-head` と `task-list` は現在の `mobile-fixes.js` が同等の主要レイアウトを所有しており、stable側board保護CSSを外しても縦伸長・表示が成立する。
- 状態タブの保護宣言は通常レイアウトではなく操作安定性の安全網であるため、削除ではなく `mobile-fixes.js` の既存状態タブCSSへ所有権を移す。
- 上記の必要CSSを正しい所有先へ移せれば、`stable-fixes-v108.js` の `installStyle()` 自体は退役できる。

## 製品コード無変更の監査方法

`tests/stable-style-ownership-audit-v213.spec.mjs` ではPlaywright配信時だけ `stable-fixes-v108.js` の初期 `installStyle()` 呼び出しを抑止する。

### Today

- `stableFixesV108Style` が存在しない
- 保留タスクへ durable marker である `data-v108-hidden` が付くことを確認
- CSS移管前は、既存author CSSにより保留カードが表示されてしまうことをnegative proofとして固定
- テスト内で `#todayView [data-v108-hidden] { display:none !important; }` をstable外の所有者相当として追加すると、保留だけが非表示へ戻ることを確認
- 通常タスクとgroup担当は表示を維持
- native `element.hidden` の最終値には依存しない

### モバイル / board

テスト内で、将来の所有先候補である `mobile-fixes.js` 相当の状態タブ保護宣言だけを一時付与する。
これは製品変更ではなく、「保護をstableのJS注入からmobile所有へ移した場合」の境界試験である。

- 状態タブのflex・横overflow・nowrap・snap・選択抑止を維持
- 状態タブクリックで `scrollLeft` が更新される
- ページ縦位置を維持
- active / `aria-pressed` / active列を維持
- column headはstaticを維持
- task-listは固定高や内部縦スクロールへ戻らず、内容に応じて伸長する

## 今回変更しないもの

- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `style.css`
- `release-manifest.js`（Ver.212）
- Todayの保留 / 確認待ち / mine / group意味論
- date-keyboard / schedule / version-display-lock
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction
- dynamic CSS / JS inventoryとロード順

## green後の製品候補

監査がgreenの場合、Ver.213製品変更は次の最小差分を候補とする。

1. 状態タブのstable固有保護宣言を `mobile-fixes.js` の既存状態タブCSSへ移す
2. `#todayView [data-v108-hidden] { display:none !important; }` を常時読み込まれる `style.css` へ移す
3. stable側board保護CSSを退役
4. `installStyle()` を退役し、stableの初期処理を `applyTodayFilters()` のみにする
5. stableは引き続き `data-v108-hidden` の付与・解除をToday最終意味論として所有する
6. static contract / Browser回帰 / 責務台帳を新境界へ更新する

この形なら、Todayの意味論とモバイル操作保護を失わずに、stableのJavaScriptによるpresentation注入を撤去できる。