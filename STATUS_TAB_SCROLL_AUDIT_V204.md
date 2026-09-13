# Ver.204 モバイル状態タブ横スクロール責務監査

## 目的

Ver.203でスケジュール7日間ラベルの重複を解消した後、`stable-fixes-v108.js` と `mobile-fixes.js` がともに関与するモバイル状態タブの横スクロールを、製品コードを変更せず監査する。

公開版 `release-manifest.js` は Ver.203 のまま維持する。

## 現行の所有境界

### stable-fixes-v108.js

`patchStatusTabAutoScroll()` が `.work-mobile-status-tab` の `scrollIntoView()` を上書きし、呼び出された場合に親 `.work-mobile-status-tabs` の `scrollLeft` だけを変更する。目的はページ全体の縦スクロールを発生させないこと。

### mobile-fixes.js

`patchMobileBoardTabs()` が実際の状態タブを生成し、タブクリック時に `applyActiveColumn(selectedIndex, true)` を呼ぶ。

`applyActiveColumn()` は active列、activeボタン、`aria-pressed` を更新したうえで、activeボタンの位置から `tabs.scrollLeft` を直接設定する。通常のタブクリック経路では `scrollIntoView()` を呼ばない。

## Ver.204で追加する安全網

1. static contract
   - stableには現時点で `scrollIntoView()` 上書きが残ること
   - mobileの実クリック経路は `tabs.scrollLeft` を直接所有すること
   - mobileの `applyActiveColumn()` は `scrollIntoView()` を呼ばないこと

2. 430px実ブラウザ契約
   - 実アプリ生成の状態タブを使用する
   - stable markerが付いた状態でも、タブクリックが `scrollIntoView()` を呼ばずに成立すること
   - 横方向 `scrollLeft` がmobile側計算で更新されること
   - ページの `scrollY` が変化しないこと
   - activeボタン、`aria-pressed`、active列が正しく切り替わること

## この監査で変更しないもの

- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `release-manifest.js`
- モバイルヘッダー / メニュー
- 状態タブCSS
- Today表示
- native日付制約
- body-wide MutationObserver
- Firebase書込経路

## 次工程の判断基準

上記契約がgreenであれば、実際の状態タブクリック経路はmobile側だけで横スクロールを完結できるため、次の製品変更工程で `stable-fixes-v108.js` の `patchStatusTabAutoScroll()` を退役候補とする。

直接 `button.scrollIntoView()` を呼ぶ別経路が存在する、または縦位置維持がmobile単独で成立しない場合は退役せず、呼出元を特定する。

## 復旧地点

`backup/ver203-before-status-tab-scroll-audit` = `fe7a2b284fdd1abe2cd0701ac571dc7a54522ef8`
