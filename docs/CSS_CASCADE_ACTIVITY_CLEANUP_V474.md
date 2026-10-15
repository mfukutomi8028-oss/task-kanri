# Ver.474 — お知らせヘッダーCSSの完全一致重複を限定削除

**Issue #292 / Stage F。** 起点はVer.473正式main `bfe596bdc54ff268510d990ca2a6398497d027f7`。同SHAでRegression全5ジョブとPages build/deployが成功し、復旧ref `backup/ver473-protocol-discovery-runner-validated-checkpoint` とmain比較 identical/ahead0/behind0/files0 を確認済み。

## 変更範囲と判断

- 対象は `style.css` の見出し付近に連続した `.activity-head` 背景と `.activity-head p` の上余白の**先行する2規則と古いコメントだけ**。2規則の後方にはセレクタ・宣言値・`!important` が完全一致した同じ2規則があり、どちらもトップレベル（`@media`/`@supports` の外）であることを削除前に確認しました。
- 先行部分200文字を1箇所だけ削除し、後方の正本を維持。他のactivity見出し、ベル/通知件数、メディア別CSS、JS/HTML、`index.html` のクエリ `?v=143`、manifest Release304には手を加えません。
- 元Git blob `6076091053232a392e37749fda74ac00db95649d` と候補Git blob `54e880f0defb70a07fc85d13abdaa2a6648749f1` を固定し、`tests/css-cascade-priority-v451.spec.mjs` では削除した文字列をv70直前へ再挿入すると旧Git blobへバイト単位で復元できることを検証。既存のVer.451〜463不変のスタイル復元テストは旧正本を復元したうえで全て維持し、期待値の緩和はしません。
- 同一テストファイルにVer.474のChromium比較を追加。5つの画面モード × 幅390/860/861/980/1366/1450/1920pxの35条件で、お知らせの見出し/補足/ベル/件数/本文およびpseudo-elementのcomputed styleとボックス寸法を新旧で比較します。実アプリの全状態や旧端末の全CSSOMを網羅する証明とはしません。

## 保持する境界

- 原本は `https://github.com/mfukutomi8028-oss/task-kanri/blob/bfe596bdc54ff268510d990ca2a6398497d027f7/style.css` と前述のSHAで復元可能。Git履歴・checkpoint・旧キャッシュ資産・PNGは削除しません。
- セキュリティIssue #368、Firebase Auth/Rules/writer/保存モデル、ユーザーデータ、他の製品runtime、Pages配布フローには変更なし。
- 静的重複候補は以前23件ありましたが、メディアクエリなど別文脈のものは今回対象外です。

## 検証と正式受入

Draft PRでは差分を `style.css`、既存Browser CSSテスト、本資料の3ファイルだけに限定。PR最新headのProtocol、Browser(1)/(2)、Firebase Emulator、Regression全5ジョブ成功後、main/SHA照合してexpected-headマージ。main同SHAで回帰全5ジョブとPages build/deploy全成功、専用checkpoint ref再読込とmainとの差分0確認で正式完了とします。CI不合格時はDraft保持し、画面の合格条件を緩和しません。
