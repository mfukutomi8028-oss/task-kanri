# date / datetime-local 制約責務監査（Ver.208）

## 目的

Ver.207で `stable-fixes-v108.js` のbody-wide MutationObserverを退役し、日付補正は `#taskForm`、Today補正は `#todayView` の限定Observerへ分離した。

次の候補として、現在 `stable-fixes-v108.js` と `date-keyboard-fix-v127.js` の双方に残る日付制約について、単なるコード重複ではなく実際のユーザー入力経路と動的DOM追従を基準に所有境界を監査する。

本工程では製品コードを変更しない。

## 現行責務

### stable-fixes-v108.js

`patchDateInputs()` が全 `input[type="date"], input[type="datetime-local"]` を対象にする。

- date: `min=1900-01-01`, `max=9999-12-31`, `maxlength=10`
- datetime-local: `min=1900-01-01T00:00`, `max=9999-12-31T23:59`
- native sourceの `input/change` で5桁以上の年を先頭4桁へclamp
- 初期 `applyFixes()` で実行
- `#taskForm` child mutationでは `patchDateInputs()` のみ再実行
- nav/filter/user/resize/orientation/pageshow/遅延補正ではfull `applyFixes()` 内で再実行

### date-keyboard-fix-v127.js

全 `input[type="date"], input[type="datetime-local"]` を分割入力UIへ変換する。

- native sourceへstableと同じ1900〜9999 min/maxを設定
- 表示用の年inputは `maxLength=4`
- `isValidDateParts()` で年1900〜9999、実在日を検証
- datetime-localは時00〜23、分00〜59も検証
- native sourceは視覚的に隠し、ユーザー操作は分割入力UIまたはnative pickerを通す
- 初期 `patchAll()` で静的date/datetimeを変換
- 各dialogの `open` 属性だけを監視し、開いた時に `patchAll()` / `syncAll()` を実行

## 現行date入力

静的HTML上で確認する主要入力:

- `#taskDueDate` — date / タスクダイアログ
- `#timelineMoveDueDate` — date / タイムライン移動ダイアログ
- `#scheduleStart` — datetime-local / スケジュールダイアログ
- `#scheduleEnd` — datetime-local / スケジュールダイアログ

動的入力:

- `#taskStartDateV167` — `work-features-v167.js` が既存 `#taskForm` に追加するdate入力

動的開始日は `#taskDialog` 内に存在するため、date-keyboardのdialog-open observerで再 `patchAll()` される経路を持つ。

## 仮説

ユーザーが実際に操作する日付UIについては、`date-keyboard-fix-v127.js` が次を単独で満たせる可能性が高い。

1. 初期date/datetime-localのmin/max
2. 表示年の4桁制限
3. 1900未満・9999超の拒否
4. 存在しない日付の拒否
5. 動的 `#taskStartDateV167` の変換と同一制約

一方、stableにはnative sourceを直接操作された場合の `input/change` clampと、明示イベント/resize/pageshow等で全native sourceを再走査する追加安全網が残る。

したがって、Ver.208監査では「同じmin/maxが書かれている」という理由だけでstable側を削除しない。

## 実ブラウザ監査

`tests/date-constraint-ownership-v208.spec.mjs` では、`stable-fixes-v108.js` のみを空スクリプトへ差し替えて起動し、date-keyboard単独状態を作る。

確認項目:

1. stable styleが存在せず、stable補正が実行されていないこと
2. `#taskDueDate`, `#timelineMoveDueDate`, `#scheduleStart`, `#scheduleEnd` がdate-keyboardにより変換されること
3. native sourceのmin/maxが1900〜9999になること
4. 表示用年inputが4桁であること
5. 1899年・10000相当入力・存在しない日付が保存値にならないこと
6. 9999-12-31が有効な上限として保存できること
7. 動的 `#taskStartDateV167` がタスクダイアログ表示時にdate-keyboardへ取り込まれ、同じ制約を持つこと

## 判断基準

### date-keyboard単独で全ユーザー入力経路がgreen

stableの `patchDateInputs()` は通常のユーザー入力制約としては重複候補になる。

ただし次工程で削除する場合も、native source直接更新に対するstable固有clampが実運用上不要であることを静的に確認し、date-keyboard側へ必要な自己修復契約を追加してから行う。

### どれかが失敗

stableの日付補正は現行機能に必要。削除せず、失敗した経路を責務として文書化する。

## 変更しないもの

- `stable-fixes-v108.js`
- `date-keyboard-fix-v127.js`
- `release-manifest.js`（Ver.207のまま）
- app.js
- Firebase書込経路
- Todayフィルタ
- タスク・スケジュール・予約タスクの保存仕様
