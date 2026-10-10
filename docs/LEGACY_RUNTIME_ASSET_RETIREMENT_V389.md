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

## Ver.390: 重複CSS 7件をGitから退役し、Pagesの旧URLを維持

起点Ver.389 main `b96559e406d95f1e99d7aaafc0ea628ade0d611c`。Issue #292 Stage C。下記7ファイルについて、**退役直前のGit blob SHAが現行CSSと完全一致**することを確認した。旧名の物理ファイルをGitのmainから削除し、`test-harness/build-pages-runtime-v382.mjs`でPages成果物に同じバイトを旧名で生成する。旧キャッシュのURLは維持し、利用者向けUI、Firebase、Release304は変更しない。

| Gitから退役する旧CSS | 内容の正本 | バイト | 固定Git blob SHA |
| --- | --- | ---: | --- |
| `activity-dialog-v130.css` | `ui-activity-dialog-v193.css` | 9,100 | `73ff989cbbdea3fcfe6613e06e73c11909e60bcd` |
| `list-sort-v131.css` | `ui-task-list-sort-v193.css` | 1,911 | `26c63abeca6dc3a931ee3e3c29b75a1514d1e9be` |
| `ui-v148.css` | `ui-workflow-insights-v192.css` | 4,915 | `4cd0d028f51b2032dff719013ad61371245dea18` |
| `ui-v149.css` | `ui-task-prerequisites-comments-v192.css` | 5,746 | `a3c57fd411f2d88105a2622a8024296c3ab8cd1c` |
| `ui-v150.css` | `ui-task-relations-reminders-v192.css` | 4,584 | `63cdee7c2c643ff79841216a63fd7978f4f4820e` |
| `ui-v151.css` | `ui-task-detail-responsive-v192.css` | 5,387 | `dfbf31e85777f1c1054a25c8e0a670bded74e0ca` |
| `ui-v154.css` | `ui-task-detail-tools-v192.css` | 1,765 | `660f2184edf3f83d20a3057e675966d103a1ff03` |

合計 **33,408 bytes / 7ファイル**をGitの現行treeから除外する。旧ソースは [Ver.389確定コミット](https://github.com/mfukutomi8028-oss/task-kanri/tree/b96559e406d95f1e99d7aaafc0ea628ade0d611c) の各パスから復旧できる。Pagesは互換URLを継続公開するため、公開サイズやファイル数の削減は狙わない（完全一致する従来のバイトを配布する）。

後継CSSに意図せぬ変更があればProtocolのGit blob SHA検査で失敗させる。Pages unit testで旧URLのファイル存在とバイト一致を、Playwrightの配布成果物実サーバで旧URL HTTP 200とバイト一致を検査する。従来の退役チェックと回帰テストを維持する。もし将来、現行CSSだけを変更する場合は、旧キャッシュ用の固定CSSを別途保存・生成する設計を決めてからハッシュ契約を更新すること。

Ver.390候補PRのexact-head 4系統のCI all success → main同SHA Regression/Pages success → checkpointまで正式完了としない。

## Ver.391候補: JS/CSS/PNGの重複3件も旧URLを維持して整理

起点: Ver.390候補コミット `e23de2aa786f938d209eb6d5d78b1958dafa55f2`。下記3組は退役前のGit blob SHAが完全一致。現行JSとCSS、歴史的なPNGを正本としてGitに残し、Pagesのステージングだけで旧パスを生成する。

| Gitから退役する旧ファイル | 正本 | Bytes | Git blob SHA |
| --- | --- | ---: | --- |
| `user-add-fix-v155.js` | `user-registration-v191.js` | 6,450 | `4f1161f5de6a3b42f0c7b9ba67b47222395c91d3` |
| `ui-v156.css` | `ui-comment-mentions-v191.css` | 5,327 | `794b18eeb0237b15e8d563fc5c9450be77c8d4da` |
| `assets/summary-today.png` | `assets/nav-today-v87.png` | 1,142,903 | `54639e7b18cd77f35cf027a4b7ce0a52d7e8025a` |

合計 **1,154,680 bytes / 3ファイル**をGitの最新treeから除外する。Git履歴は残す。CSS7件とあわせた公開ファイル名・配布サイズは維持し、旧URLでのHTTP200と正本へのバイト一致をPages packageの実サーバ検証で確認する。JS/CSS/PNGの元SHAはProtocolで固定。Firebase・業務コード・manifest・Release304・Rulesは変更しない。旧版の複数ファイル間の動作互換すべてを保証するものではなく、今回の確認対象は**同一バイトのURL互換**に限定する。

Ver.391はVer.390確定mainを取り込んでからexact-head全CIを成功させ、main Regression/Pages・checkpointを経て正式完了とする。
