# Ver.451 — `style.css` 優先度線の完全一致CSS重複を最小削減

**Issue #292 / Stage F。** 起点はVer.450正式main `55316bb11bbad9114b0d894d618852fb09e82328`、同SHA Regression `#38394683521` と Pages `#38394683488` 成功、復旧 `backup/ver450-pages-allowlist-date-today-e2e-validated-checkpoint`（ref SHA一致・compare identical）。今回の目標は**物理削除が本当に安全なCSSだけを除去**し、その他の候補を機械的に削除しないこと。

## 1. 事前診断と判断

- `style.css` の現行Git blob `dd210b34000eff6703b24f0d32dd69a54e0675b9` は **208,601 B / 7,644行**。軽量な括弧・コメント・メディア文脈走査では、セレクタの同じ再定義が **178組**、宣言本文まで同一の候補が **30組**。これらは静的調査の候補数であり、削除してよい規則数ではない。
- 検討した第1群は`.priority-card`の `border-left-width` / `border-left-style`と、`.priority-card.priority-{緊急,高,中,低}` / `.priority-row.priority-{緊急,高,中,低}`の左枠色計**5規則**。初出の旧グループと後段の「左端の線は優先度だけに統一する」グループは **490文字 / UTF-8 510B** のCSS本文まで完全一致し、双方とも通常のtop-level規則・同じセレクタ/`!important`/値を使用。
- **早い側5規則だけを削除**し、後段の正本・独立の `.priority-row { border-left: 5px solid transparent; }`・対応する優先度の色・今日/超過/固定/放置の強調規則は保持。CSSの全体構造や別のセレクタには一切触れない。古いソースを、残した後段グループを前方へ1回再挿入するだけで**文字列完全一致**復元できることを実装前に確認した。

## 2. 変更点と再現可能な検証

| 契約 | 変更前 | Ver.451候補 |
| --- | ---: | ---: |
| `style.css` Git blob | `dd210b34000eff6703b24f0d32dd69a54e0675b9` | `4f2465e7f3367518ba71e931e60af2ea06bd52fd` |
| `style.css` サイズ（UTF-8） | 208,601 B | **208,091 B（−510 B）** |
| 優先度境界の重複グループ | 5 | **0（後段正本5規則は保持）** |
| Release manifest / HTML / JS | Release304 | **変更なし** |

- 新Browserテスト `tests/css-cascade-priority-v451.spec.mjs` は、**保存した元Git blob SHA**に一致する復元前CSSと、変更後Git blob SHAの両方を検証。対象宣言を単純に削って別のCSSを同時変更する行為を検出する。将来の意図した`style.css`改修でテストが失敗した場合には新しい仕様のもとで明示的に差分レビューし、勝手にテストをskipしない。
- 実Chromiumのsynthetic DOMで優先度カード/行、今日・期限超過・固定/放置の12ケースを用意し、**幅390/860/861/980/1366/1450/1920pxの7条件**で、変更前と変更後の `border-left` / border /背景/box-shadow/box-sizing/表示等17のcomputed styleを同一ページ内で比較。期待値の固定ではなく**変更前と後の一致**を検証する。
- 既存BrowserのIcon/Sidebar/Toolbar視覚snapshot、CSS Protocol、配布サブパス・キャッシュ互換検査、Firebase Emulatorと全回帰も**すべて保持**。Browserで合格しても実運用の全アプリ状態・外部CSSOMを網羅する証明にはならず、大規模なCSS削除は認めない。

## 3. あえて維持する境界

- `index.html`は既存の `style.css?v=143` を参照し、manifestはRelease304を正本とする。**クエリ版数やキャッシュ資産を変更しない**。元CSSが端末キャッシュに残る可能性を踏まえ、今回はcomputed styleが同じと検証したものだけを削除する。見た目や機能が変わるCSS改修では、別工程で適切にrelease・キャッシュ契約を再検討する。
- activityヘッダーやtoolbarsの同名セレクタは、過去のレイアウト変更や他メディア条件を上書きする順序を持つ。文字列一致でも無条件削除はせず、このPRでは**触れない**。
- `app.js`は **344,122 B** の現役本体であり、`patch-responsibilities.json`の15グループと関連sidecarの境界は別工程で確認する。長大という理由だけで `app.js` の関数を移動・統合することはしない。Firebaseのtransaction、task保存、個人ToDo、画面描画、legacy互換を機能別に責務/依存を抽出したあと最小差分にする。
- 保持理由が明示された旧PNG8件・root Markdown11件、Git履歴・復元checkpointを削除しない。Security Issue #368・Rules/Auth/データは対象外。Issue #355は原因調査継続中。

## 4. 受入・復旧

PRの変更は **`style.css`・新Browserテスト・本台帳の3ファイル限定**。exact-headでProtocol/Browser shard1+2/Firebase/Regressionすべてsuccess → expected-headでmainマージ → main同SHA RegressionとPages success → 専用checkpoint ref readback・compare identical。受入まではPRはDraftで維持し、CI不成功をretry上限/期待値緩和やskipで回避しない。

不測の表示差が発見された場合は固定元コミットからCSSを1ファイル単位で復元し、対応CIを全実行する。復旧時にrelease-manifest、Firebase、保存モデルを変更しない。

**次候補:** activityヘッダー複数世代の上書き順序とtoolbar幅境界の可視化、app.js内の関数責務と現役sidecarの突合。採択には実計測が必要。
