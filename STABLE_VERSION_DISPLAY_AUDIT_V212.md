# stable version表示所有境界監査・製品反映（Ver.212）

## 目的

Ver.211で `stable-fixes-v108.js` の起動後full `applyFixes()` を全廃し、起動後の更新をToday専用へ限定した。

その時点のstable初期 `applyFixes()` は次の3責務を持っていた。

1. `installStyle()` — stable固有の保護CSSを注入
2. `applyTodayFilters()` — Today最終可視性を補正
3. `setVersion()` — `.app-version` の表示文字列をmanifest版へ補正

一方、version表示は `release-manifest.js` と `version-display-lock.js` がすでに所有していたため、Ver.212ではstableの `setVersion()` が重複責務かを事前監査し、安全確認後に製品から退役する。

## 事前監査結果

監査PR #56では製品ファイルを変更せず、Playwrightで配信するstableだけを一時変換し、初期 `applyFixes()` から `setVersion()` 呼び出しを外した。

確認した内容:

1. stableの `setVersion()` なしでも初期表示が `Ver.211` になる。
2. `data-release-version=211`、title、`WORK_BOARD_VERSION=211` が成立する。
3. `app-version` classが残らず `workboard-version-display` に正規化される。
4. stable保護CSSは従来どおり注入される。
5. Todayの `保留` 非表示とgroup担当表示が維持される。
6. 表示を旧版へ上書きしてもpageshow / focusで `version-display-lock.js` が現行版へ復旧する。

監査PRのRegressionは Protocol / Browser / Firebase Emulatorすべてsuccess。監査main `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6` では初回Firebase cold-start同期timeoutが1件発生したが、同一SHAのfailed-job再実行で全工程successとなった。Pages build / deployもsuccess。

## Ver.212製品変更

`stable-fixes-v108.js`:

- `setVersion()` 関数を退役。
- `applyFixes()` から `setVersion()` 呼び出しを退役。
- 初期passを `installStyle()` + `applyTodayFilters()` の2責務へ縮小。
- `WORK_BOARD_RELEASE.version` 参照をstableから完全に除去。

version表示:

- 初回version文字列は `release-manifest.js` が担当。
- class / text / title / `data-release-version` / `WORK_BOARD_VERSION` の正規化と継続復旧は `version-display-lock.js` が担当。
- stableはversion表示に関与しない。

## 製品回帰契約

`tests/stable-version-display-audit-v212.spec.mjs` は監査用のstable一時変換を廃止し、実製品コードを直接確認する恒久回帰へ変更する。

- 初期表示が `Ver.212`。
- `data-release-version=212`、title、`WORK_BOARD_VERSION=212`。
- `.app-version` が残らない。
- stable保護styleが存在する。
- Todayの状態除外・group担当表示が維持される。
- legacy version上書きをpageshow / focusで復旧する。

static contractでは次を固定する。

- stableに `function setVersion()` が存在しない。
- stableが `WORK_BOARD_RELEASE.version` / `WORK_BOARD_VERSION` を扱わない。
- stable初期 `applyFixes()` は `installStyle()` + `applyTodayFilters()` のみ。
- version-display-lockがmanifest版を参照し `WORK_BOARD_VERSION` を設定する。

## 変更しないもの

- Todayの状態除外・mine/group意味論。
- `#todayView`限定MutationObserver。
- stable保護CSS。
- `version-display-lock.js` の補正ロジック。
- date-keyboard / mobile / schedule lock。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込・revision・Transaction。
- dynamic CSS 21本 / dynamic JS 34本とロード順。

## 復旧地点

- 監査前: `backup/ver211-before-version-display-audit` = `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
- 製品変更前: `backup/ver211-with-version-display-audit` = `5c2081a84f9d3d77800ff2ca057a3bc64adf8da6`

## 次候補

stableに残る初期責務は `installStyle()` とToday補正だけになった。

次工程では製品コードを変更せず、`installStyle()` が注入する以下の保護CSSについて、既存active CSSとの重複とJavaScript注入である必要性を監査する。

- mobile状態タブのtouch / snap / user-select保護。
- board column / task-listの高さ・overflow保護。
- `#todayView [data-v108-hidden]` の最終非表示ルール。

Today意味論や状態タブ挙動を変更せず、CSS責務を移管・整理できるかを先に測定する。
