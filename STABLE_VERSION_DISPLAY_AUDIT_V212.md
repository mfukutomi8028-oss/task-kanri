# stable version表示所有境界監査（Ver.212候補）

## 目的

Ver.211で `stable-fixes-v108.js` の起動後full `applyFixes()` を全廃し、起動後の更新をToday専用へ限定した。

現在stableの初期 `applyFixes()` は次の3責務をまとめて実行している。

1. `installStyle()` — stable固有の保護CSSを注入
2. `applyTodayFilters()` — Today最終可視性を補正
3. `setVersion()` — `.app-version` の表示文字列をmanifest版へ補正

一方、version表示は `release-manifest.js` と `version-display-lock.js` でも補正されるため、本監査ではstableの `setVersion()` 呼び出しが重複責務かを製品コード無変更で確認する。

公開版はVer.211のままとする。

## 現行のversion表示経路

### `release-manifest.js`

- `WORK_BOARD_RELEASE.version` をversion正本として公開する。
- DOMContentLoaded時に `.app-version, .workboard-version-display` を現行 `Ver.211` へ補正する。
- first-paint完了時に `data-first-paint-version=211` を設定する。

### `version-display-lock.js`

- manifest版を参照して `.app-version, .workboard-version-display` を正規化する。
- `app-version` classを `workboard-version-display` へ置換する。
- text / title / `data-release-version` / `WORK_BOARD_VERSION` を現行版へ統一する。
- DOMContentLoaded、pageshow、focus、250ms、1200msで補正する。

### `stable-fixes-v108.js`

- 初期 `applyFixes()` 内で `setVersion()` を1回呼ぶ。
- `.app-version` のtextとtitleだけを補正する。
- Ver.211では起動後に `setVersion()` を再実行する経路はない。

## 実ブラウザ監査

`tests/stable-version-display-audit-v212.spec.mjs` では製品ファイルを変更せず、Playwrightで配信するstableだけを一時変換し、初期 `applyFixes()` から `setVersion()` 呼び出しを外す。

### 確認内容

1. stableの `setVersion()` 呼び出しなしでも初期表示が `Ver.211` になる。
2. `data-release-version=211`、title、`WORK_BOARD_VERSION=211` が成立する。
3. `app-version` classが残らず `workboard-version-display` に正規化される。
4. stable保護CSSは従来どおり注入される。
5. Todayの `保留` 非表示とgroup担当表示が維持される。
6. 表示を旧版 `Ver.108` に上書きしてもpageshowで現行版へ戻る。
7. 再度 `Ver.143` に上書きしてもfocusで現行版へ戻る。

## green時の次製品候補

- `stable-fixes-v108.js` の `setVersion()` を退役する。
- 初期 `applyFixes()` を `installStyle()` + `applyTodayFilters()` の2責務へ縮小する。
- version表示の正本・継続補正は `release-manifest.js` + `version-display-lock.js` に統一する。

## 変更しないもの

- `stable-fixes-v108.js` 製品実装
- `release-manifest.js`（Ver.211）
- `version-display-lock.js` 製品実装
- Todayの状態除外・mine/group意味論
- stable保護CSS
- date-keyboard / mobile / schedule lock
- タスク / ToDo / スケジュール / 業務メモの保存処理
- Firebase書込・revision・Transaction

## 復旧地点

`backup/ver211-before-version-display-audit` = `759878c251c1b4df6e9bbd16deb336e9423c1cc2`
