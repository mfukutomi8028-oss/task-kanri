# Ver.266 ToDo履歴 Observer / timer 境界監査

## 目的

`todo-history-v146.js` が持つ `#todoView` subtree `MutationObserver`、observer起点 `requestAnimationFrame`、検索input、storage同期、60秒intervalの更新責務を実測し、必要な更新契機と不要なchurnを分離する。

Ver.266は監査のみとし、製品runtime・ToDo保存正本・Firebase書込経路・release 255は変更しない。

## 現行責務

`todo-history-v146.js` は以下を入力として「過去の完了」を描画する。

- room別ToDo localStorage cache
- 現在ユーザー
- 検索中かどうか
- ローカル日付境界（今日を履歴から除外し、直近7日を表示）

更新契機は現在4系統ある。

1. `#todoView` 全subtreeのchildList MutationObserver
2. observerからのrequestAnimationFrame patch
3. 検索input / storage event
4. 60秒interval

## Browser実測

PR #152 / Regression #607 で計測した。

### canonical ToDo描画直後

- observer: 1個
- scope: `#todoView`, `childList:true`, `subtree:true`
- callback: 14回
- mutation: 26件
- rAF scheduled: 14回
- rAF executed: 13回
- interval: 60000ms

### そのままidle

短時間待機しただけで以下まで増加した。

- callback: 14 → 26
- mutation: 26 → 38
- rAF scheduled: 14 → 26
- rAF executed: 13 → 25

主なmutation targetは `.todo-history-toggle-v146` で、`applyVisibility()` が同一表示文字列でも `button.textContent` を再設定し、そのchildList mutationを自身のsubtree observerが再検知している。

つまり、Ver.264で他ToDo sidecarに確認したものと同型の自己誘発ループが `todo-history-v146.js` 単体にも残っている。

### 無関係な子孫DOM mutation

履歴意味論と無関係な `.todo-page` へのchild追加だけでも、以下を観測した。

- callback: 9回
- mutation: 9件
- rAF scheduled/executed: 8回

広いsubtree監視により、履歴更新に不要な子孫変更でも起床している。

### 明示的な非DOM更新契機

Observerを切断した状態でも、それぞれ単独で更新契機として成立した。

- 検索input: 1回
- storage event: 1回
- timer: 1回

検索・cross-tab cache更新・時刻更新のためにsubtree observerへ依存する必要はない。

## 判断

### 1. MutationObserver scope

`app.js` はcanonical ToDo描画時に `#todoView.innerHTML` を置換するため、履歴sidecarが必要なのはview root直下のcanonical replacement検知だけである。

Ver.267では `subtree:true` を廃止し、`#todoView` の direct `childList` 監視へ縮小するのが妥当。

### 2. observer起点requestAnimationFrame

MutationObserver callbackはcanonical rendererの同期処理終了後に実行されるため、root直下replacementを受けた後に履歴を直接adoptできる。observer専用rAF rescanは不要と判断する。

検索input / storageも既に明示eventであるため、同様に直接更新できる。

### 3. DOM write idempotency

少なくとも `button.textContent`、`aria-expanded`、`hidden`、collapse classは現在値と一致する場合に書き込まない。これにより履歴自身のDOM更新が不要mutationを生成しない契約を固定する。

### 4. 60秒interval

履歴集合の時刻依存は「日付が変わる瞬間」だけである。毎分再計算する必要はない。

Ver.267では次のローカル日付境界までのone-shot timerへ変更し、発火後に次の境界を再予約する。`pageshow` / `visibilitychange` 復帰時には日付差分を再確認し、端末sleepや時刻変更から回復できる形を優先する。

## Ver.267製品化候補

- `#todoView` observerをdirect-root `childList`へ縮小
- observer起点rAFを撤去
- 検索input / storage eventは直接patch
- DOM writeをidempotent化
- 60秒intervalをローカル日付境界timerへ置換
- canonical render後 callback 1回以内、rAF 0、idle増加なし、無関係子孫mutation callback 0を合格条件にする
- 検索時強制展開、collapse保存、cross-tab storage更新、日跨ぎ、ToDo CRUD / 完了 / タスク化 / 履歴表示を回帰確認する

## 非変更

- `todo-sync-v136.js`
- ToDo保存・競合保護
- Firebase書込経路
- `app.js` のcanonical ToDo保存正本
- release 255 / baselineRelease 255

## 検証結果

PR #152 Regression #607:

- Protocol: success
- Browser regression: success
- Firebase Emulator: success

製品runtimeの変更はないため、Ver.266監査をmainへ固定した後、Ver.267を別PRで製品化する。