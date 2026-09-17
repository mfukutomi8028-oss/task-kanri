# パッチ責務マップ（Ver.214 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

動的CSS **21本**、動的JS **34本**とロード順はVer.214でも変更していません。

## 基盤整理の到達点

- Ver.194: release versionをmanifest正本へ統一。
- Ver.196: schedule `7日間` ラベルをschedule lockへ移管。
- Ver.197〜199: 基本状態削除保護を `app.js` へ統一。
- Ver.200: mobile側native date制約を退役。
- Ver.201〜202: Today意味論をstableへ集約。
- Ver.203: scheduleラベルをschedule lock単独所有へ整理。
- Ver.204〜205: 状態タブ横スクロール・通常表示をmobile所有へ整理。
- Ver.206〜211: broad MutationObserverとfull pass triggerを段階退役し、stableをToday専用更新へ縮小。
- Ver.212: stableのversion表示責務を退役。
- Ver.213: stableのstyle注入を退役。Today最終非表示CSSを `ui-core-density-v188.css`、状態タブ保護を `mobile-fixes.js` へ移管。
- Ver.214: native `hidden` 書込2か所を退役。Today表示制御を `data-v108-hidden` + core CSSへ一本化。

## `stable-fixes-v108.js` の現在境界

stableが所有するのはTodayの意味論だけです。

- `保留` を非表示。
- 「空き時間」の `確認待ち` を非表示。
- mine時に現在ユーザー担当を表示し、他担当を非表示。
- `システム課` / `システム担当` / `システム` / `全員` / `共通` はgroup担当として表示。
- `data-v108-hidden` の付与・解除を行う。
- 初期起動は `applyTodayFilters()` のみ。
- 起動後は `#todayView` MutationObserver、mine/nav click、current/startup user changeから `scheduleTodayFilters()` だけを呼ぶ。

stableは以下を所有しません。

- version表示。
- native日付入力制約。
- 状態タブ表示・保護CSS・横スクロール。
- board layout CSS。
- schedule `7日間` ラベル。
- presentation style注入。
- native `hidden` propertyによるToday表示制御。

## Today表示の現在境界

- 意味論とmarker: `stable-fixes-v108.js`。
- 最終非表示presentation: `ui-core-density-v188.css` の `#todayView [data-v108-hidden] { display:none !important; }`。
- native `hidden` はVer.214でstableから退役。

Ver.214監査PR #60では、stable配信時だけnative hidden書込2か所を除外した状態で、タスク・予定とも非表示と再表示が成立することを確認した。Regression #232はProtocol / Browser / Firebase Emulatorすべてsuccess、監査main `43d96f8f6f44d5b13cea441813bf835c0e340338` のRegression #233・Pages #340もsuccess。

## 他基盤資産の現在境界

- native日付制約・segmented入力: `date-keyboard-fix-v127.js`。
- 状態タブの通常レイアウト・保護CSS・横スクロール・active列切替: `mobile-fixes.js`。
- Today最終非表示presentation: `ui-core-density-v188.css`。
- スケジュール `7日間` 表示とツールチップ: `schedule-today-lock-v129.js`。
- version表示: `release-manifest.js` + `version-display-lock.js`。
- 基本状態5種の削除保護: `app.js`。

## Ver.214の安全網

- static contractは既存全件を継続し、stableに `card.hidden = shouldHide` が存在しない契約を追加。
- BrowserではVer.214専用2件でタスク・予定のmarkerによる非表示・marker解除後の再表示を確認。
- Firebase Emulator E2E **19件**を継続。
- 保存処理・Firebase書込・revision・Transactionは変更しない。
- dynamic CSS **21本** / dynamic JS **34本**とロード順は変更しない。

## 主な復旧地点

- `backup/ver212-with-stable-style-audit`: `1954279ad1be0b663ec807b0942561b100b9efaa`
- `backup/ver213-before-native-hidden-audit`: `527b88042c69d0c326325d8e66510011f3f0953b`
- `backup/ver213-with-native-hidden-audit`: `43d96f8f6f44d5b13cea441813bf835c0e340338`

## 次工程

Ver.214製品変更をmainで確定後、stableに残るTodayデータ取得責務（localStorage fallback / current user解決 / group判定）が現行appの描画データ経路と重複していないかを、まず製品コード無変更で監査する。Today意味論・marker・保存系は変更しない。