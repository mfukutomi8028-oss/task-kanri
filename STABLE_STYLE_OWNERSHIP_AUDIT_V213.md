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

## 監査仮説

- Todayは `applyTodayFilters()` が対象要素の `hidden` propertyを直接更新しているため、`data-v108-hidden`用CSSがなくても非表示意味論を維持できる可能性が高い。
- boardの `column-head` と `task-list` は現在の `mobile-fixes.js` が同等の主要レイアウトを所有しており、stable側board保護CSSを外しても縦伸長・表示が成立する可能性が高い。
- 状態タブの保護宣言は通常レイアウトではなく操作安定性の安全網であるため、削除ではなく `mobile-fixes.js` の状態タブCSSへ所有権を移す案を第一候補とする。

## 製品コード無変更の監査方法

`tests/stable-style-ownership-audit-v213.spec.mjs` ではPlaywright配信時だけ `stable-fixes-v108.js` の初期 `installStyle()` 呼び出しを抑止する。

その状態で以下を確認する。

### Today

- `stableFixesV108Style` が存在しない
- 保留タスクへ `data-v108-hidden` が付く
- `hidden` propertyだけで実際に非表示になる
- 通常タスクとgroup担当は表示を維持する

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
- `release-manifest.js`（Ver.212）
- Todayの保留 / 確認待ち / mine / group意味論
- date-keyboard / schedule / version-display-lock
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction
- dynamic CSS / JS inventoryとロード順

## green後の製品候補

監査がgreenの場合、Ver.213製品変更は次の最小差分を候補とする。

1. 状態タブのstable固有保護宣言を `mobile-fixes.js` の既存状態タブCSSへ移す
2. stable側board保護CSSを退役
3. `#todayView [data-v108-hidden]` 補助CSSを退役し、`hidden` propertyを正本とする
4. `installStyle()` と初期 `applyFixes()` を退役し、stableの初期処理を `applyTodayFilters()` のみにする
5. static contract / Browser回帰 / 責務台帳を新境界へ更新する

監査が失敗した場合は、失敗した宣言群だけを残し、`installStyle()` 全体の退役は行わない。