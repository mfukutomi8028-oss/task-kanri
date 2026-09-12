# 基本状態削除保護 責務監査（Ver.197）

## 結論

基本状態5種（`未着手` / `対応中` / `確認待ち` / `保留` / `完了`）の削除保護は、現在 `app.js`、`stable-fixes-v108.js`、`mobile-fixes.js` の3層に分散しています。

ただし3層は同じ責務ではありません。`app.js` は `完了` だけを恒久固定状態として扱い、名称編集も削除も禁止します。残り4状態の削除不可はstable/mobileの後付けガードで成立しており、名称編集自体は許可されています。

そのため、`app.js` の既存 `protectedStatus` 判定を単純に5状態へ広げると、4状態までreadonly化して既存仕様を変えてしまいます。Ver.197では製品コードを変更せず、この境界を先に固定します。

## 現在の責務分布

| 資産 | 現在の責務 | 注意点 |
| --- | --- | --- |
| `app.js` | `DEFAULT_STATUSES` 5種を定義。状態管理UIを生成。`完了` の名称編集・削除を直接禁止 | 4つの基本状態は名称編集可能。`deleteStatus()` 自体は `完了` しか拒否しない |
| `stable-fixes-v108.js` | 5基本状態の削除ボタンをdisabled化し、capture clickでも削除を阻止 | デスクトップを含む通常実行経路で後付け保護を担当 |
| `mobile-fixes.js` | 5基本状態の削除ボタンをdisabled化し、capture clickでも削除を阻止 | モバイル互換レイヤー。stableと同じ削除保護が重複 |

## Ver.197で固定する契約

### 静的契約

`test-harness/status-delete-ownership-v197.test.mjs` で次を確認します。

1. `app.js` の `DEFAULT_STATUSES` が5基本状態の正本であること。
2. `app.js` の名称固定判定は引き続き `完了` のみであること。
3. `app.js` の `deleteStatus()` は現時点では `完了` だけを直接拒否していること。
4. stable/mobileの両方が同じ5基本状態配列を保持し、削除ボタンdisabled・`aria-disabled`・説明title・click guardを持つこと。

この契約は「現状が最終形である」ことを示すものではなく、次工程で安全に所有権を移すための移行基準です。

### 実ブラウザ契約

`tests/foundation-js-behavior-v194.spec.mjs` で次を同時に確認します。

- 5基本状態すべての削除ボタンがdisabled。
- 5基本状態すべてに `aria-disabled="true"` と削除不可titleが付く。
- `未着手` / `対応中` / `確認待ち` / `保留` の名称入力はreadonlyではない。
- `完了` だけ名称入力がreadonly。
- カスタム状態の削除ボタンは有効のまま。

## Ver.197で変更しないもの

- `app.js`
- `stable-fixes-v108.js`
- `mobile-fixes.js`
- Firebase書込経路
- 状態名変更処理
- タスク状態データ
- dynamic CSS / JSの個数とロード順

## 次工程の安全な移管手順

Ver.197がPRとmainの両方でgreenになった後、次工程では以下の順で進めます。

1. `app.js` に「削除保護専用」のpredicateを追加し、`DEFAULT_STATUSES` 5種を対象にする。
2. `renderStatusManager()` の削除ボタンだけを5状態でdisabled化する。名称入力のreadonly判定は `完了` のまま維持する。
3. `deleteStatus()` 本体でも5基本状態を拒否し、DOMガードを迂回しても削除できない状態にする。
4. 実ブラウザ安全網がgreenであることを確認してから、まず `stable-fixes-v108.js` の重複削除ガードを除去する。
5. `mobile-fixes.js` の互換ガードは別工程で評価し、一度に両方を削除しない。

この順番により、UI補正からアプリ本体へ責務を戻しながら、名称編集という既存仕様を維持できます。
