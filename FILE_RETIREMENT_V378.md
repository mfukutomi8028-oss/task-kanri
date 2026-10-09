# Ver.378: レガシーファイル物理削除 第1段（候補）

2026-10-09。起点の正式 main は `3cbecffc980e54c4fdf66958a7c76290caa0552f`。**Draft PR、未公開・未マージ**。Release/baseline **302/302を維持**。

## 目的と進捗の測り方

「旧実行責務の退役」と「実ファイルの削除」は異なる作業であり、別に追跡する。実測Git tree（起点main）のファイル数は **639**（フォルダを除く）。
- .js 76本、.css 59本、.mjs 281本、.md 122本、画像（.png + .svg）85本、その他16本。
- release-manifestのrequired + optional assetsを基準に、.js **37本**、.css **28本**を現行配布一覧へ登録。登録差の39本/31本をそのまま不要と判定しない。test-harness内の.js 2本など、ファイル種別と実行責務は別。
- 281本の.mjsは大部分がProtocol / Playwright / Firebase Emulatorの検証資産。画像58本はPlaywrightスクリーンショット正本であり、配布アイコンと混同しない。
- コード責務マップの15分類にはconsolidation履歴があるが、全件完了の分母・残件基準はまだ定義されていない。定義なしの「完了率xx%」を付けない。

## この段階での削除候補

1. `github`：Git tree上1 byte（改行のみ）で、実行資産ではない。
2. `assets/nav-star-v87.png`：現行manifest・現在のindex.html・現行補正マップに無い古いStar画像（Git tree 1,493,707 bytes）。
3. `assets/nav-todo-v139.svg`：現行manifestの`nav-todo-v168.svg`、起動HTMLの`nav-todo-v142.svg`と別の旧画像（1,569 bytes）。

この3つだけをmainとは別の候補ブランチから削除。元ファイルはGit履歴と既存の正式復旧checkpointに残る。古いキャッシュ済みブラウザや旧版を部分的に再公開する場合の404リスクは残るため、mainへ採用する前に許容判断を伴う。

**削除しない例：** `assets/nav-memo-v167.svg` は、名前が旧版でも現行 `work-features-v167.js` のメニュー生成で実際に参照され、後段 `icon-system-v169.js` が v168へ置換する。見かけの旧版判定による一括削除は禁止。Ver.143の起動HTMLが直接参照する旧PNGも維持する。

## 安全網

`test-harness/retired-assets-v378.test.mjs` をProtocolに登録して、この3ファイルが存在しないこと、削除した画像名がHTML/manifestだけでなく残存JS/CSS/MJS/JSON/YML/PS1の実ソースに現れないこと、必要なv167 memo画像が残ることを検証する。意図しない参照が見つかれば**テスト赤として採用しない**。

従来の `test-harness/release-contract.test.mjs`、manifest、ローダー、.github/workflows、snapshot基準画像、Firebase、業務データ、コード本体は変更しない。バージョン番号も変更しない。

## 受入・ロールバック条件

1. PR exact HEADのProtocol・Browser・Firebase Emulator CIがすべてgreen。
2. タイムライン機能PR #290との競合・main最新SHAを再取得し、採用前に差分を確認。
3. merge後のmain Regression成功、Pages build/deploy成功、必要ファイル404がないことを実機で確認。既存checkpointは削除しない。
4. 新しい欠落・古いブラウザからの読込エラーがあれば、Git履歴の同SHA blobを元パスへ復元して回帰確認する。

## 次の段階（本PRではしない）

- v143 `index.html`の起動参照を最新正本へ移し、古いPNG/CSSを一度に削除せず旧キャッシュ参照の存続期間と実ブラウザ初回描画を検証する。
- rootの39本/31本の「配布一覧外JS/CSS」を全ファイルで、現行直接参照・テスト契約・ロールバック依存・旧キャッシュ依存に分類。コード移管済みでも参照があるものは元ソースの一部を残すか契約を更新する。
- 過去監査Markdownの置き場所とREADMEの古いVer.141/「2名向け」表現は、旧履歴を残しつつ現行運用説明を別正本にする。大量のテスト正本画像は機械的に消さない。
