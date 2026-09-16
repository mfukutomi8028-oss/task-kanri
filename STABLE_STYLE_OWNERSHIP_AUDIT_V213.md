# Ver.213 stable style ownership audit

## 目的

Ver.212で `stable-fixes-v108.js` の起動時責務は `installStyle()` と `applyTodayFilters()` の2つまで縮小された。Ver.213では、`installStyle()` がJavaScriptから動的にCSSを注入し続ける必要があるかを、製品コード無変更の実ブラウザ監査で確認した。

基準main: `2784c0bdda190d6e44193e4d0dc4a5711e0160aa`（Ver.212）
監査main: `1954279ad1be0b663ec807b0942561b100b9efaa`
復旧地点: `backup/ver212-with-stable-style-audit`

## 監査対象

stableの `installStyle()` は次の3群を持っていた。

1. モバイル状態タブの保護CSS
   - row: `flex-wrap / width / max-width / overflow-y / touch-action / -webkit-overflow-scrolling / overscroll-behavior / scroll-behavior / scroll-snap-type`
   - tab: `touch-action / scroll-snap-align / user-select / -webkit-user-select`
2. モバイルboardの保護CSS
   - column headの `position / top / inset`
   - board / column / task-listの `height / max-height / overflow-y`
3. Today非表示の補助CSS
   - `#todayView [data-v108-hidden] { display:none !important; }`

## 監査で判明したこと

### Today最終非表示CSSは必要

stableのstyle注入を完全に外した状態では、`applyTodayFilters()` が保留カードへ `data-v108-hidden` を付けても、既存author CSSに表示を上書きされ、カードが実際には表示されたままになることを確認した。

native `hidden` propertyも別の描画経路から書き換えられることがあるため、永続的な正本とはみなさない。

したがってToday最終可視性は次の境界とする。

- stableの `applyTodayFilters()` が `data-v108-hidden` を意味論上の最終マーカーとして付与・解除する。
- `#todayView [data-v108-hidden] { display:none !important; }` がauthor CSS競合に対する最終表示安全網を担う。

### 状態タブ保護はmobileへ移管可能

状態タブ保護宣言をmobile所有へ移した想定でも次を維持できた。

- flex / 横overflow / nowrap / snap / 選択抑止。
- タブクリックによる `scrollLeft` 更新。
- ページ縦位置維持。
- active / `aria-pressed` / active列。

### stable側board保護CSSは不要

stable側board保護CSSがなくても、既存mobile側ルールだけで次を維持できた。

- column headはstatic。
- task-listは固定高や内部縦スクロールへ戻らない。
- 内容に応じてboardが縦へ伸長する。

## 監査結果

最新監査head `9a45855858e78f5b14dede89fd7363480c54d9e6` のRegression #223はProtocol / Browser / Firebase Emulatorがすべてsuccess。監査PR #58をmainへマージし、監査main `1954279ad1be0b663ec807b0942561b100b9efaa` でもRegression #224・Pages #338がsuccessとなった。

## Ver.213製品反映方針

1. 状態タブ保護宣言を `mobile-fixes.js` の既存状態タブCSSへ統合する。
2. Todayの強制非表示ルールは巨大なlegacy `style.css` ではなく、既にToday/Schedule presentationを所有する `ui-core-density-v188.css` へ移管する。
3. stable側board保護CSSを退役する。
4. stableの `installStyle()` と `applyFixes()` wrapperを退役し、初期処理を `applyTodayFilters()` のみにする。
5. stableは引き続き `data-v108-hidden` の付与・解除をToday最終意味論として所有する。
6. dynamic CSS 21本 / dynamic JS 34本とロード順は変更しない。
7. 保存処理・Firebase書込・revision・Transactionは変更しない。

この境界なら、Todayの意味論とモバイル操作保護を失わず、stableのJavaScriptによるpresentation注入を撤去できる。