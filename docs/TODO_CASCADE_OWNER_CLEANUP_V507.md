# Ver.507 — ToDoレスポンシブCSSの二重宣言解消（Stage C / Issue #292）

## 起点と診断

正式受入済Ver.506 main `373cfee3525b22e0245214fe8174e6392b1fd272` と復旧checkpointがidentical。`app.js` 318,724 UTF-16コード単位のテキスト、7,470行について名前付き`function`定義431件を静的抽出し、同名定義0件。呼び出しグラフや実行時到達性の完全証明ではないため、app.jsは削除しない。

`style.css` 約7千行からメディア条件を含むCSSルールを静的に調べ、同じ`@media(max-width:980px)`内で重複するルール本文が2件見つかった：`.todo-compose-main { grid-template-columns:1fr; }` と `.todo-workspace .todo-add-button { width:100%; }`。旧早期セクションにはこの2宣言が存在したが、その後にToDo表示本体のスタイル調整と`@media(max-width:1200px)`があり、最後の`@media(max-width:980px)`ブロックに同一の2宣言が再度記載されている。**最後の2宣言を残し、早期の2宣言のみ削除**した。

## 変更内容と検証

- `style.css`: 早期`@media(max-width:980px)`の上記2行だけを削除。最後の同一2宣言を維持。他セレクタ・具体値・優先度・メディアクエリは変更しない。変更前のGit blob `8891c11d4174927c4d6684060007550e1f9ea7a5` は[Ver.506固定原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/373cfee3525b22e0245214fe8174e6392b1fd272/style.css)から復旧できる。
- `test-harness/final-runtime-inventory-v355.test.mjs`: 早期重複の再登録を拒否し、最終980px条件で2宣言が残ることをチェック。
- `tests/css-cascade-priority-v451.spec.mjs`: 変更前の2宣言だけを現行CSSに戻した旧版相当と変更後CSSを、仮のToDo入力・追加ボタン上で320/390/760/859/860/861/979/980/981/1100/1199/1200/1201/1366/1920pxの**15幅**で実ブラウザのcomputed grid columns・width・button width等を比較。既存のToDo表示snapshot・他のCSS視覚回帰検査を維持。

## 歴史的CSS SHA検証との互換

初回PR CI（Regression #39372075855）のBrowser shard2はCSS履歴復元時の期待blob SHA mismatchで失敗。原因は既存`tests/css-cascade-priority-v451.spec.mjs`が現行`style.css`そのものからVer.485以前を復元していた点で、Ver.507の105コード単位分の削除を先に補わないと、旧Git SHAの照合ができないことを確認した。

同specの冒頭で**削除した2行だけを早期ブロックへ正確に戻し**、復元結果がVer.506の固定Git blob `8891c11d4174927c4d6684060007550e1f9ea7a5`と一致することを新たに強制する。その後で従来のVer.485→Ver.451の復元処理を**旧期待SHAを変えず**実行する。現役Ver.507 CSS自体は別のcomputed-style 15幅比較で検査する。既存historical testsのskip・閾値・期待ハッシュの緩和ではない。

## リスクと保持条件

- CSSの外見は維持するが、`style.css`の実ファイルバイトは変わるため、Ver.506で追加したPages SHA-256は**変わる想定**。差分の正当性はGit比較とBrowser CSS parityで判定。内容変更を黙って「同一配布物」と扱わない。
- 今回は表示意味論が同一の冗長宣言のみで、Release304/manifest/baselineReleaseは据え置く。旧版キャッシュがCSSを保持していても同じ最終表示になることをテストで確認する。意図した機能変更を伴う場合は別工程でRelease更新を検討する。
- `app.js`、業務データ、Firebase Auth/Rules/Writer、旧画像・旧URL互換、旧コードアーカイブ、Pages builder・workflows、CI設定、テスト期待値・retry・timeout緩和は変更しない。CSSOMルール列挙への非公開依存や利用者固有の拡張スタイルまで同一性を保証しない。

## 正式受入ゲート

PR exact-headでProtocol/Browser(1)/(2)/Firebase/Regression全success、expected-head指定main merge、同一SHAのmain Regression5/5とPages build/deploy成功、公開物SHA-256を記録しVer.506からの値変化を説明、復旧checkpointがmainとidenticalを必須とする。セキュリティ改修はユーザー方針に従い保留。
