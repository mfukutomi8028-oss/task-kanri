# Ver.438 — Stage E 参照元0のroot Markdown18件の分類・固定原本退役

Issue #292。対象は2026-10-13(JST)時点のVer.437正式main `63d561e87a61ef3fdabb094efd41ea174ca2d4fa` / 全Gitツリー `dbc91a50ac6c84f4458ccf1b3784399475e59c68`。本書は**当時の分類スナップショット**であり、将来の保管方針を永久固定するものではない。

## 判断ルール

- この分類表への言及を現役の独立したオーナー参照と誤判定しないため、Ver.426参照棚卸しは本分類索引のみ自己参照・監査メタデータとして除外する。退役索引の内容はStage Eの別テストが検証する。
- Ver.426のGit管理テキスト調査で18件が「ファイル名の完全一致オーナーなし」。GitHubのコード検索では下記2件の文字列参照は0件。ただし動的パス連結、外部ブックマーク、ローカルキャッシュ、テストのプログラム的なファイル探索までは不存在を保証しない。
- 監査候補を一律に削除しない。現行の保存・通知・セキュリティ判断を示す文書、障害復旧の一次情報、運用中の監査手順は保持・追加調査。
- 退役とするのは、現行製品コード・正本テストへの引き継ぎが確認できた**歴史的な計画・監査2件**のみ。Git履歴を書き換えず、元バイトの復元URLを固定する。旧 `blob/main/` リンクを自動的に直すことはできない。

## 退役する2件 — 固定コミットから元バイトで復元可能

| Retired root Markdown | Original Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md` | `55797d283c0a5e3e8ddcf2b34a3fa8fb55c99aa3` | 2,444 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/63d561e87a61ef3fdabb094efd41ea174ca2d4fa/MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md) |
| `TIMELINE_COMPLETION_V377.md` | `795ce44a51acdde26d0b27cf758445dfc7c28bcb` | 2,419 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/63d561e87a61ef3fdabb094efd41ea174ca2d4fa/TIMELINE_COMPLETION_V377.md) |

元原本合計 **4,863 bytes / 2件**。現行rootから2件を削除し、索引として本ファイル1件を追加する。Git履歴自体の容量は減らない。

### 継承先
- `MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md` → MOBILE_SHELL_KEYDOWN_LIFECYCLE_PRODUCT_V312.md / mobile-shell-v234.js / tests/mobile-shell-keydown-lifecycle-v312.spec.mjs
- `TIMELINE_COMPLETION_V377.md` → app.js / test-harness/timeline-completion-v377.test.mjs / tests/timeline-completion-v377.spec.mjs (Issue #282 closed)

## 残り16件 — 今回は削除しない

### 保持：保存・時刻などの安全境界
- `AUTO_ARCHIVE_CLOCK_AUDIT_V364.md`：自動アーカイブ6時間周期、衝突/多タブ時の書き込み安全境界
- `COMPLETION_UNPIN_LIFECYCLE_AUDIT_V365.md`：完了固定解除とFirebase transaction・fallbackの安全条件

### 保持：現行UX・イベント責務の設計根拠
- `BOOTSTRAP_CURRENT_ICONS_V380.md`：初期SVG表示と旧PNGキャッシュ互換の境界
- `COMMENT_MENTION_ESCAPE_PRODUCT_V327.md`：コメント@mentionのEscapeリスナー責務と解除条件
- `COMPLETED_BOARD_SCOPE_V373_PRODUCT.md`：完了ボードのscope/モバイル非表示契約
- `FAVORITE_OBSERVER_PRODUCT_V369.md`：お気に入りのObserver監視範囲
- `INBOX_KEYBOARD_FOCUS_V372.md`：個人Inboxのフォーカス・キーボード操作
- `MOBILE_SHELL_BOARD_OBSERVER_V300.md`：ボード直下のMutationObserver監視境界
- `MOBILE_SHELL_KEYDOWN_LIFECYCLE_PRODUCT_V312.md`：Ver.311を引き継いだ現行Escapeライフサイクル
- `MOBILE_SHELL_NAVIGATION_HANDOFF_V306.md`：モバイルナビゲーション引継ぎの設計契約
- `TODAY_SIDEBAR_FILTERS_V375.md`：Todayの担当者・分類フィルター仕様

### 保持：障害・復旧・危険な再導入の記録
- `CI_NPM_EXPRESS_RECOVERY_V384.md`：依存取得障害とExpress5の限定overridesの復旧理由
- `LEGACY_WORKFLOW_RETIREMENT_V384.md`：旧v108の自動書込ワークフローを復活させない判断
- `VER375_EMULATOR_RECONNECT_CI_RECOVERY.md`：Firebase再接続CIの失敗解析とテスト修正履歴

### 追加調査：旧ファイル整理の基礎判断
- `ASSET_RETIREMENT_AUDIT_V379.md`：現行のasset-inventory実行手順・動的参照の注意を再評価
- `FILE_RETIREMENT_V378.md`：初期の削除試行と旧ブラウザ互換の判断根拠が残るため今回保持

上記16件は文字列参照が0でも「不要」ではない。保持の意味は、必ずしも今後もroot直下で保持し続けるという約束ではない。将来の候補は復旧影響と外部参照を改めて確認する。

## 非変更領域・受入条件

- 過去のroot原本2件、索引1件、既存Stage E参照ガード/Protocolテスト2件のみ変更。Release304、現役HTML/JS/CSS、旧PNG/SVG、Pagesビルダー/配布用アセット、Firebase/Rules/Auth、データ保存・業務操作・GitHub Actions workflowに変更を加えない。
- 既存のStage EガードはV427–V438の退役26件を静的完全一致参照・root再登録・索引破損から守る。ただし動的/外部参照は別途実機検証が必要。
- Draft headのProtocol、Browser 2 shard、Firebase Emulator、最終Regressionが全成功した場合だけexpected-headでmainへ統合し、同じmain SHAのRegressionとPagesが全成功してから復旧ブランチを確保する。未完了をsuccess扱いしない。
