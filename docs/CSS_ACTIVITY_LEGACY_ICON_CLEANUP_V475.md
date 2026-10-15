# Ver.475 — お知らせの旧アイコン非表示CSSを重複整理

**Issue #292 / Stage F。** 起点はVer.474検証済みmain `1056b08e1e9919d2013dc19ac04a3c3b407ada59`。同SHAのRegression/Pages成功と復旧ref `backup/ver474-activity-header-css-validated-checkpoint`（compare identical/ahead0/behind0/files0）を確認済み。

## 変更と判断
`style.css` の `.activity-title-icon { display: none !important; }` はトップレベルに4回ありました。Ver.66コメント付きの最初の定義とVer.69・Ver.70ブロック末尾にある先行3規則だけを削除し、Ver.71の最後の同値・同優先度の定義を保持します。該当3箇所はいずれもCSS括弧深さ0で、`@media`/`@supports` 内ではありません。セレクタ・宣言値・`!important` は同一で、最後に残す非表示指定は変更しません。

元CSSの削除位置3箇所と残存正本を事前照合し、逆順に再挿入すれば元のCSSに完全一致することを確認しました。CSSの減少は**236バイト（UTF-8）**です。

## Browser回帰の維持
`tests/css-cascade-priority-v451.spec.mjs` にVer.475の3規則を再挿入する復元処理を追加し、Ver.474固定Git blob `54e880f0defb70a07fc85d13abdaa2a6648749f1` と完全一致することを検証します。Ver.451〜474の復元・画面比較は維持します。さらにVer.474で使ったChromium fixture（5モード×幅390/860/861/980/1366/1450/1920pxの35条件）を利用して、旧アイコン・ベル・見出し・補足・通知件数・本文のcomputed style、pseudo-elementおよびボックス寸法をVer.474/475間で比較します。

## 変更しない範囲
変更は `style.css`、既存Browser CSS契約、本台帳の3ファイルのみ。製品のJS/HTML、その他CSS、Release304・manifest、Firebase/Auth/Rules/writer/データ、Pagesビルド・旧URL/PNG資産は変更しません。セキュリティIssue #368は別工程です。

## 正式受入条件
Draft PR exact-headのProtocol/Browser(1)/(2)/Firebase Emulator/最終Regressionすべて成功→想定3ファイルとmain SHAを再照合→expected-head merge→main同SHAの回帰5ジョブ/Pages build・deploy成功→専用復旧ref再読込とcompare identical/ahead0/behind0/files0。失敗時はDraft維持、既存テスト期待値・retry・時間制限は緩和しません。検証は選択したChromium fixtureの同値性であり、全端末状態の同値保証ではありません。
