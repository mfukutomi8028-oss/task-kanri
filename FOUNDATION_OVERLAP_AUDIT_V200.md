# 基盤近接責務の再監査と日付正本整理（Ver.200）

## 目的

Ver.199までに基本状態5種の削除保護を `app.js` 単独所有へ整理したため、`stable-fixes-v108.js`・`mobile-fixes.js`・`date-keyboard-fix-v127.js` に残る **Today表示と日付入力の近接責務** をVer.200監査工程で固定した。

監査工程では製品JavaScriptを変更せず、static contract 67件・通常ブラウザ66件・Firebase Emulator 19件をgreenにした。その安全網を前提に、Ver.200の製品変更では **native date / datetime-local の共通制約を `stable-fixes-v108.js` 単独所有へ整理**する。

## Ver.200監査で確認した境界

### 日付入力

#### `stable-fixes-v108.js`

- `date` / `datetime-local` に1900〜9999のmin/maxを付与
- `date` に `maxlength=10` を付与
- 年部分が4桁を超えた場合のclampを持つ
- `__stableDateV108` を付与し、input/change listenerの二重登録を防止
- body全体のMutationObserverにより、起動後に追加されたnative dateにも追従

#### `mobile-fixes.js`（Ver.199まで）

- stableと同じ1900〜9999のmin/maxを付与
- `date` に `maxlength=10` を付与
- 年部分のclampを持つ
- `__workBoardDateBoundV101` でlistenerの二重登録を防止
- mobile scriptでありながら `patchDateInputs()` 自体は `isMobile()` で限定されていなかった

#### `date-keyboard-fix-v127.js`

- 起動時に存在する `date` / `datetime-local` を segmented UI へ変換
- native sourceにも1900〜9999のmin/maxを付与
- 年/月/日および時/分の妥当性検証を所有
- `data-date-segment-v127="true"` で二重変換を防止
- dialogのopen状態を監視して既存segmented controlを同期する
- document.body全体を監視して新規native dateを自動変換する責務は持たない

### Today表示

`stable-fixes-v108.js` は `保留`・空き時間の`確認待ち`に加えてmine/group担当者判定を所有する。`mobile-fixes.js` は状態除外だけを持つため、Todayは完全重複ではない。

この非対称性はVer.200では変更しない。

## Ver.200製品変更

### 1. native date制約の正本をstableへ統一

`mobile-fixes.js` から次を削除する。

- `DATE_MIN` / `DATE_MAX`
- `DATETIME_MIN` / `DATETIME_MAX`
- `clampDateValue()`
- `patchDateInputs()`
- `patchAll()` からの日付補正呼び出し
- `__workBoardDateBoundV101` の付与

これにより、PC・モバイルともにnative date制約は `stable-fixes-v108.js` の同一経路だけを通る。

### 2. segmented UIは変更しない

`date-keyboard-fix-v127.js` は変更しない。起動時から存在するフォーム日付は従来どおりsegmented UIになり、起動後に追加されたnative dateはstableの制約だけを受けてnativeのまま残る。

### 3. Today・モバイルUIは変更しない

`mobile-fixes.js` のToday状態除外、モバイルヘッダー、状態タブ、レイアウト、body-wide MutationObserver等はそのまま維持する。

## Ver.200安全網

### 静的契約 67件

日付契約を次の正本へ更新する。

- stableがnative date/datetime-localのmin/max・4桁年補正を所有
- mobileには日付定数、日付clamp、`patchDateInputs()`、旧日付markerが存在しない
- date-keyboardはsegmented sourceのmin/maxと妥当性検証を維持
- 基盤scriptのロード順は変更しない

### 通常ブラウザ 66件

430px幅で次を確認する。

- 起動時から存在するタスク期限はsegmented UIが1個だけ作られる
- sourceに `__stableDateV108` が付く
- sourceに旧mobile marker `__workBoardDateBoundV101` は付かない
- 起動後追加native date/datetime-localにもstableのmin/maxが付く
- 動的native dateにも旧mobile markerは付かない
- 起動後追加native dateはsegmented UIへ自動変換されない
- Todayのstable/mobileマーカー境界は従来どおり

### Firebase Emulator 19件

書込経路は変更しないが、全19件を継続実行する。

## 変更しないもの

- `date-keyboard-fix-v127.js`
- Todayの状態除外・mine/group判定
- `mobile-fixes.js` の日付以外の責務
- `stable-fixes-v108.js` の日付ロジック本体
- dynamic CSS 21本 / dynamic JS 34本の本数とロード順
- Firebase書込経路

## 復旧地点

Ver.200製品変更前の確定main:

- `backup/ver199-with-foundation-overlap-audit`: `d040061607947974a69309ce850c4885ad8b9e4a`

## 次の候補

Todayは状態除外がstable/mobileで重複する一方、mine/group判定はstable固有で、最終 `hidden` 状態も複数処理の影響を受ける。次に触る場合は、まず **最終表示結果の専用ブラウザ契約** を追加してから、状態除外の正本を1系統へ移す。

body-wide MutationObserverの削減は、Today等の残存責務を分離した後に行う。
