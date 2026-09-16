# Ver.205 モバイル状態タブCSS重複監査・整理結果

## 目的

Ver.204でモバイル状態タブの横スクロールJavaScript責務を `mobile-fixes.js` へ一本化した後、`stable-fixes-v108.js` と `mobile-fixes.js` の双方に残っていた `.work-mobile-status-tabs` / `.work-mobile-status-tab` のCSS責務境界を監査し、完全重複だけを安全に退役する。

## 監査時点のCSS所有境界

### mobile-fixes.js

`mobile-fixes.js` は実際のモバイル状態タブを生成し、次のレイアウト・見た目を所有している。

- `.work-mobile-status-tabs`
  - sticky位置、z-index
  - `display: flex`
  - `gap: 8px`
  - `overflow-x: auto`
  - padding / margin
  - 背景、blur
  - `scrollbar-width: none`
- `.work-mobile-status-tabs::-webkit-scrollbar`
  - `display: none`
- `.work-mobile-status-tab`
  - `flex: 0 0 auto`
  - border / radius / padding / background / color / typography / shadow
  - active状態の見た目

### stable-fixes-v108.js

監査時点では同じselectorに「完全重複」と「stable固有の保護」が混在していた。

#### Ver.205で退役する完全重複

- `.work-mobile-status-tabs`
  - `display: flex !important`
  - `gap: 8px !important`
  - `overflow-x: auto !important`
  - `scrollbar-width: none !important`
- `.work-mobile-status-tabs::-webkit-scrollbar`
  - `display: none !important`
- `.work-mobile-status-tab`
  - `flex: 0 0 auto !important`

#### 維持するstable固有の保護

- `.work-mobile-status-tabs`
  - `flex-wrap: nowrap !important`
  - `width: 100% !important`
  - `max-width: 100% !important`
  - `overflow-y: hidden !important`
  - `touch-action: auto !important`
  - `-webkit-overflow-scrolling: touch !important`
  - `overscroll-behavior: auto !important`
  - `scroll-behavior: auto !important`
  - `scroll-snap-type: none !important`
- `.work-mobile-status-tab`
  - `touch-action: auto !important`
  - `scroll-snap-align: none !important`
  - `user-select: none !important`
  - `-webkit-user-select: none !important`

selector自体はstableにも残すが、役割は通常レイアウトではなく安全保護だけに限定する。

## 事前監査で確認した安全網

### 1. static contract

監査版ではstable/mobile双方の完全重複を明示的に固定し、stable固有保護と区別した。

製品変更後の契約では次を確認する。

- `display / gap / overflow-x / scrollbar-width` はmobileに存在し、stableには存在しない
- WebKit scrollbar非表示はmobileだけが所有する
- `flex: 0 0 auto` はmobileだけが所有する
- stable固有保護は維持される
- Ver.204で確立した横スクロールJavaScriptのmobile単独所有を維持する

### 2. 430px実ブラウザ契約

事前監査ではテスト実行時だけstableの完全重複を除外し、次が成立することを確認済み。

- mobile側だけで `display: flex` / `gap: 8px` / `overflow-x: auto` / `scrollbar-width: none` が維持される
- 状態タブ自身の `flex: 0 0 auto` が維持される
- stable固有の `flex-wrap: nowrap` / `overflow-y: hidden` / `scroll-snap-type: none` / `user-select: none` が残る
- 状態タブクリックで横方向 `scrollLeft` が更新される
- ページ全体の `scrollY` が変化しない
- activeボタン、`aria-pressed`、active列が正しく切り替わる

Ver.205製品変更ではこの監査状態を実コードへ反映する。

## Ver.205で変更するもの

- `stable-fixes-v108.js` から完全重複6項目を退役
- 状態タブの通常レイアウト・見た目を `mobile-fixes.js` へ正本化
- `release-manifest.js` をVer.205へ更新
- static contractを「重複存在」から「mobile単独所有」へ更新
- 責務台帳と回帰テスト基準をVer.205へ更新

## Ver.205で変更しないもの

- stable固有の状態タブ保護CSS
- `mobile-fixes.js` の状態タブ製品実装
- モバイルヘッダー / メニュー
- Today最終可視性
- native日付制約
- 開始日・期限日のsegmented入力
- body-wide MutationObserver
- Firebase書込経路

## 判断

事前監査がgreenであり、完全重複を除外した状態でも表示・横スクロール・active切替・縦位置維持が成立したため、Ver.205では完全重複だけを退役する。

stable固有の保護宣言はこの工程では退役させない。将来整理する場合は、実機相当のタッチ・スクロール・snap挙動を別途監査してから判断する。

## 復旧地点

- 監査前: `backup/ver204-before-status-tab-css-audit` = `c6edeed54b14531bbdaee9b55542b0e094ff4610`
- 製品変更前（開始日修正式リリース後）: `backup/ver205-before-status-tab-css-retirement` = `81c91f2dbe71f488051a38a68d6990be6ea3b321`

## 次工程

Ver.205がgreenになった後は、stable/mobileに残るbody-wide MutationObserverの責務と発火頻度を監査する。状態タブのstable固有保護、モバイルヘッダー、メニューは同時に変更しない。
