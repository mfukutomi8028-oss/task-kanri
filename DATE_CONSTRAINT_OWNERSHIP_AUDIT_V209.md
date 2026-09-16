# date / datetime-local 制約責務監査（Ver.209）

## 基準

- 正式リリース: Ver.208
- main: `0843e8832f6873163f3622f403a4c5127c6717bd`
- 復旧地点: `backup/ver208-user-ux-release`
- 本監査では製品コードを変更せず、`release-manifest.js` もVer.208のままとする。

## 目的

`stable-fixes-v108.js` と `date-keyboard-fix-v127.js` の双方に残るdate / datetime-local制約について、単なるコード重複ではなく、実際のユーザー入力・動的開始日・dialog再表示を基準に所有境界を確認する。

旧PR #48ではstableを無効化した監査自体は開始できたが、閉じたdialog内の分割入力をPlaywrightで直接fillしてtimeoutしたため、製品不具合ではなく監査手順の問題でfailureとなった。Ver.209監査では対象dialogを表示してから実入力を行う。

## 現行責務

### stable-fixes-v108.js

`patchDateInputs()` が全 `input[type="date"], input[type="datetime-local"]` を走査し、以下を付与する。

- date: `min=1900-01-01`, `max=9999-12-31`, `maxlength=10`
- datetime-local: `min=1900-01-01T00:00`, `max=9999-12-31T23:59`
- native sourceの `input/change` 時に5桁以上の年を先頭4桁へclamp
- 初期/full passに加え、`#taskForm` child mutationで再実行

### date-keyboard-fix-v127.js

同じnative inputを分割入力UIへ変換する。

- native sourceへ同じ1900〜9999 min/maxを設定
- 表示用年inputは `maxLength=4`
- 実在日、年1900〜9999、時00〜23、分00〜59を検証
- native sourceは視覚的に隠し、通常ユーザー操作は分割入力UIまたはpickerを通る
- 初期 `patchAll()` で静的inputを変換
- dialogの`open`属性変化で `patchAll()` / `syncAll()` を再実行

## 対象

静的入力:

- `#taskDueDate`
- `#timelineMoveDueDate`
- `#scheduleStart`
- `#scheduleEnd`

動的入力:

- `#taskStartDateV167`

## 実ブラウザ監査

`tests/date-constraint-ownership-v209.spec.mjs` では `stable-fixes-v108.js` だけを空スクリプトへ差し替えて起動し、date-keyboard単独状態を作る。

確認項目:

1. stable補正が実行されていないこと
2. 静的date/datetime sourceがdate-keyboardに変換されること
3. native sourceのmin/maxが1900〜9999で維持されること
4. 表示用年inputが4桁であること
5. タスク追加dialogを開いた実入力で1899年、10000相当、存在しない日付を拒否すること
6. 9999-12-31を受け入れること
7. スケジュールdialogを開いた実入力で9999-12-31T23:59を受け入れ、10000相当と24:00を拒否すること
8. タイムライン移動dialogを表示した状態で期限日入力が機能すること
9. 動的開始日がタスクdialog open時に取り込まれ、dialog再表示後も単一wrapper・同一制約を維持すること

## 判断基準

### 全監査green

通常ユーザー入力経路に関してはdate-keyboardが単独で制約を所有できるため、stableの `patchDateInputs()` は退役候補とする。

ただし製品変更工程では、stable固有のnative source直接更新clampが本番経路で必要かを静的確認し、必要ならdate-keyboard側へ自己修復契約を追加してから退役する。監査と製品退役を同一コミットでは行わない。

### 失敗あり

失敗した経路をstable固有責務として残し、`patchDateInputs()` は退役しない。

## 変更しないもの

- `stable-fixes-v108.js`
- `date-keyboard-fix-v127.js`
- `release-manifest.js`
- `app.js`
- Firebase書込経路
- Todayフィルタ
- タスク・スケジュール・予約タスク保存仕様
