# Ver.314 日付分割入力 dialog 監視責務監査

## 基準

- Base: Ver.313
- Base main SHA: `ca1091387c1b4874e989635641390c3d54d1cf65`
- release / baselineRelease: `277`
- 製品 `date-segment-controls-v230.js` は変更しない。

## 現行責務

`date-segment-controls-v230.js` は起動時に全 `dialog` へ個別の `MutationObserver` を作成し、`open` 属性を監視する。dialog が開くたびに callback 内から `patchAll()` と `syncAll()` を呼び、document 全体の date / datetime-local input と date-segment wrapper を再走査する。

この処理は日付分割入力の値同期を守る一方、日付入力を持たない dialog にも observer を常駐させ、1つの dialog open に対して document 全体を2系統走査する。

## Ver.314 audit candidate

製品コードには触れず、Playwright の route-local candidate で `observeDialogs()` だけを次の方式へ差し替えて比較する。

- dialog ごとの `MutationObserver` を作成しない。
- document に `toggle` capture listener を1本だけ登録する。
- event target が開いた `HTMLDialogElement` の場合だけ処理する。
- `patchAll()` / `syncAll()` を呼ばず、開いた dialog 配下だけ `querySelectorAll()` して build / sync する。
- 起動時の `patchAll()`、`setTimeout(syncAll, 0)`、pageshow recovery、各 field handler、native source の input/change contract は維持する。

## 実ブラウザで確認すること

1. 現行製品は dialog 数に応じて `open` attribute observer を登録し、date dialog open で document-level date scan / wrapper scan が発生する。
2. candidate は date dialog observer を0本にし、toggle listenerを1本だけ登録する。
3. 閉じている間に native date / datetime-local source 値が変わっても、dialog open で segment fieldへ同値同期する。
4. candidate の dialog open callbackでは document-level date/wrapper scanを発生させず、対象dialog内だけを走査する。
5. 複数回 open/close しても listener は1本のまま、同期が重複・欠落しない。
6. 日付入力を持たない dialog のopenでもdocument全体scanを起こさない。
7. release / baselineRelease 277、Firebase・保存正本・workflow・notification・業務データ書込経路は変更しない。

## 製品化ゲート

PR Regression の Protocol / Browser / Firebase Emulator がすべて green で、上記同等性と局所化が成立した場合、次版で `date-segment-controls-v230.js` の dialog open recovery だけを製品化候補とする。
