# Ver.214 stable native hidden ownership audit

## 目的

Ver.213でToday最終可視性を次の境界へ整理した後、stableに残っていたタスクカード・予定カードの `card.hidden = shouldHide` が現在も必要かを製品コード無変更で監査した。

- Todayの状態除外 / mine / group判定と `data-v108-hidden` の付与・解除: `stable-fixes-v108.js`
- `#todayView [data-v108-hidden] { display:none !important; }`: `ui-core-density-v188.css`

基準main: `527b88042c69d0c326325d8e66510011f3f0953b`（Ver.213）
監査main: `43d96f8f6f44d5b13cea441813bf835c0e340338`
復旧地点: `backup/ver213-with-native-hidden-audit`
監査PR: #60

## 監査方法

Playwright配信時だけ実製品 `stable-fixes-v108.js` から2か所の `card.hidden = shouldHide` を除外し、`data-v108-hidden` の付与・解除、Today意味論、Observer、core CSSは変更しなかった。

タスクカードでは保留、mine、group、空き時間の確認待ち、状態変更、mine解除を確認。予定カードでは自分担当、group担当、他担当のmine除外とmine解除後の再表示を確認した。各fixtureのnative `hidden` は常にfalseに固定した。

## 監査結果

Regression #231は新規テストのlocatorが実アプリ描画カードと監査fixtureの同一IDに衝突したため失敗した。これはnative hiddenの必要性を示す失敗ではなく、fixture内へlocatorを限定して修正した。

Regression #232は **Protocol / Browser / Firebase Emulatorすべてsuccess**。

監査PR #60をmainへマージ後、main `43d96f8f6f44d5b13cea441813bf835c0e340338` でも以下を確認した。

- Regression #233: Protocol / Browser / Firebase Emulatorすべてsuccess。
- Pages #340: success。

したがって、stableのnative `hidden` 書込2か所は現在のToday表示制御には不要であり、`data-v108-hidden` + core CSSだけを正本として安全に退役できる。

## Ver.214製品反映

製品ブランチ `refactor/stable-native-hidden-v214` では監査結果を次の最小差分で反映する。

1. `stable-fixes-v108.js` の2か所の `card.hidden = shouldHide` を退役。
2. `data-v108-hidden` の付与・解除、Today意味論、Observerを維持。
3. `ui-core-density-v188.css` は変更せず最終表示の正本を継続。
4. release manifestをVer.214へ更新。
5. 監査テストをsource変換から実製品回帰へ変更し、native hiddenがfalseのまま表示遷移することを固定。
6. static contractでstable native hidden書込の再導入を禁止。
7. 保存処理・Firebase書込・revision・Transaction、dynamic CSS/JS inventoryは変更しない。

この変更により、Today表示の意味論はstableのmarker、presentationはcore CSSという境界へ一本化される。