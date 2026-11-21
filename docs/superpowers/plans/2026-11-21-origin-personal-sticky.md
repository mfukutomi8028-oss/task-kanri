# Origin 個人付箋ボード実装計画（2026-11-21）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認された個人付箋ボードをOriginに先行実装し、Classic・JOURNALおよび従来の業務メモを変更せず安全に検証する。

**Architecture:** 付箋の内容・外観・位置・スマホ順序を独立revisionで保存する共通サービスを作り、Originは同じサービスのsnapshot/commandだけを利用する。個人専用の要件はFirebase Authの確認済みUIDとDB Rulesの双方で強制する。安全な認証境界のない環境では本番付箋を表示・書き込みしない。

**Tech Stack:** 既存のバニラJavaScript、Shadow DOM、Firebase Realtime Database、Firebase Emulator、Playwright、GitHub Actions。

**Spec:** `業務管理ボード_個人付箋_基本設計書_20261121.md`（承認済み文書。実装への取り込み前に章7〜10と照合する）。

## Global Constraints

- 対象画面はOriginのみ。Classic・JOURNALへの付箋UIは今回追加しない。
- 既存業務メモ `rooms/{roomId}/businessMemos`、タスク、予定、ToDo、表示切替は維持。
- 現行の `rooms/$roomId` 認証なしの設定へ個人付箋を保存しない。
- Firebase Authと本人別Rulesの本番移行は `docs/AUTH_ROLLOUT_GATE_20261106.md` のNO_GOが解除されるまで行わない。
- 本番の患者情報、個人情報、DB内容、認証トークンを開発テスト・GitHubへ持ち込まない。
- 初期版の付箋は6色、本文2000字まで、PCは位置自由/サイズ可変、スマホは一覧で座標不変。
- 操作ターゲット最小44px、日本語IME対応、キーボード位置移動、reduced-motion対応。
- 元の実装の保存版: `backup/pre-origin-sticky-20261121-352457b` (`352457b05fdd45190f8793901a5ee11ac74ae84f`)。

## Review Focus

1. ルームIDと表示名だけを差し替えた状態で他利用者の付箋が読めないか（Task 1, 2）。
2. Auth UID失効・ログアウトと付箋本文の入力が重なるとき、本文が画面やStorageに残らないか（Task 2, 3）。
3. 日本語IME編集中の購読更新と再描画で未確定文字が失われないか（Task 3）。
4. 2端末間で本文・色・移動を同時変更すると本文が消えないか（Task 2）。
5. 320pxのスマホ、200%拡大、旧キャッシュ済みOriginで表示崩れやダブルリスナーが生じないか（Task 3, 4）。

---

### Task 1: セキュリティ境界・認証の分離

**Files:**
- Modify: `security/database.rules.v577.candidate.json`（隔離検証専用）
- Modify: `test-harness/security-rules-v577.mjs`
- Test: `test-harness/security-rules-v577.mjs`

**Interfaces:** `{ roomId, verifiedUid, approved, membership }`が認証サービス側で取得できた場合だけ `roomsV2/{roomId}/personal/{uid}/stickyNotes/{noteId}` を本人が読み書きできる候補Rulesを追加。表示名やクライアント指定UIDを権限判定に使わない。

- [ ] まずEmulatorの架空2利用者で「他人の付箋読書きを拒否」「ルーム外・未承認拒否」「本人の許可操作」を期待する失敗テストを追加。
- [ ] `npm run test:rules:v577` で現行Rulesが失敗することを確認。
- [ ] 個人付箋ノード以下だけを有効化する厳格なRulesとデータ検証を追加。
- [ ] 再テストし、既存の全Rules試験も通過することを確認。
- [ ] 本番Rules・Auth設定は変更せずコミット。

### Task 2: 共通付箋データサービス

**Files:**
- Create: `personal-sticky-core-v659.js`
- Create: `personal-sticky-store-v659.js`
- Create: `tests/personal-sticky-core.spec.mjs`
- Create: `test-harness/personal-sticky-firebase-v659.mjs`（既存Emulator検査から呼出し）

**Interfaces:**
- `subscribe(listener): unsubscribe`
- `readSnapshot(): { status, ownerRoom, ownerUid, notes }`
- `dispatch({ type, id, expectedRevision, value, ownerRoom, ownerUid }): Promise<{ok,error?,revision?}>`
- 更新種類: `sticky.create` / `sticky.content` / `sticky.appearance` / `sticky.layout` / `sticky.mobile` / `sticky.delete`。
- Auth失効・UID変更時は購読を停止し、画面表示用データと編集中の下書きを消去。

- [ ] 先に本文・色・位置・順序の独立revisionと入出力検証の単体テストを追加する。
- [ ] 失敗することを確認してからcoreを実装。
- [ ] 認証済みユーザーと認可対象のルームだけFirebase購読を許すstoreを追加。
- [ ] 本文はRevision一致、位置は独立の競合処理、削除は編集中の改訂をチェック。
- [ ] DB接続断は未保存扱い。localStorage・IndexedDBに本文を保存しない。
- [ ] Emulatorで別利用者拒否、同時保存、ログアウト、競合を検証してコミット。

### Task 3: Origin専用付箋画面

**Files:**
- Create: `origin-personal-sticky-v659.js`
- Create: `origin-personal-sticky-v659.css`（必要ならOrigin ShadowRoot内に1回だけ導入）
- Modify: `origin-modern-v372.js`（メモタブの切替接続と状態管理）
- Create: `tests/origin-personal-sticky.spec.mjs`

**Interfaces:** Task 2の `subscribe/readSnapshot/dispatch` のみを呼び出す。Origin表示の個人付箋・業務メモの切替状態は本文とは分ける。

- [ ] まずPlaywrightで「切替」「追加」「本文編集」「色」「移動」「サイズ」「検索」「削除」「スマホ」を期待する失敗ケースを追加。
- [ ] メモ入口の既存タブ構造を壊さずに個人付箋へ切り替え、現行業務メモはそのまま維持。
- [ ] PCの1400x900論理ボードにカード自由配置。ドラッグはヘッダーのみ、保存は移動完了時のみ、Escで取消。
- [ ] 付箋のフォーカス、IME、保存状態を購読再描画から保護。
- [ ] 767px以下は一覧で順序だけ変更。PCの配置座標を上書きしない。
- [ ] 認証が不明なら内容なしの「利用できません」表示とし、入力を開始させない。
- [ ] 320/390/768/1366pxと200%相当、キーボード、reduced-motionで検証してコミット。

### Task 4: 配布・回帰・公開判定

**Files:**
- Modify: `release-manifest.js` / `config.js`（必要な追加アセットのみ正本へ登録）
- Modify: `patch-responsibilities.json`（所有者・バージョン）
- Modify: `docs/ORIGIN_FEATURE_PARITY_20261109.md`（追加機能の受入記録）
- Test: `npm run test:protocol` / `npm run test:ui` / `npm run test:firebase` / `npm run test:rules:v577`

- [ ] リリース資産と起動順を検証する失敗テストを先に追加。
- [ ] Origin選択時のみ新UIアセットをロードし、Classic/JOURNALは現状維持。
- [ ] 全試験成功、差分監査、実ブラウザ回帰、ビルド確認を実施。
- [ ] 本番のFirebase認証・RulesのGO判断と復元できるDBバックアップが未完なら公開しない。
- [ ] 条件を満たす場合だけPR exact-head検査・mainマージ・Pages公開・同SHA確認。
- [ ] 失敗した場合はブランチを公開せず保存し、元のcheckpointを維持する。

## 現在の実施状況

- [x] `main` の作業開始時点 SHA `352457b05fdd45190f8793901a5ee11ac74ae84f` を確認。
- [x] GitHubバックアップブランチ `backup/pre-origin-sticky-20261121-352457b` を作成。
- [x] 作業ブランチ `feature/origin-personal-sticky-20261121` を作成。
- [ ] 認証分離の実装と検証。
- [ ] 共通データ保存処理。
- [ ] Origin専用UI。
- [ ] 完全な回帰・公開判定。

**判断:** 本番の権限境界がNO_GOのため、認証なしの『個人用』付箋を本番公開する近道を選ばない。作業ブランチでのテスト・実装と、本番利用開始を区別する。
