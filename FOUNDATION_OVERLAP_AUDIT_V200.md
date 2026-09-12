# 基盤近接責務の再監査（Ver.200監査工程）

## 目的

Ver.199までに基本状態5種の削除保護を `app.js` 単独所有へ整理したため、次に `stable-fixes-v108.js`・`mobile-fixes.js`・`date-keyboard-fix-v127.js` に残る **Today表示と日付入力の近接責務** を再監査する。

この工程では製品JavaScriptを変更しない。先に現在の所有境界を静的契約と実ブラウザ回帰で固定し、次の製品移管を1責務だけに限定できる状態を作る。

`release-manifest.js` は Ver.199 のままとし、Ver.200は監査・安全網工程として扱う。

## 日付入力の現状

### `stable-fixes-v108.js`

- `date` / `datetime-local` に1900〜9999のmin/maxを付与
- `date` に `maxlength=10` を付与
- 年部分が4桁を超えた場合のclampを持つ
- `__stableDateV108` を付与し、input/change listenerの二重登録を防止
- body全体のMutationObserverにより、起動後に追加されたnative dateにも追従

### `mobile-fixes.js`

- stableと同じ1900〜9999のmin/maxを付与
- `date` に `maxlength=10` を付与
- 日付補正を `patchAll()` の一部として実行
- body全体のMutationObserverにより、起動後のDOM追加にも追従

### `date-keyboard-fix-v127.js`

- 起動時に存在する `date` / `datetime-local` を segmented UI へ変換
- native sourceにも1900〜9999のmin/maxを付与
- 年/月/日および時/分の妥当性検証を所有
- `data-date-segment-v127="true"` で二重変換を防止
- dialogのopen状態を監視して既存segmented controlを同期する
- **document.body全体を監視して新規native dateを自動変換する責務は持たない**

したがって、起動後に任意追加されたnative dateはstable/mobileの制約補正対象になる一方、date-keyboardによるsegmented UIへは自動変換されない。これは現在の実装境界として安全網で固定する。

## Today表示の現状

### `stable-fixes-v108.js`

次をまとめて判断し、`data-v108-hidden` を付ける。

- `保留` をTodayから除外
- 「空き時間」の `確認待ち` を除外
- 「自分の担当」フィルタ時、現在ユーザー以外の担当を除外
- `システム課` / `システム担当` / `システム` / `全員` / `共通` はグループ担当として許可
- schedule-cardにもmine/group担当者判定を適用

### `mobile-fixes.js`

次の状態除外だけを判断し、`data-workboard-auto-hidden="true"` を付ける。

- `保留`
- 「空き時間」の `確認待ち`

mine/group担当者判定は所有しない。

つまりTodayは完全重複ではなく、**状態除外は重複、mine/group判定はstable固有**という境界になっている。どちらかを丸ごと削除すると現行挙動を失うため、先にマーカー単位の実ブラウザ契約を追加する。

## Ver.200で追加する安全網

### 静的契約 3件

1. stable/mobile/date-keyboardの日付責務が現在の境界を維持すること
2. Todayのmine/group担当者判定がstable固有で、mobileは状態除外だけを持つこと
3. stable/mobileはbody全体Observer、date-keyboardはdialog open同期であり、監視範囲が同一ではないこと

### 実ブラウザ 2件

1. 430px幅で、起動時から存在するタスク期限はsegmented UIが1個だけ作られ、起動後に追加したnative dateは制約されるがsegmented UIへは自動変換されないこと
2. 430px幅のToday fixtureで、状態除外カードにはstable/mobile双方のマーカー、他担当カードにはstableだけのマーカー、グループ担当カードにはどちらのマーカーも付かないこと

## この工程で変更しないもの

- `stable-fixes-v108.js`
- `mobile-fixes.js`
- `date-keyboard-fix-v127.js`
- `release-manifest.js`
- dynamic asset数・ロード順
- Firebase書込経路
- Todayの最終表示ロジック
- body-wide MutationObserver

## 次の製品変更候補

Ver.200監査工程がPRとmainでgreenになった後、最初の製品変更候補は **日付制約の正本整理** とする。

ただし3系統を一度に統合しない。まず `date-keyboard-fix-v127.js` が既存segmented sourceに必要なmin/maxと妥当性検証を持つことを前提に、stable/mobileのどちらか一方のnative date制約責務を退役できるかを評価する。

Todayは状態除外とmine/group判定が非対称のため、日付より後に扱う。body-wide Observer削減はさらに後段とし、責務移管より先に実施しない。
