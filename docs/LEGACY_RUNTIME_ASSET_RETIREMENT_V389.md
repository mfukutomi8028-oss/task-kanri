# Ver.389候補: 旧ToDo CSSと日付入力V126の物理退役

起点: Ver.387確定main `160eabe7071945a5d2ed09cd86239e43f8897a1f`、Issue #292 Stage C。Release/baseline 304/304、製品コードの変更なし。

現行 `release-manifest.js` は後継の `todo-ui-v142.css`、`date-segment-controls-v230.js`、`ui-date-segment-controls-v230.css` を配布対象に指定している。以下の3件を**Git treeから**削除する候補として分離した（計10,203 bytes）。

| 退役候補 | 固定コミットでの原本 |
| --- | --- |
| `date-keyboard-fix-v126.js` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/date-keyboard-fix-v126.js) |
| `todo-ui-v140.css` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/todo-ui-v140.css) |
| `todo-ui-v141.css` | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/160eabe7071945a5d2ed09cd86239e43f8897a1f/todo-ui-v141.css) |

## 自動確認と受入

- `test-harness/retired-runtime-assets-v389.test.mjs` をProtocolに追加。3件の物理不存在、後継資産の存在とmanifest宣言、JS/CSS/HTML/MJS/JSON/YAML/PS1など実行・テスト・配布ソースからの旧名参照不存在を確認する。
- CIのProtocol / Browser / Firebase Emulator / 最終Regressionが**候補PRのexact-head**ですべてsuccessとなること。main後も同SHAでRegression/Pages successとcheckpoint作成を確認する。
- データベース、認証/権限、アプリJS・現行CSS・manifest・配布ワークフロー・Release304を変更しない。
- **互換性リスク：** 古いHTMLやキャッシュ済みmanifestを使い続けるブラウザは旧URLを要求し、削除後は404となりうる。現行UIのCI成功だけでは旧クライアントがゼロであることは証明できない。必要な旧クライアント・ブラウザキャッシュの存続要件があればマージを保留し、原本は上記固定コミットから同名パスへ復元する。

過去版を現行公開URLで完全再現することはこの段階の保証対象外。旧資産の削除判断はCIだけでは完結しない。
