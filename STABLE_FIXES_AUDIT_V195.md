# stable-fixes-v108.js 責務監査（Ver.195）

## 結論

`stable-fixes-v108.js` は単純な旧パッチではなく、現在も複数の安全補正を担当しています。一方、`mobile-fixes.js` にも同系統の実装が残っているため、Ver.195では分割・退役を行わず、重複責務と不足テストを先に固定します。

## 現在の責務

| stable-fixes責務 | 現行実装 | 重複/近接実装 | Ver.195判断 |
| --- | --- | --- | --- |
| モバイル状態タブの横スクロール | `patchStatusTabAutoScroll()` + injected CSS | `mobile-fixes.js` の `patchMobileBoardTabs()` + mobile CSS | 二重系統。即移管しない |
| 基本状態の削除保護 | `patchStatusManager()` + capture click guard | `mobile-fixes.js` に同じ基本状態集合と `patchStatusManager()` | 二重系統。既存UI安全網を維持 |
| 日付/date-time min/max・年桁制限 | `patchDateInputs()` | `mobile-fixes.js` に同じ1900〜9999制約、`date-keyboard-fix-v127.js` は分割入力UIを担当 | 三者境界あり。即統合しない |
| スケジュール7日間ラベル | `patchScheduleRangeLabel()` | `mobile-fixes.js` にrange button補正 | 表示補正として重複。現状維持 |
| Todayの状態・担当者フィルタ | `applyTodayFilters()` | `mobile-fixes.js` の `patchTodayView()` に保留/確認待ち除外 | stable側にはmine/group担当者判定もあり、完全同一ではない |
| バージョン表示fallback | `setVersion()` | `version-display-lock.js` | Ver.194で番号正本競合は解消済み |
| 動的DOM追従 | body全体 `MutationObserver(scheduleFixes)` | `mobile-fixes.js` もbody全体 `MutationObserver(schedulePatch)` | 二重監視。性能/責務整理候補だがテスト後に判断 |

## Ver.195で追加する安全網

既存 `foundation-js-behavior-v194.spec.mjs` は、基本状態保護・7日間ラベル・日付分割入力・今日固定・一覧ソート・バージョン復元を固定済みです。

Ver.195では stable-fixes 固有または重複境界で未固定の次を追加します。

1. **動的に追加されたdate/datetime-localにも1900〜9999制約が付くこと**
   - body MutationObserverによる後挿入DOM追従も同時に確認する。
2. **Todayフィルタの状態ルール**
   - `保留` は非表示。
   - 「空き時間」パネルの `確認待ち` は非表示。
3. **「自分の担当」時の担当者ルール**
   - 現在ユーザーは表示。
   - `システム課` 等のグループ担当は表示。
   - 他ユーザーは非表示。
   - schedule cardにも同じ担当者条件を適用する。
4. **モバイル状態タブの独自 `scrollIntoView()` 契約**
   - ページ縦スクロールではなく、タブ行の `scrollLeft` だけを調整する。

## 今回変更しないもの

- `stable-fixes-v108.js` 本体
- `mobile-fixes.js`
- `date-keyboard-fix-v127.js`
- `schedule-today-lock-v129.js`
- `list-sort-v131.js`
- Firebase書込経路
- manifestのactive asset構成

## 次の判断条件

Ver.195安全網が main でgreenになった後に、以下を別工程で判断します。

- `stable-fixes-v108.js` と `mobile-fixes.js` の重複をどちらへ寄せるべきか。
- モバイル専用責務を `mobile-fixes.js` 側へ集約できるか。
- Todayフィルタの正本を app.js / feature-owned helper のどちらへ置くべきか。
- body全体MutationObserverを1系統へ減らせるか。

重複しているという理由だけで片方を削除せず、各責務について実ブラウザ安全網がある状態で1責務ずつ移管します。
