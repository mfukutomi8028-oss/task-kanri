# stable-fixes-v108.js Observer scope監査（Ver.207）

## 目的

Ver.206で `mobile-fixes.js` の `document.body` 全体MutationObserverを `#boardView` 限定へ縮小した。
次工程では `stable-fixes-v108.js` に残るbody-wide Observerを、現行機能を壊さず責務別に限定できるか確認する。

## 現行Observerが再実行する責務

`document.body` の任意child-list mutationから `scheduleFixes()` → `applyFixes()` が走り、次をまとめて再実行する。

- `installStyle()`
- `patchDateInputs()`
- `applyTodayFilters()`
- `setVersion()`

`installStyle()` はidempotent、`setVersion()` はmanifest由来の表示補正であり、DOM child-list mutationごとに実行する必要はない。
監視が必要な候補は、動的date入力とToday再描画への追従である。

## 動的date入力

現行で確認できる追加date入力は `work-features-v167.js` の `#taskStartDateV167`。

- 既存 `#taskForm` を取得
- 既存 `#taskDueDate` のlabel手前へ開始日labelを挿入
- `<input id="taskStartDateV167" type="date">` を追加

したがって、この追加Mutationは `#taskForm` subtree内で発生する。
また `date-keyboard-fix-v127.js` はdialogのopen属性だけを監視し、dialogが開いた時に `patchAll()` を実行してdate/datetime-localへ1900〜9999制約を設定するため、開始日には別の限定安全網も存在する。

## Today再描画

`app.js` は固定要素 `#todayView` の `innerHTML` を更新してTodayを再描画する。
担当者・状態の最終可視性補正はこの再描画後に必要だが、sidebar・dialog・memo・board等の無関係DOM変更では不要。

## Ver.207監査で固定すること

1. stable Observerは現在BODY全体を監視している。
2. `#taskStartDateV167` の追加Mutationは `#taskForm` subtree内で観測できる。
3. Today再描画のchild-list Mutationは `#todayView` 内で観測できる。
4. 無関係なBODY直下追加でもstable Observerが現在発火することはVer.206安全網で既に固定済み。

## green後の製品変更候補

単一のbody-wide Observerを次の2責務へ分離する。

- `#taskForm` child-list/subtree → date補正だけ
- `#todayView` child-list/subtree → Today最終可視性だけ

初期起動・resize・orientationchange・pageshow・既存の明示click/change補正は一度に整理せず維持する。
これにより、無関係DOM変更から `installStyle()` / `setVersion()` / full `applyFixes()` が起動する経路だけを先に除去する。

## 今回変更しないもの

- `stable-fixes-v108.js` 製品コード
- date min/max仕様
- Todayの保留・確認待ち・mine/group判定
- `date-keyboard-fix-v127.js`
- `mobile-fixes.js`
- Firebase書込経路
- release version（監査のみのためVer.206のまま）

## 復旧地点

`backup/ver206-mobile-observer-scope` = `3d215680aa56eec07239124c6cd55c303a2aee06`
