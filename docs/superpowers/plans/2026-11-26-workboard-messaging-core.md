# 業務管理ボード — Messaging Core Implementation Plan（第2工程）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Originに実際の利用者間で利用できるメッセージ機能の土台・主要機能を整備し、次のSupabase添付工程へ引き渡す。まだ本番には公開しない。

**Architecture:** Firebase RTDBの独立会話領域を正本とし、承認済みpersonIdを軸に共通モジュールとOriginのShadow DOM画面を分離する。新規会話の認可は旧roomsの包括的許可に依存しない。ルールで検証できる本人操作は本人のFirebaseトークンで実行し、複雑な所属変更・派生情報の整合がクライアントだけで保証できない場合に限りSupabase Edge等の限定コマンドAPIを用いる。

**Tech Stack:** 現行ES modules / vanilla JavaScript / Firebase SDK・Realtime Database・Authentication / Node test runner / Playwright Chromium / Firebase Local Emulator Suite。必要なサーバー処理はSupabase Freeで実証し、課金サービスを増設しない。既存の開発環境と依存バージョンを優先。

**Spec:** [詳細設計書](../specs/2026-11-26-workboard-messaging-design.md)（設計コミット 9908dfa8108e9b7361f681e9682f023c58503cad）。基準本番 Ver.675 / fdbe111e11f45cc747dc4af68f791609dcb3e63f。第1工程後の利用者指示で第2工程への移行を承認済み。本書は第2工程の実装計画案。

## Global Constraints

- 1対1・自分宛て・任意名グループ、引用返信、編集/削除、既読/未読、通知、リアクション、検索、下書き、確認依頼、ブックマーク、共有固定、状態管理、共有一覧、日次業務報告、業務からの共有とメッセージからのタスク/予定作成を削らない。
- 旧タスク・予定・業務メモ・受信箱・付箋・同期/競合仕様を変更しない。業務の正本には既存bridgeを利用。Paletteという名称の共通bridgeも維持する。
- roomIdは既存の正規値を使用、表示名を本人性とみなさない。承認済み不変personIdで認可し、旧rooms外に会話領域を置く。未承認・異なる表示利用者・他room・非参加・退会・失効は拒否。
- 初回メッセージ公開は全体ログイン実装より先。ただし匿名Auth端末承認は会話機能の安全境界として準備する。未成立なら架空データ限定。実データ、本番Rules/設定、課金、公開の変更はこの工程では禁止。
- 最新50件・過去50件単位、active会話のみライブ購読。加入後の履歴のみ、同時刻は加入後と扱わない。全履歴/全room購読なし。本文6000文字。公開済みデータ構造に未承認の破壊的移行をしない。
- ファイル実体は第3工程のSupabase Free private Storageのみ。5MB/件・5件/メッセージ、画像200–500KB目安、保存＋予約800MB、600MB警告・720MB整理、20MB/日/利用者、配信月4GB目安を引継ぐ。第2工程では未実装のファイル送受信を成功扱いしない。
- 登録100人・1人100会話・会話10,000件・同時50セッション相当を設計検証目標にする。無料枠でこの人数を保証しない。既存Firebaseと接続/通信量を共有。
- Origin専用UI。Hallmarkを主軸に必要な補助スキルを使用。320/390/1366px・ライト/ダーク・キーボード・日本語IME・操作対象44px・reduced-motion。第8工程まで他テーマのUIは触らない。
- 実装は小分け、テストRED→GREEN→回帰→コミット。試験用データのみ。認可・全体回帰が未完なら公開・main統合を行わない。資格情報をソースやログへ書かない。
- パスは本書で予約する新規ファイル名（既存との衝突を実装時に再確認）。共通ロジックの一重化を優先。新しいrelease番号は第4工程の直前に最新mainと照合して確定する。

## Review Focus

1. 送信応答喪失後の再送・同じ要求IDで内容を変える・2端末競合 → Task 3で1件のみ作成、異内容拒否、revision競合、失敗時下書き維持。
2. 加入と退会の境界・同時刻・過去引用や件名、検索/一覧からの漏えい → Task 2・4・6で実DB Rulesのdenyおよび安全な参照取得を確認。
3. 既読カーソルが古い端末/非前面で戻る、ページ境界同時刻で欠落 → Task 3・5で同時刻2件、古いカーソル、可視条件を確認。
4. アカウント切替/端末失効直後に遅れて到着する購読コールバックと下書き → Task 1・5・7で世代ガード、購読解除、他人の下書き非表示を確認。
5. 業務メモやタスクの権限喪失/削除、完了日時の欠損、IME変換中のEnter → Task 6・7・8で元件名非露出、報告誤集計防止、誤送信防止を確認。

## Subproject boundaries and file map

この計画は第2工程だけを実装可能なタスクに分ける。第3工程（Storage、Edgeの添付処理、容量/通信予約、実体整合・復旧）と第5–6工程（全体ログイン・既存DB移行）は独立した計画を作成し、その依存契約とゲートをTask 9に記載する。第4工程以前に本番公開しない。

| ファイル | 責務 |
|---|---|
| `workspace-messaging-core.js` | ID・スキーマ・cursor・メッセージ/確認/会話状態の純粋ドメイン |
| `workspace-messaging-session.js` | 既存Firebaseアプリ上のAuthと承認binding、世代・購読失効 |
| `security/database.rules.messaging.candidate.json` / `firebase.messaging.candidate.json` | Emulator専用の会話アクセス候補Rulesと隔離設定 |
| `test-harness/messaging-rules-emulator.mjs` | 架空UID/roomによる実Rulesの許可・拒否と競合試験 |
| `workspace-messaging-store.js` | Firebaseの読取/限定更新、50件ページ、再送、状態/購読管理 |
| `workspace-messaging-commands.js` | 安全な会話作成/所属/派生状態コマンド。権限はRules/信頼境界で検証 |
| `workspace-messaging-refs.js` | 既存bridgeを使う業務参照・引用・共有一覧・復帰 |
| `workspace-messaging-report.js` | 既存業務データに基づく日次報告と業務作成の下書き |
| `origin-messaging.js` / `origin-messaging.css` | Originの専用ワークスペース・操作・レスポンシブ表示 |
| `origin-modern-v372.js` | 既存Shadow DOMの入口/画面遷移/業務詳細復帰への必要最小変更 |
| `test-harness/messaging-*.test.mjs` | 直接配置で既存run-protocol.mjsの自動発見に乗せる |
| `tests/origin-messaging*.spec.mjs` | Playwrightの操作・外観・回帰 |
| `package.json`, `.github/workflows/regression-checks.yml` | 必要なEmulator/ブラウザ検査追加とscope判定。既存テスト削減禁止 |

新規製品資産は第2・第3工程中、`test-harness/messaging-preview/` に単一正本として配置する。以下の新規 `workspace-messaging-*.js`・`origin-messaging.js/css` はこのディレクトリを基準とする（既存ファイルへの変更は明示パスのまま）。Protocolテストからは `./messaging-preview/` で参照する。現行Pagesは未宣言のルートJS/CSSを拒否するため、ルートに未登録資産を置かない。第4工程（初回公開）で同一ファイルをルートへ移動し、import・manifest・責務台帳を同時更新する。旧試作用コピーを残さない。実ブラウザ試験用の隔離entryを使用する。既存Originへの入口を接続する際は、機能フラグ既定offと実験用環境からのみ有効にする。ローカルフラグはサーバー認可の代替ではない。公開前にmanifest・責務台帳・Pages stagingとの整合を検証する。

---

### Task 1: 不変ID・session境界（最初の実装単位）

**Files:** Create `workspace-messaging-core.js`, `workspace-messaging-session.js`; Test `test-harness/messaging-core.test.mjs`, `test-harness/messaging-session.test.mjs`。参照 `security/staged-identity-session-v579.mjs`, `personal-sticky-store-v659.js`, `user-registration-v191.js`。後二者を本人認証として流用しない。

**Interfaces:**
- `isPersonId(value): boolean`（p_ + lowercase hex UUID32桁）。
- `conversationIdFor({roomId,kind,personIds,groupId?}): string`。room scope内でdm_<sort済2 IDs>、self_<ID>、group_<g_ + UUID32>。IDの生成はcrypto、表示名から生成禁止。不正ID/人数/重複は例外。
- `resolveMessagingIdentity({uid,roomId,selectedDisplayName}, binding): {status:'bound'|'locked',personId?,roomId?}`。bindingは運用者承認のread結果、uid/roomId/personId/displayName/approved/activeを照合。これはUIの補助で認可そのものではない。
- `createMessagingSession({getAuthUid,readBinding,observeAuth,observeBinding,onLock}): {setContext,subscribe,getSnapshot,dispose}`。世代ごとに購読解除、古い結果を無視。未知/失敗/失効でlockし機密状態を消去。

- [ ] RED: 先行testでIDの順序非依存・名前変更無関係・不正ID拒否を固定。
```js
const a='p_'+ 'a'.repeat(32), b='p_'+ 'b'.repeat(32);
assert.equal(conversationIdFor({roomId:'r',kind:'direct',personIds:[b,a]}),'dm_'+a+'_'+b);
assert.equal(conversationIdFor({roomId:'r',kind:'self',personIds:[a]}),'self_'+a);
assert.throws(()=>conversationIdFor({roomId:'r',kind:'direct',personIds:[a,a]}));
```
sessionは承認なし、UID/room/表示名不一致、同じ表示名の別UID、失効、A→B切替後にAのread完了を再現。期待はlockedまたはBだけ、購読解除済み。秘密をログへ出さない。
- [ ] 実行 `node --test test-harness/messaging-core.test.mjs test-harness/messaging-session.test.mjs`。未実装で意図した失敗を確認。
- [ ] GREEN: 上記モジュールを実装。既存登録名は表示専用。bindingは手入力で付与できない。境界切替はfail closed。
- [ ] 同コマンド、`npm run test:protocol`で失敗0。レビュー後 `git add workspace-messaging-core.js workspace-messaging-session.js test-harness/messaging-core.test.mjs test-harness/messaging-session.test.mjs && git commit -m "feat: establish messaging identity contract"`。

### Task 2: 実Rules・信頼境界の成立を先に証明

**Files:** Create `security/database.rules.messaging.candidate.json`, `firebase.messaging.candidate.json`, `test-harness/messaging-rules-emulator.mjs`。Modify `package.json`, `.github/workflows/regression-checks.yml`のauth jobとscope。

**Interfaces:** 運用者専用 `messagingAccessV1/{roomId}/{uid}`（承認済みbinding、クライアントwrite deny）。`messagingV1/{roomId}/control/{conversationId}`（小さい所属/会話制御）、`.../messages/{conversationId}/{messageId}`（履歴、createdAt index）、`.../personal/{personId}`（個人状態、下位ごとアクセス）。ルート・旧roomsへの許可追加禁止。既存Rulesは変更しない。物理pathはこのスパイクの合格時に本書を更新して確定する。

**Write strategy:** 本人操作は本人トークンによる書込みで、Rulesがコミット時にactive membership・本人性・immutable fields・revision・サイズ/型・時刻を判定。所属変更等の複雑なコマンドがRules単独で安全に実現できない場合、限定された信頼サーバーで小さいcontrol nodeだけをCAS更新する。特権経由のcheck-then-writeで退会/失効をすり抜けないことを証明する。サービス用の管理キーをブラウザに置かず、本番の広いAdmin権限は流用しない。外部JWT・Edge制限・失効照会は第3工程に向けて隔離実機確認。実装可能性のない条件を成功扱いしない。

- [ ] RED: `@firebase/rules-unit-testing`で認証なし/無承認/別room/別UID/非参加/加入前/同時刻/退会/再招待/自己昇格/無制限query/直接台帳書換えをdeny。許可される本人の正当な限定query/送信/既読をallow。架空のauth/projectとデータだけ使用。
```js
await assertFails(get(ref(unapprovedDb,'messagingV1/r/messages/g')));
await assertFails(get(query(ref(memberDb,'messagingV1/r/messages/g'),orderByChild('createdAt'),limitToLast(50))));
await assertSucceeds(get(query(ref(memberDb,'messagingV1/r/messages/g'),orderByChild('createdAt'),startAt(1001),limitToLast(50))));
await assertFails(get(ref(memberDb,'messagingV1/r/messages/g/prejoin')));
```
fixtureの加入時刻1000、prejoinは1000以下。51件・欠けた境界・異なるorder、ページカーソル、同時刻の2件、権限の変更と送信/編集が同時の場合も検証。引用・件名・添付の生データを親readで漏らさない。RTDB Rulesはfilterでない。
- [ ] 初期deny-only候補で正当操作が失敗すること、旧roomsのallowが新領域へ伝播しないことを確認。隔離script追加: `npm run test:messaging:rules` = `firebase emulators:exec --only auth,database --project demo-task-kanri-messaging --config firebase.messaging.candidate.json "node test-harness/messaging-rules-emulator.mjs"`。localhost限定・demo project guardを置く。
- [ ] GREEN: Rules・小さいcontrol契約・`createdAt` indexを最小実装。query.startAtがjoin時刻+1に厳密一致し上限50（過去ページはendBeforeで制限。開始値の動的数値比較をEmulatorが拒否したため固定境界へ変更。実機で証明）。単件readも同じ時刻制約、親にallowなし。ServerTimestampはRulesで評価される実際の値をテスト。正当なページ取得がRulesで実現できないなら別経路を設計し、回避のためルールを緩めない。
- [ ] 同script、`npm run test:protocol`、既存認可Emulatorを実行。Rules条件/同時書込/atomic fanout/CASを検証。RESTのif-matchはPUT/DELETE用でPATCH非対応のため、複数パスを条件付きPATCHに依存させない。複数正本にまたがる派生更新は冪等な修復を設計。試験結果と確定pathを本書に追記。
- [ ] 信頼境界の成立が確認できなければ後続で実データの送受信は無効のまま。候補ファイルのみコミットし、auth jobの回帰を成功させる。

### Task 3: 送受信・ページング・再送

**Files:** Modify `workspace-messaging-core.js`; Create `workspace-messaging-store.js`; Test `test-harness/messaging-store.test.mjs`; extend `test-harness/messaging-rules-emulator.mjs`。

**Interfaces:**
- `validateMessageInput({body,replyTo?,refs?,attachmentIds?,confirmationRequested?}): normalized`。本文最大6000、空白のみかつ他要素なし拒否、HTMLとして解釈しない、参照の型/長さ制限。第2工程はattachmentIdsを空以外で拒否。
- `compareCursor({createdAt,id},{createdAt,id}): -1|0|1`、`advanceReadCursor(current,next): cursor`。同時刻ID決着。
- `createMessagingStore({session,transport,clock}): {getSnapshot,subscribe,setActiveConversation,loadOlder,send,edit,remove,markRead,dispose}`。transportはTask 2確定の本人経路をwrap。send({conversationId,requestId,input}) → Promise<{status:'sent'|'failed'|'locked'|'conflict',id?}>。
- messageIdはsenderId + requestIdの決定的なID。senderIdは認可境界で確定。要求内容を変えた再送を拒否、既存messageを無断上書きしない。revisionは1始まり。編集/削除はexpectedRevision。引用の本文・送信時件名は直接読み取れるメッセージに無条件で複製しない（Task 6）。

- [ ] RED: 同一要求を同時に2回/応答喪失後に再送→保存1件・同じID。異内容同ID→conflict。編集revision競合→新値保持。6010文字/空白のみ/不正ref/非参加→拒否。既読後に古い端末から戻す→不変。削除は墓標で本文・添付参照を非表示。
```js
assert.equal(compareCursor({createdAt:10,id:'a'},{createdAt:10,id:'b'}),-1);
assert.deepEqual(advanceReadCursor({createdAt:10,id:'b'},{createdAt:10,id:'a'}),{createdAt:10,id:'b'});
```
10001件fixtureで最新50、ページ境界同時刻・最終ページ・join前のデータ、切替後の古い応答、購読数、通信失敗時のdraft保持を検証。
- [ ] `node --test test-harness/messaging-core.test.mjs test-harness/messaging-store.test.mjs` で意図したRED。
- [ ] GREEN: 単一store、active会話購読1つ、ページloadはcursorを重ねず欠落も防ぐ。最後の50件以外は要求時取得。local-onlyを共有送信成功にしない。安全な再送とCASを実装。
- [ ] 同コマンド＋Rules Emulator＋Protocol。実際のSDKの保存・再取得・競合を確認しコミット。

### Task 4: 1対1・自分・グループ管理

**Files:** Create `workspace-messaging-commands.js`; Modify core/store/Rules候補・Emulator; Test `test-harness/messaging-conversations.test.mjs`。

**Interfaces:** `createMessagingCommands({session,commandTransport}): {openDirect(personId),openSelf(),createGroup({title,invitees}),invite({conversationId,personIds}),respondInvite({conversationId,accept}),rename({conversationId,title,expectedRevision}),transferOwner(...),removeMember(...),leave(...),setGroupArchived(...)}`。戻りはPromise<{status:'ok'|'forbidden'|'conflict'|'failed',conversationId?}>。グループ名1–80文字、グループ参加上限は設計検証100人。承認された同一roomのpersonIdだけを招待。controlのrole owner/admin/member、invite pending/accepted/declined、加入境界の時刻。direct/self一意、グループはownerを必ず1名。

- [ ] RED: 同じ相手で同時作成→同じ会話、自分宛て1件。未承諾招待→過去閲覧/送信不可、受諾後→新着だけ。メンバーによる自己昇格/他人招待/owner退会→拒否。移譲→旧owner退会可。除外直後の送信/取得→deny。アーカイブ中は既存メッセージ閲覧可/送信不可、再開。再参加で古い履歴を読めない。
```js
assert.equal((await commands.openDirect(b)).conversationId,(await commands.openDirect(b)).conversationId);
assert.equal((await uninvitedCommands.respondInvite({conversationId:g,accept:true})).status,'forbidden');
```
- [ ] `node --test test-harness/messaging-conversations.test.mjs` でRED。
- [ ] GREEN: Task 2の信頼境界と小さいcontrolのCASを用い、索引は派生とする。参加と送信の競合を処理し、全履歴のtransaction/無条件上書きを行わない。
- [ ] 同テスト、Emulatorで2人以上・同時操作、Protocolを実行しコミット。

### Task 5: 個人状態・既読・通知・確認依頼・固定

**Files:** Modify core/store/commands/Rules; Create `workspace-messaging-notifications.js`; Test `test-harness/messaging-state.test.mjs`。既存 `workspace-inbox-event-v543.js`, `workspace-inbox-read-v542.js`, `workflow-v152.js` を参照。

**Interfaces:** storeに `setPersonalState(conversationId,patch)`, `toggleBookmark(messageId)`, `toggleReaction(messageId,reaction)`, `confirmMessage(messageId,round)`, commandsに `pinMessage(...)`。状態は本人のみ書込み。確認roundと対象personIdsは送信時に固定、確認時刻を保存、依頼本文変更でroundを更新。 `createMessagingNotificationAdapter({store,notify})` は会話専用未読・招待通知を受け取り重複発行せず解除可能。通常受信箱の書込み処理は変更しない。

- [ ] RED: favorite/mute/archiveは自分だけ、ミュートで未読消えない。本人送信・非表示画面で未読を誤更新しない。99+、古い既読カーソル、下書きの利用者分離。既読だけでは確認されず、明示確認は対象本人のみ、再送/重複クリック1件。依頼編集で旧round不可、退会状態区別。bookmark個人のみ・共有pin権限、削除メッセージのpin/引用/共有一覧の非表示。リアクション本人一意。招待/新着通知再接続で重複なし。
```js
assert.equal((await memberStore.confirmMessage(id,1)).status,'ok');
assert.equal((await otherStore.confirmMessage(id,1)).status,'forbidden');
```
- [ ] `node --test test-harness/messaging-state.test.mjs` RED。
- [ ] GREEN: 個人/共有状態の保存単位と認可を実装。既読カーソルを正本、人数×全履歴の複製なし。会話一覧要約は派生、加入前の本文/件名を要約に持たない。確認済みと既読を混同しない。
- [ ] 同テスト、Emulator・Protocol。旧受信箱と既存コメントへの回帰検査を追加しコミット。

### Task 6: 業務参照・引用・共有一覧・検索

**Files:** Create `workspace-messaging-refs.js`; Modify store/commands; Test `test-harness/messaging-refs.test.mjs`。Read `origin-modern-v372.js` 内のbridge.readSnapshot/memoBridge.readSnapshot/dispatch、現行 `workspace-core-v537.js` と対応bridgeの宣言・テストを検索し型を確定（実装前に行番号/実際のコマンド名を本書へ記録、APIを推測で追加しない）。

**Interfaces:** `createMessagingReferenceResolver({readTask,readSchedule,readMemo,canRead,readMessage,openRecord,restoreConversation}): {resolve,resolveQuote,shareRecord,open,restore}`。
`resolve({roomId,type:'task'|'schedule'|'memo',recordId},context): {status:'available',title,currentState,...}|{status:'unavailable'}`。参照はID。送信時件名/引用抜粋が必要なら別の権限照合済み経路で取得、閲覧権限を失っても生の件名をメッセージ/一覧/索引から読める設計は禁止。
`selectSharedData(messages,{type,from,to,limit}): rows`、`searchLoadedMessages(messages,{query,from,to,senderId,limit}): {matches,scope:'loaded'}`。古い範囲はページ追加検索、全件検索と偽らない。

- [ ] RED: task/schedule/memoの複数参照、正本の更新・削除・別room・権限失効→available/unavailable。過去引用の元メッセージが加入前/削除→本文なし。権限を失った送信時件名を一覧/検索でも露出しない。共有一覧の種類・期間・元メッセージ復帰、会話のスクロール位置/検索条件。検索HTMLを文字列として安全に表示。
```js
const x=await resolver.resolve({roomId:'r',type:'task',recordId:'t1'},deniedContext);
assert.deepEqual(x,{status:'unavailable'});
assert.equal(JSON.stringify(x).includes('非公開の件名'),false);
```
- [ ] `node --test test-harness/messaging-refs.test.mjs` RED。
- [ ] GREEN: 既存業務読み取り契約をwrapし、ID/件名の権限制御と削除時を扱う。検索は許可済み取得範囲のみ。リゾルバの戻り先を会話コンテキストで保持する。
- [ ] 同テスト、実Rulesと既存業務詳細のPlaywright回帰、Protocol。コミット。

### Task 7: Originワークスペース・操作の統合

**Files:** Create `origin-messaging.js`, `origin-messaging.css`, `tests/origin-messaging.spec.mjs`, `test-harness/messaging-preview/index.html`（必要時の隔離entry。配信対象外）； Modify `origin-modern-v372.js` の既存navigation/bridge接続部のみ。

**Interfaces:** `mountOriginMessaging({root,store,session,commands,resolver,onClose,openBusinessDetail}): {open,close,dispose}`。rootはOrigin Shadow DOM。外側の業務画面に新しい保存処理を作らない。既定offの機能フラグ、架空データfixtureで初回検証。業務詳細から共有、会話へ復帰。

- [ ] デザインレビュー: Hallmarkを主軸とし、既存Originの変数・書体・配色を抽出。PCは会話一覧＋会話本文＋閉じられる共有サイド、スマホは一覧→会話→共有。独立入口と未読、右側詳細は常時表示しない。機能ラベルは日本語、操作ラベルとアイコン。長文・空状態・エラー・送信中・新着・履歴を考慮。
- [ ] RED: Playwrightの3幅と2テーマで入口、1対1/自分/グループ、招待、本文/返信/編集/削除/リアクション、検索・共有、既読・確認・bookmark/pin・お気に入り/mute/archive。フォーカス復帰・戻る・IME・入力保持・失敗再送・別ユーザー切替の検査。
```js
await expect(page.getByRole('button',{name:'メッセージ'})).toBeVisible();
// 変換中のEnterは送信しない
await composer.dispatchEvent('keydown',{key:'Enter',isComposing:true});
await expect(messageList.getByText('未確定の文',{exact:true})).toHaveCount(0);
```
UIテストは制御可能な架空storeを用いるものとEmulatorで実際の送受信を確認するものを分離。試作に対する成功を本番接続の成功に置き換えない。
- [ ] `npx playwright test tests/origin-messaging.spec.mjs` RED。
- [ ] GREEN: 起動/破棄で購読1つ・フォーカス管理。画面にtextContent等で文字を安全に表示。日本語IME/キーボード/44px/色コントラスト・reduced-motion。直近メッセージを保つ、新着で過去閲覧中にスクロールを奪わない。添付は未実装と明示して送信不可、業務参照は動作。テスト用秘密や架空ユーザーを実画面に残さない。
- [ ] 同Playwrightを全対象幅で成功させ、スクリーンショット実査、既存Origin・Classic/JOURNAL回帰、Protocolを確認。不要な旧UI・重複イベントを整理しコミット。

### Task 8: 日次業務報告・メッセージからの業務作成

**Files:** Create `workspace-messaging-report.js`, `test-harness/messaging-report.test.mjs`, `tests/origin-messaging-report.spec.mjs`。Modify Origin UI、refs、既存bridge接続部のみ。

**Interfaces:** `buildDailyReport({dayISO,personId,tasks,schedules,resolvePerson,completionDateOf}): {completedTasks,plannedSchedules,inProgress,unknownCompletion,body,refs}`。既存業務の実データ型を読み、完了時刻が存在しない場合は推測せずunknownCompletionへ。予定と実施は区別。 `prepareBusinessDraftFromMessage(message,{kind:'task'|'schedule',canRead}): draft`。業務の実作成は既存新規作成画面でユーザー確認、既存保存経路のみ。

- [ ] RED: 予定日に完了したと推測しない、別担当者の完了混入なし、対象選択・補足・日付変更、下書きのみで自動送信なし。メッセージから新規作成/キャンセル/保存失敗、元会話位置復元、権限喪失時の参照不可。
```js
assert.equal(report.completedTasks.some(t=>t.id==='no-completion-date'),false);
assert.equal(report.unknownCompletion.some(t=>t.id==='no-completion-date'),true);
```
- [ ] `node --test test-harness/messaging-report.test.mjs`、`npx playwright test tests/origin-messaging-report.spec.mjs` RED。
- [ ] GREEN: AI/API不要の決定的な集計、利用者が編集・選択・送信。既存タスク/予定作成bridgeに渡し、重複作成を防ぐ。
- [ ] 同テスト＋Protocol・既存作成/保存の回帰。コミット。

### Task 9: 第2工程の受入・第3工程引渡し

**Files:** Modify 本計画の実績・設計書の確定事項・検証記録のみ必要箇所。Create `test-harness/messaging-scale.test.mjs`、必要なEmulator負荷fixture。実際の利用者情報を含まない。

**Interfaces:** 後続用 `AttachmentStorage` 契約: `reserve({roomId,conversationId,requestId,filename,bytes,mime}): Promise<{attachmentId,status}>`、`upload({attachmentId,blob}): Promise<{status,bytes,sha256}>`、`attach({attachmentId,messageId,requestId}): Promise<{status}>`、`download({attachmentId}): Promise<Blob>`、`remove({attachmentId}): Promise<{status}>`。呼出側が本人性を宣言するだけで許可しない。取得時も実Auth・承認・最新会話所属/加入時点確認。第2工程は実装せず、第3工程の契約テストで具体化する。

- [ ] 登録100人・会話一覧100件・履歴10,000件・同時50セッション相当の合成fixture。最大ページ50件、非active会話の履歴購読0、active1、解除済みコールバックを無視、未読カーソルの保存件数がメッセージ数×参加者数に増えない、会話切替と同期を計測。取得バイト・購読数・速度・負荷を報告、実測なしに性能保証しない。
- [ ] `node --test test-harness/messaging-scale.test.mjs`、`npm run test:protocol`、`npm run test:messaging:rules`、既存Auth/Firebase suite、`npm run test:ui`、CI required gateを確認。未実施/skip/失敗を明記。既存公開manifest/責務台帳が変更されていないことを確認。
- [ ] exact-head差分レビュー（独立担当が利用不可なら自分のレビューであることを明示）、全要件表の達成/未達、実ブラウザQA。未達がある場合は「第2工程完了」としない。開発ブランチにコミットしmain・Pages未公開の状態を維持。

## Subsequent plans and release gates

| 工程 | 次の計画が必ず扱う事項 | Gate |
|---|---|---|
| 第3工程 添付 | Supabase Free契約・環境設定（運用者）、外部JWT/認可、private bucket、Postgres原子予約、形式・実バイト検査、孤立/失敗/削除整合、容量/通信・圧縮・D&D・貼付・ダウンロード、バックアップ/復元。Edge制約に収まるか隔離実機。 | 無料枠を迂回できない、権限なしの直接取得/アップロードdeny、実体と参照の復旧、非機密試験成功。課金なし。 |
| 第4工程 第1回公開 | 暫定匿名Auth端末承認・失効手順、実環境Rules/利用量/復元の確認、機能フラグ、manifest/asset/責務台帳、最新mainとの整合、PR/Pages/回帰。 | 認可と濫用対策成立時のみ限定実運用。未成立なら架空データ限定。全体ログインはまだ実施しない。 |
| 第5–6工程 正式ログインと総合検証 | 既存認証NO_GO文書・roomsV2候補の再評価、明示的UID→personId移行、復元試験済みバックアップ、アカウント/招待/権限失効、旧端末/旧Rules停止、ログアウト時の保護、別room/加入前/退会の越境拒否。 | 正式な運用者承認とNO_GO解除、バックアップ/復元、全認可・業務・会話・添付試験成功。 |
| 第7工程 第2回公開 | 正式認証を含むOrigin公開、同SHA CI/Pages確認、利用者確認。 | 全体回帰と配信確認成功。 |
| 第8工程 他テーマ | Classic/JOURNALの独自UIで同一store/commands/権限/添付APIを利用。 | 全機能のテーマ横断回帰・配信確認。 |

## Plan review and evidence

- 設計書§1/4/5の全機能をTask 3–8へ割当。§2/3/8の現行・認可・責務はTask 1–3/9。§6は独立した第3工程に引継ぎ。§7/9/10/11はTask 9と公開ゲートへ割当。
- `run-protocol.mjs` は直下の *.test.mjs を自動収集することを確認。Playwrightはtests/、既存静的サーバー、Chromiumを利用。既存認証候補は未公開、本人性の検査資産として活用し本番Rulesをそのまま変更しない。
- Firebase公式確認: [条件付きREST更新](https://firebase.google.com/docs/database/rest/save-data)、[REST仕様](https://firebase.google.com/docs/reference/rest/database)、[クエリに基づくRules](https://firebase.google.com/docs/database/security/rules-conditions?hl=ja)、[Supabase Edge制限](https://supabase.com/docs/guides/functions/limits)。未検証の方式はTask 2で実際に証明する。
- この段階は計画のみ。実装・Emulator・Supabase実設定・本番公開・独立レビューは未実施。第2工程の最初の作業はTask 1のREDテスト。Task 2の認可成立前に本番送受信を許可しない。

## 2026-11-26 検証結果と設計補正（未公開）

- Task 1の不変ID・セッションと、Task 3の純粋な入力/カーソル/送信要求ID契約を実装（ローカルNode 18/18）。未公開モジュールはtest-harness/messaging-preview/へ隔離。既存配信保護を維持。業務参照はIDのみ、初期最大20件（提案値）。本番認可・保存は未実装。
- CI 45728373760・45728573447 の診断: numeric query.startAtの等値は許可されたが `>` と `+0` の比較は拒否された。固定開始境界に変更した CI 45728760849 では過去メッセージの子階層への同条件queryがPERMISSION_DENIEDではなく索引未定義エラーとなった。これは閲覧漏えいの実証ではないが、親readの継承による危険を排除できないため、直接一覧readは採用しない。
- 決定: `messages/{conversationId}` 親readは常時deny。個別messageだけが本人/承認/所属/加入時刻条件でread可。全client write denyを維持。最新/過去ページの50件取得は、Supabase Free等の認証済み限定サーバーAPIが実施する（specの信頼経路への切替条件）。同時刻IDカーソル、本人・現membershipの取得前後の再照合、加入境界、限界50、削除・引用の権限、許可済み範囲のみ取得を実DBに対して証明する。信頼サービスの鍵はserver-sideのみ。SupabaseでのFirebaseトークン検証/権限失効と実装可否・無料枠を隔離環境で検証するまで実運用を禁止。
- Emulatorで許可されない一覧を成功させるためにRulesを緩めない。信頼経路の生query形状テストと個別readテストの成功は、サーバーAPIの認可成功と区別する。APIの認可・メッセージ作成/編集/削除・会話所属・一覧同期・通知は未実装。
- Firebase/Supabaseの実プロジェクト管理機能は接続未確認。実環境の設定や初回公開は未実施。第4・5工程（全体の正式ログイン以降）は着手しない。

## 2026-11-26 追加の記録と履歴サービス

- 将来のFirebase全体通信最適化は [Issue #1015](https://github.com/mfukutomi8028-oss/task-kanri/issues/1015) に登録。メッセージ機能と正式ログイン開発・検証完了後に実施。現行の必須ページング等は維持し、既存アプリ全体の最適化は本PRに混ぜない。
- Supabase Free東京プロジェクト接続済み。先行SQLで非公開bucket、容量予約、RLSを構築。ユーザーによるWindows上のFirebase CLIログインは確認されたが、このWebセッションへFirebase管理権限は移転していない。実環境操作は必要時に管理者に具体的な手順を提示する。
- `security/messaging-history-service.mjs` に限定されたサーバー側履歴取得を追加。Firebase Adminのトークン検証、承認binding・所属・加入時刻の検査、上限50件、同時刻IDカーソル、取得後の権限再照合、削除済み本文やキャッシュ件名の除去。ローカルNodeテスト26/26（新規8）。`test-harness/messaging-history-emulator.mjs` を既存の隔離Auth/RTDB検査へ追加。実際のサーバー配備・最小権限の実現、同時失効の厳密境界、書込み、Origin接続は未完了。本番Rulesは変更しない。

- Task 3: 共通クライアントストアを実装。active会話だけ購読、50件取得、履歴の重複・欠落防止、会話別メモリ下書き、同時送信要求集約、編集/削除結果のrevision照合、既読カーソル、再加入時の状態/下書き破棄。サーバーとクライアントの共通メッセージ射影・正規化処理をcoreへ集約した。41件のローカルNodeテスト成功（新規store 15件、10,000件の合成履歴を含む）。履歴サービスの実Firebase Admin/Auth/RTDB Emulator検査は直前のCI 45734719874で成功。書込み・既読の実Firebase transport、実購読・永続下書き、会話管理、全UI、添付API、本番接続は引き続き未実装。Mock/fixtureでの成功を実際の送信成功と扱わない。初回公開に進むまでは配信資産へ含めない。

- 中断後再開: `security/messaging-conversation-commands.mjs` に小さいcontrolノードの状態遷移を追加。direct/selfの一意ID、グループ新規作成、招待/承諾/辞退、名称変更、所有者移譲、除外/退出/再加入、archive/reopen、revision競合、100人（未承諾招待含む）上限。新規9件、ローカル全50件成功。直前CI 45735401958のProtocol 1,168件および認可・実Auth/RTDB履歴取得成功を確認。本処理は認証済みの信頼主体から渡されたcontextを前提とする純粋な状態遷移であり、実DBの原子的更新・本人資格のコミット時再検証・一覧索引・APIは未実装。実際の会話の作成・招待が可能になったとは扱わない。第2工程続行中、初回公開は未実施。
