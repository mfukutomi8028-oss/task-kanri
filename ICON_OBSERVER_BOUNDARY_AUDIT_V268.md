# Ver.268 legacy icon observer 境界監査

## 対象

- `release-manifest.js`
- `brand-v185.js`
- `icon-system-v169.js`

## 目的

初回描画互換のため `release-manifest.js` に残っている legacy icon `MutationObserver` が、`workboard:assets-ready` 後も `documentElement` 全体を `subtree: true` で監視し続ける必要があるかを確認した。

## 実測結果

Regression #614 の Browser 監査では、assets-ready 後に無関係な DOM 変更を発生させたところ、legacy icon observer は以下を記録した。

- observer: 1
- callback: 32
- mutation records: 87
- scope: `documentElement`, `childList: true`, `subtree: true`

記録対象には `#openCount`、`#overdueCount`、`#todayCount`、`#myCount`、`BUTTON`、`STRONG`、`SPAN`、`P` など、legacy icon 補正とは無関係な通常 UI 更新が多数含まれた。

## 現行責務の分離

### release-manifest.js

- 初回表示前から legacy image を current asset へ置換する互換責務を持つ。
- 現在は assets-ready 後も observer を disconnect せず、document 全体を監視し続ける。
- late-added legacy image を generic に補正できる点が、assets-ready 後に残る唯一の独自責務。

### brand-v185.js

- sidebar brand mark
- favicon / shortcut icon / apple-touch-icon
- Notification icon
- pageshow 復帰時の再補正

を current brand asset へ収束させる。

### icon-system-v169.js

- navigation icon
- summary icon

を current semantic asset へ補正する。起動後は最大24回・250ms間隔の有限 retry を行う。

## product runtime の確認

Protocol 監査では、`app.js` が legacy map に登録された旧 navigation / summary asset を現在の runtime で生成していないことを確認した。

Browser 監査では次を確認した。

1. assets-ready 時点で brand / Today / ToDo / Task / Schedule icon は current asset に収束している。
2. legacy icon observer を明示的に disconnect しても、通常の navigation 往復で current icon は維持される。
3. synthetic に late legacy image を追加した場合だけ、現行 observer の generic compatibility が働く。

## 結論

現行 product 経路では、assets-ready 後に document-wide observer を維持する必要性は確認できなかった。

一方、初回 asset 読込完了前の互換補正は first-paint guard の役割として残す価値があるため、observer 自体を即時廃止するより、次工程では以下を優先する。

1. first paint 中は既存 observer を維持する。
2. assets-ready / reveal 直前または直後に最後の `document.querySelectorAll('img')` sweep を実施する。
3. その直後に legacy icon observer を disconnect する。
4. `brand-v185.js` / `icon-system-v169.js` の既存 current asset ownership は変更しない。
5. disconnect 後の navigation・summary・brand・favicon・mobile表示を回帰確認する。

これにより初回互換性を保ちながら、通常運用中の document-wide MutationObserver を除去できる。

## 次工程

**Ver.269製品化候補**: `release-manifest.js` の legacy icon observer を first-paint compatibility に限定し、assets-ready 後に final sweep + disconnect する。

`icon-system-v169.js` の有限250ms pollingについては今回の変更に混ぜず、Ver.269後の実測で独立して監査する。

## 非変更

Ver.268監査では製品runtime、release 256、Firebase保存・同期契約を変更していない。
