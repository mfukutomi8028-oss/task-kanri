# Ver.214 stable native hidden ownership audit

## 目的

Ver.213で `stable-fixes-v108.js` のJavaScript style注入を退役し、Today最終可視性は次の境界へ整理した。

- Todayの状態除外 / mine / group判定と `data-v108-hidden` の付与・解除: `stable-fixes-v108.js`
- `#todayView [data-v108-hidden] { display:none !important; }`: `ui-core-density-v188.css`

stableにはなお、タスクカードと予定カードの両方で `card.hidden = shouldHide` が残っている。Ver.213監査ではnative `hidden` が別の描画経路から書き換えられる場合が確認されており、最終表示のdurableな正本は `data-v108-hidden` + core CSSである。

Ver.214では、このnative `hidden` 書込が現在も必要かを**製品コード無変更**で監査する。

基準main: `527b88042c69d0c326325d8e66510011f3f0953b`（Ver.213）
復旧地点: `backup/ver213-before-native-hidden-audit`
監査ブランチ: `audit/stable-native-hidden-v214`

## 監査方法

`tests/stable-native-hidden-audit-v214.spec.mjs` では、ブラウザへ配信する時だけ実製品 `stable-fixes-v108.js` から次の2行を除外する。

```js
card.hidden = shouldHide;
```

対象は以下の2経路。

1. `.task-card[data-task-id]`
2. `.schedule-card[data-schedule-id]`

`data-v108-hidden` の付与・解除、Today意味論、Observer、core CSSは一切変更しない。

テストは元ソース内にnative hidden書込が**正確に2か所**あることを事前確認してから変換するため、想定外のstable変更を黙って通さない。

## タスクカードで確認する内容

mine有効状態で以下を同時に検証する。

- 自分担当の `保留` は非表示。
- 他担当の `保留` は非表示。
- 他担当の通常タスクはmine条件で非表示。
- group担当は表示。
- 「空き時間」の `確認待ち` は非表示。

さらに状態を遷移させる。

- `保留 + 他担当` → `未着手 + 他担当`: mine理由だけで非表示を維持。
- `保留 + 自分担当` → `未着手 + 自分担当`: markerを解除し表示へ戻る。
- mine解除: 他担当通常タスクは表示へ戻り、`確認待ち` は状態理由で非表示を維持。

各段階でカードのnative `hidden` は `false` のままであることを確認し、表示制御が `data-v108-hidden` + core CSSだけで成立していることを証明する。

## 予定カードで確認する内容

mine有効時に以下を検証する。

- 自分担当予定は表示。
- group担当予定は表示。
- 他担当予定は `data-v108-hidden` により非表示。

mine解除後は他担当予定のmarkerが解除され、表示へ戻ることを確認する。ここでもnative `hidden` は常に `false` のままとする。

## 今回変更しないもの

- `stable-fixes-v108.js` の製品コード。
- `ui-core-density-v188.css`。
- `release-manifest.js`（Ver.213のまま）。
- Todayの保留 / 確認待ち / mine / group意味論。
- `#todayView` Observer。
- mobile / date-keyboard / schedule lock / version-display-lock。
- タスク / ToDo / スケジュール / 業務メモの保存処理。
- Firebase書込・revision・Transaction。
- dynamic CSS / JS inventoryとロード順。

## green後の製品候補

監査が全greenの場合、Ver.214製品変更の候補は次の最小差分とする。

1. `stable-fixes-v108.js` の2か所の `card.hidden = shouldHide` だけを退役する。
2. `data-v108-hidden` の付与・解除はそのまま維持する。
3. `ui-core-density-v188.css` の最終非表示ルールはそのまま維持する。
4. release manifestをVer.214へ更新する。
5. static contract / Browser回帰 / 責務台帳を新境界へ更新する。
6. 保存処理・Firebase書込には触れない。

監査で1件でも表示遷移が崩れる場合はnative `hidden` 書込を製品から削除せず、その失敗を必要性の証拠として扱う。