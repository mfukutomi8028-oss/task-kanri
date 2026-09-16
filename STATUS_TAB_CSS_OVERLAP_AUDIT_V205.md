# Ver.205 モバイル状態タブCSS重複監査

## 目的

Ver.204でモバイル状態タブの横スクロールJavaScript責務を `mobile-fixes.js` へ一本化した後、`stable-fixes-v108.js` と `mobile-fixes.js` の双方に残る `.work-mobile-status-tabs` / `.work-mobile-status-tab` のCSS責務境界を、製品コードを変更せず監査する。

公開版 `release-manifest.js` は Ver.204 のまま維持する。

## 現行のCSS所有境界

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

`stable-fixes-v108.js` にも同じselectorが残るが、内容は「完全重複」と「stable固有の保護」に分かれている。

#### 重複候補

次の宣言はmobile側にも同値で存在するため、将来の製品変更でmobile単独所有へ移せる候補とする。

- `.work-mobile-status-tabs`
  - `display: flex !important`
  - `gap: 8px !important`
  - `overflow-x: auto !important`
  - `scrollbar-width: none !important`
- `.work-mobile-status-tabs::-webkit-scrollbar`
  - `display: none !important`
- `.work-mobile-status-tab`
  - `flex: 0 0 auto !important`

#### stable固有の保護

次はmobile側に同値の宣言がなく、今回の重複候補から除外する。

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

このため、selectorが重複していることだけを理由にstable側の状態タブCSSブロック全体を削除してはならない。

## Ver.205監査で追加する安全網

### 1. static contract

- stable/mobile双方に上記「重複候補」が現時点では同値で存在すること
- stable固有の保護宣言が存在し、重複候補と区別できること
- Ver.204で確立した横スクロールJavaScriptのmobile単独所有を維持すること

### 2. 430px実ブラウザ契約

実アプリ生成の状態タブを使用し、テスト実行中だけ `#stableFixesV108Style` から重複候補の通常宣言を除外する。その状態で次を確認する。

- mobile側だけで `display: flex` / `gap: 8px` / `overflow-x: auto` / `scrollbar-width: none` が維持されること
- 状態タブ自身の `flex: 0 0 auto` が維持されること
- stable固有の `flex-wrap: nowrap` / `overflow-y: hidden` / `scroll-snap-type: none` / `user-select: none` が残ること
- 状態タブクリックで横方向 `scrollLeft` が更新されること
- ページ全体の `scrollY` が変化しないこと
- activeボタン、`aria-pressed`、active列が正しく切り替わること

WebKit scrollbar疑似要素はstatic contractで重複を固定し、実ブラウザ契約では通常プロパティと操作挙動を検証する。

## この監査で変更しないもの

- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `release-manifest.js`（公開版はVer.204のまま）
- モバイルヘッダー / メニュー
- Today最終可視性
- native日付制約
- body-wide MutationObserver
- Firebase書込経路

## 次工程の判断基準

監査がgreenであれば、次の製品変更工程では **完全重複している宣言だけ** を `stable-fixes-v108.js` から退役し、mobile側へ正本化する。

stable固有の保護宣言はこの工程では退役させない。将来それらも整理する場合は、実機相当のタッチ・スクロール・snap挙動を別途監査してから判断する。

監査が失敗した場合は、CSS cascade / ロード順 / computed style / 操作挙動のどこでstable側重複宣言に依存しているかを特定し、重複削除を見送る。

## 復旧地点

`backup/ver204-before-status-tab-css-audit` = `c6edeed54b14531bbdaee9b55542b0e094ff4610`
