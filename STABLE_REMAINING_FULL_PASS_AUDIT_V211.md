# stable残存full `applyFixes()` 監査・製品反映（Ver.211）

## 目的

Ver.210では、stableの状態タブclick、resize、orientationchange、pageshow、300ms/1200ms timerによる非意味的full `applyFixes()` を退役した。

その後に残っていた起動後full-pass triggerは次の2系統だった。

- `.nav-filter[data-filter="mine"]` / `.nav-item[data-layout]` click
- `#currentUserSelect` / `#startupUser` change

Ver.211では、これらが `installStyle()` / `applyTodayFilters()` / `setVersion()` を毎回まとめて実行する必要があるかを製品コード無変更のBrowser監査で確認し、greenを確認したうえで製品コードへ反映する。

## 監査結果

監査PR #54では、Playwright内で読み込む `stable-fixes-v108.js` だけを一時変換し、残存イベントを次のように置換した。

- nav/mine click: `scheduleFixes()` → `scheduleTodayFilters()`
- current/startup user change: `scheduleFixes()` → `scheduleTodayFilters()`

初期 `applyFixes()` と `#todayView` MutationObserverは変更していない。

### 実ブラウザで確認した内容

- 初期起動ではfull passが少なくとも1回成立する。
- mine有効化で福冨担当=表示、森井担当=非表示、group担当=表示。
- mine変更ではToday passだけ増え、full passは増えない。
- current userを森井へ変更すると福冨担当=非表示、森井担当=表示、group担当=表示。
- user changeでもToday passだけ増え、full passは増えない。
- 実際の「タスク」→「今日」navigationが成立する。
- navigationでもfull passは増えない。
- stable保護styleとmanifest連動version表示は維持される。

初回監査CIでは2件failureが出たが、いずれも製品依存ではなくテスト側の問題だった。

1. Today fixtureと通常タスクカードが同一 `data-task-id` を持ち、Playwright strict locatorが複数要素を解決した。
2. sidebar navの物理clickがviewport外判定となりタイムアウトした。

fixture内へlocatorを限定し、既存回帰と同じDOM click経路へ修正した後、Regression #208は次のとおり全greenとなった。

- Protocol: **73/73 success**
- Browser: **89/89 success**
- Firebase Emulator: **19/19 success**

監査PR #54はmainへsquash merge済み。

- 監査main SHA: `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`

## Ver.211製品変更

監査結果をもとに `stable-fixes-v108.js` を次のように整理する。

- nav/filter clickは `scheduleTodayFilters()` の0ms / 120ms再評価だけを実行。
- current/startup user changeは `scheduleTodayFilters()` だけを実行。
- 呼び出し元がなくなった `scheduleFixes()` を退役。
- `scheduleFixes()` 専用だった `scheduled` フラグも退役。
- 初期 `applyFixes()` は維持。
- `#todayView`限定MutationObserverは維持。

これにより、stableのfull `applyFixes()` は初期起動に限定され、起動後のToday関連イベントはToday責務だけを再評価する。

## 変更しないもの

- Todayの `保留` 除外。
- 空き時間の `確認待ち` 除外。
- mine/current user/group担当の意味論。
- `#todayView [data-v108-hidden]` による最終可視性。
- stable保護CSS。
- 初期 `applyFixes()` 内の `installStyle()` / `applyTodayFilters()` / `setVersion()`。
- `date-keyboard-fix-v127.js`。
- `mobile-fixes.js`。
- `version-display-lock.js`。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込・revision・Transaction。
- dynamic CSS 21本 / dynamic JS 34本とロード順。

## 製品回帰契約

`tests/stable-remaining-full-pass-audit-v211.spec.mjs` は製品反映後、挙動差し替えを行わず実製品stableへ実行回数カウンタだけを注入する契約へ変更する。

- `scheduleFixes()` が復活していないこと。
- nav/filterとuser changeが `scheduleTodayFilters()` を呼ぶこと。
- mine/user changeでToday表示が正しいこと。
- navigationが正常であること。
- 起動後イベントでfull passが増えないこと。
- style/version表示が維持されること。

Ver.210の回帰契約も現行release番号非依存へ更新し、過去に退役した状態タブ/viewport/pageshow/遅延timerが復活しないことを継続監視する。

## 復旧地点

- 監査前: `backup/ver210-before-remaining-full-pass-audit` = `22624b78e0448838ff6e218b4906d05ed5b7cf2d`
- 監査反映後: `backup/ver210-with-remaining-full-pass-audit` = `70eb9e460b9e1c328dba2065e2f157ae9881cd4f`

## 次候補

Ver.211がmainでRegression / Pagesともにgreenになった後、初期 `applyFixes()` に残る `setVersion()` を監査する。

`release-manifest.js` が初回描画時のversionを反映し、`version-display-lock.js` が継続補正を担当しているため、stableの `setVersion()` が重複責務かを製品コード無変更で確認する。Today意味論とstable保護styleは変更しない。
