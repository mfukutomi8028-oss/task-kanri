# 日付キーボード責務境界監査（Ver.230）

## 基準

- 正式リリース: Ver.229
- main: `c97764fd76ca4608eb4271983c9b30112edca600`
- 復旧地点: `backup/ver229-after-list-sort-boundary`
- 本監査では製品コード・`release-manifest.js`・Firebase書込経路を変更しない。

## 目的

`date-keyboard-fix-v127.js` が、現在の `app.js` / `work-features-v167.js` と重複する暫定補正なのか、現在も独立したユーザー機能を所有しているのかを判定する。

Ver.209では `stable-fixes-v108.js` との日付制約重複を監査し、stable側の制約処理を退役できることを確認した。その後stableはactive runtimeから退役したため、Ver.230では `date-keyboard-fix-v127.js` 自体の現在の責務を監査する。

## 現在確認できる所有境界

### app.js

- `#taskDueDate` のnative値をタスク保存データの `dueDate` として読む。
- タスク編集・予定からのタスク作成・タイムライン操作時にnative期限日へ値を書き戻す。
- `#scheduleStart` / `#scheduleEnd` のnative `datetime-local` 値を予定保存へ使用する。
- `#scheduleStart` の input/change を使って終了時刻を補正する。
- 日付分割UIのDOM・クラス・入力分解処理は所有しない。

### work-features-v167.js

- `#taskStartDateV167` というnative `type=date` 入力自体を生成する。
- 開始日と期限日の前後関係、予約タスク保存処理を所有する。
- 日付分割UIは生成しない。

### date-keyboard-fix-v127.js

- `date` / `datetime-local` native sourceを年・月・日・時・分の分割入力UIへ変換する。
- 年4桁、1900〜9999、実在日、00:00〜23:59を検証する。
- 分割入力からcanonical native値へ反映し、native `input` / `change` を発火する。
- app等がnative sourceを書き換えた場合は `change` を受けて分割表示へ同期する。
- native pickerを分割UIから呼び出す。
- dialogの `open` 属性だけを監視し、動的に追加された開始日をdialog表示時に取り込む。
- 分割入力の表示CSSをJavaScript内から注入する。

## Browser差分監査

`tests/date-keyboard-boundary-v230.spec.mjs` で同一のVer.229製品を2条件で起動する。

### sidecar無効

`date-keyboard-fix-v127.js` のHTTP要求だけを空スクリプトへ置換する。

確認すること:

1. 日付分割style / wrapperが生成されない。
2. `#taskDueDate` はapp所有のnative dateとして残る。
3. `#taskStartDateV167` はwork-featuresによってnative dateとして生成される。
4. native期限日を入力してタスク保存すると、その値が既存のapp保存経路で保持される。

### sidecar有効

確認すること:

1. 期限日と動的開始日の両方が分割UIへ変換される。
2. 分割入力がnative sourceへcanonical値を反映する。
3. native sourceの変更が分割UIへ同期される。
4. dialogを閉じて再表示しても動的開始日は二重wrapperにならない。

## 判断基準

### 無効時も保存機能は成立し、有効時だけ分割UIが成立

`date-keyboard-fix-v127.js` はappの保存ロジックと重複する補正ではなく、現在も独立した入力UXを所有している。その場合、機能を維持したままの単純退役は不可と判定する。

次の整理候補は、次の順で検討する。

1. version番号由来の暫定ファイル名を責務名へ変更する。
2. JavaScript内へ埋め込まれた表示CSSを専用CSSへ分離する。
3. native値⇔分割UIの橋渡し・validation・dialog-open lifecycleを単一JS責務として残す。
4. `app.js` へ大型UI実装を吸収して肥大化させない。

### sidecar無効時に保存処理そのものが壊れる

依存境界を追加調査し、製品コードの整理は保留する。

## 変更しないもの

- `date-keyboard-fix-v127.js`
- `app.js`
- `work-features-v167.js`
- `release-manifest.js`
- `patch-responsibilities.json`
- Firebase書込処理
- タスク・予定・予約タスクの保存仕様
