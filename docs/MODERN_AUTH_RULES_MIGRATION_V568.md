# Ver.568–575 — Auth UID・ルーム権限・Firebase Rulesの安全移行設計（検証用候補）

対象：Draft PR #460、Security Issue #368、Ver.449監査。2026-10-31時点の**リポジトリ構成**を検査した工程であり、Firebase Console・本番Database・現行デプロイ済みRulesを監査した記録ではない。

## 結論：正式公開 NO-GO

現行 `app.js` は `room` パラメータと `systemTaskUser`（localStorage）でルーム/表示利用者を選択し、Firebase Authenticationによる本人確認をしていない。`firebase-rules.json` の `rooms/$roomId` は `.read:true/.write:true`。ただし**本番適用状態は未確認**であり、リポジトリ定義を実際の配布済み権限と同一視しない。

現行の `/rooms/$roomId` で `runTransaction` する処理と、同じルーム配下の個人ToDo/通知/リマインダーは、ルーム単位の広いread/writeを許す設計から直接安全な個人別権限に切り替えられない。親のread/write許可は子で取り消せない。認証の追加だけ・URLの秘密化だけ・表示名の制限だけでは解決しない。

**Ver.568の実装範囲**は独立した将来スキーマRulesの候補、独立EmulatorのAllow/Deny自動検証、Protocol監査、移行判断の設計である。**既存アプリ・既存Firebaseクライアント・本番Rules・旧Emulator・配布物・実データは変更しない。** 候補Rulesはそのまま本番適用してはならない。

## 採用候補と比較

| 方式 | 強み | 現時点の課題 | 判定 |
| --- | --- | --- | --- |
| A. Firebase Auth＋管理者のみ付与するUID/ルームmembership＋ルーム内共有とUID別個人データを分離 | 既存RTDB資産を継続しつつ最小権限に近づける | 既存全経路のデータ移行、room root transactionの解消、通知配送と監査の設計が必要 | **優先してstaging実証** |
| B. Firebase Auth＋サーバーAPI/Functionsに業務書込を集約 | 原子的な複数領域更新、監査、権限制御をサーバーに集約できる | 追加のサーバー運用・費用・可用性・保守負荷 | 原子的タスク化等でAだけでは維持できないときの有力代替 |
| C. 旧 `/rooms` を所属者へ一括許可し、個人領域だけ子ルールで制限 | 変更が小さい | 親許可が子へ継承されるため個人領域が保護できない | **不採用** |

## 現行→将来（検証用最小スキーマ）の境界

| 現行参照・操作 | Ver.568候補パス | 採用前の対応 |
| --- | --- | --- |
| `rooms/{room}/tasks`、`schedules` | `roomsV2/{room}/shared/tasks/{id}`、`.../schedules/{id}` | membershipに基づき共有閲覧。編集者/管理者のみ子レコード単位の書込。Ver.569で最小タスクのtitle/revisionだけを検証。Classicの全schema・削除後の関連整理は未設計 |
| `rooms/{room}/todos` | `roomsV2/{room}/personal/{auth.uid}/todos/{id}` | 認証UID本人＋所属確認でのみ読み書き。画面の表示名は権限に使わない |
| `rooms/{room}/workflowV152/inbox/{displayUser}` | `roomsV2/{room}/personal/{auth.uid}/inbox/{id}` ＋ `inboxRead/{id}` | 通知内容は本人閲覧のみ・クライアントからの通知捏造を拒否。既読は本人の専用パスへ。**通知配送は別途サーバー側の信頼経路が必要** |
| リマインダー | `roomsV2/{room}/personal/{auth.uid}/reminders/{taskId}` | 本人の保存範囲のみ確認。送信/通知時計とタスクの一貫性は未検証 |
| ルームの利用者、membership | `roomsV2/{room}/access/members/{auth.uid}` | 信頼できる管理操作のみ付与・失効。一般クライアントは自己登録/昇格不可。読む場合は本人のmembershipのみ |
| `rooms/{room}` 全体トランザクション、`meta`、`knowledge`、`taskStarts`、`workflowV148/V152`、関連データ一括整理 | **まだ移行先の操作仕様を決めていない** | 候補Rulesではクライアントの親ルームtransactionを拒否。Ver.570の検証用純粋関数は一括保存を模擬するが、既存Classic/Modernの全writer、通知・履歴を含む実運用移行は未設計 |

検証用ルール `security/database.rules.v568.candidate.json` は既存 `firebase-rules.json` の改訂版ではなく、**移行後の最小アクセス境界を確認するための分離された試作品**。Ver.569では将来用タスクのtitle/revisionと未知フィールドの拒否を部分的に検査するが、既存Classicの全フィールド、削除の原子性、予定・個人データの完全なschema、読み取りクエリ・索引、ログ、悪意のある編集者への全対策は未完了。ルールを通過しても製品権限が完成したとは判定しない。


## Ver.569：共有タスクの最小schema・改訂番号ゲートと保存経路の確認

**検証対象は将来用の `roomsV2/{room}/shared/tasks/{id}` のみ。** 既存のClassic taskモデルを置き換えたり、実DBのデータを書き換えたりしない。

- 候補Rulesに、最小タスクの `title`（1〜120文字）と数値・整数の `revision` を必須とし、作成はrevision=1、変更は直前のrevision+1とする検証を追加した。未知のフィールドは `$other` で拒否。ビューアーは編集不可、管理者もmembershipの自己変更は不可。
- **クライアントからのタスク物理削除は拒否**する。現行のタスク削除には予定/ナレッジ/関連通知の後続処理があり、この候補Rulesだけでは同一トランザクションの整合とrev衝突を保証できない。将来の正規削除経路が用意されるまでの意図的な未提供機能。
- Emulatorでは不正レコード、空・長すぎるタイトル、小数revision、旧revision再送、改訂番号を変えない子フィールド更新、未知フィールド、削除、編集者・管理者の正常更新を検証する。**許可・拒否ケースはいずれも実Emulatorの結果で判断し、Protocolの文字列チェックだけで合格扱いにしない。**
- 保存経路調査で次を確認：`app.js` の `transactionRoom`、`persistPromotedTaskV559`（タスク＋元ToDo）、`workspace-duplicate-atomic-v544.js`（2タスク＋workflow重複情報）、ナレッジ/予定との一括関連更新、`commitMetaAndTaskUpdates`、一括操作の一部。これらは現在 `rooms/{room}` を1回のトランザクションで更新している。将来スキーマのUID別ToDoと共有タスクでは、単なるFirebase参照先の置換では原子性を維持できない。
- **今後の採用判断**：A案（クライアント側の子単位書込）だけで扱える単一レコードCRUDと、B案（サーバー側の権限付き複数領域更新）が必要な一括操作を切り分ける。次の具体的設計には、サーバーが許可された操作の最小入力だけを受け、UID・membership・旧revision・関連レコードを信頼できる処理で再確認する必要がある。ブラウザの表示名/入力済みロール/新しい `role` フィールドを本人性の根拠にしない。

**未解消**：将来用に限定した２フィールドの試作品は現行Classicの実データモデルを保存できない。Firebase Auth、Rules/クラウドバックエンド、個人ToDo/通知の配送、旧クライアント、環境切替、バックアップ/復元、実端末受入と正式承認の完了までは**正式公開 NO-GO**を維持する。

## Ver.570：候補スキーマを同一ルーム配下へ再構成（認証・個人データ分離を維持）

Ver.568–569の候補では`roomsV2/{room}/shared`と`personalV2/{uid}/{room}`を別ルートにしていたため、両者の原子的な条件付き更新はDB全体のルートトランザクションに波及する設計だった。拡張性・競合・データ量に問題があるため、**この検証用候補の既存Rulesを直接修正し、別ルートの`personalV2`と`access`の候補を撤去**した。

現在の候補は`roomsV2/{room}`配下に`shared/tasks`・`shared/schedules`・`personal/{uid}/todos`・`personal/{uid}/inbox`・`access/members/{uid}`を配置する。親ルーム`.read/.write`は許可しない。共有領域は所属者の読み取り・編集者の必要最小限の書き込みに限定し、個人データはAuth UID本人の子パスだけ許す。membershipの自己付与/昇格を拒否し、将来の再送防止マーカー`operations/promotions`をクライアントには一切公開しない。

### 信頼済みサーバー側の一括保存候補

`security/room-atomic-promotion.mjs`は将来の**信頼済みサービス向け・純粋な処理計画関数**。既存Classic保存処理の代替実装として本番稼働させるものではない。Firebase Auth IDトークンを検証する実際のAPI/Cloud Functionsはまだ存在しない。

- サーバーが検証済みAuth UID・サーバー生成タスクID・時刻を渡し、同じ`roomsV2/{room}`のトランザクションコールバック内でmembership、本人ToDoのexpected revision、タスクID重複、リクエストIDの再送を検証する。クライアントから渡されたUID・権限・タスクIDは信頼しない。
- 共有タスク作成、本人ToDo完了、再送防止マーカーを**同一ルームの1回の原子的更新**として計画する。競合、途中失敗、権限失効は全部を取り消す。確定応答を失った場合に同じ操作IDを再送してもタスクを二重生成しない。
- 現時点のタスクは`title`・`description`・`revision`だけを持つ将来用最小レコードである。Classicの担当、履歴、通知、テンプレート、関連レコードの完全スキーマを保存する設計は未実施。性能、ルームサイズ、同時更新の競合測定も未実施。

専用Emulatorでは`withSecurityRulesDisabled`を**信頼済みサービスの模擬**としてルーム子パスへの実際のRTDB transactionを行い、タスク＋ToDo＋再送マーカーを同時に確定できるかを検証する。通常の認証済みブラウザでは親ルーム、他人の個人領域、サービス用操作記録を書き換えられないことを試験する。Emulatorの管理者バイパスは、本番サーバー実装や権限の完成を意味しない。

### 代替ルートと採用前の制約

Firebase公式のマルチパス`update()`は複数パスを原子的に保存できる（https://firebase.google.com/docs/database/web/read-and-write ）。ただし、既存のタスク化・重複統合・関連予定の全CAS条件や通知の整合性をクライアント側Rulesだけで保てるかは未検証。将来の性能・費用とともに比較する。**この時点でサーバー案の本番採用を確定しない**。

現行Classic`app.js`、`workspace-duplicate-atomic-v544.js`、本番向け`firebase-rules.json`、`firebase.json`、`config.js`、`main`、GitHub Pages、既存データは変更しない。患者・機密情報をこの開発用テストデータとして扱わない。認証済みサービス・実ルール・バックアップ/復元・旧端末・利用者受入の完了まで、**正式公開 NO-GO**。

## Ver.571：Emulatorのキャッシュ初期化と個人ToDoの最小検証

Ver.570 CI #41159945635では共有データ/個人データの分離・Protocol 871件とBrowser 2ジョブは成功した一方、**新しいFirebase Emulatorのルーム単位トランザクションがabort**した。原因候補は、単発`get(roomRef)`だけではWeb SDKのtransaction用キャッシュが確実に維持されず、コールバックが既存データなしの`null`を受け取ること。これはFirebase公式の注意書きとも整合するが、失敗したcallbackの内容を記録していなかったため、確定原因とせず**次の実Emulatorテストで検証**する。

Ver.571は同じ`test-harness/security-rules-v568.mjs`を直接修正し、信頼済みサービスのEmulator模擬で`onValue`を保持して初期スナップショットを確認してからルームトランザクションを実行、終了後は必ず購読解除する。異常時は最後の判定を出力する。クライアントによるルーム親の読取/一括更新は引き続き拒否。成功後の同一操作ID再送はコミットせず、タスク・ToDo・操作IDがそれぞれ1件しか確定されないことを確認する。

将来候補の`roomsV2/{room}/personal/{uid}/todos/{todoId}`について、id/ownerUidをキーと一致させ、改訂番号CAS（作成1、更新+1）、タイトル100文字・メモ1000文字、完了型、未知フィールドの追加拒否を最小モデルとして追加した。これはすべてのClassic項目を検証する完成Rulesではない。個人ToDoの**削除・復旧、共有タスクへの紐づけ、通知配送、監査、オフライン操作**は別途設計・実証が必要。

公開用Rules、Classic writer、管理UI、Authプロバイダ、本番DB・Pages、既存データは変更しない。Firebase本番適用ルールの状況は引き続き未確認。**正式公開NO-GO**を継続する。

## Ver.572：信頼済み受付の契約と現行保存処理への接続境界

`security/room-promotion-request-v572.mjs` は**認証済みトークンから原子的ToDoタスク化を安全に依頼する受付契約の試作品**。独立した業務保存経路や新しいFirebaseクライアントを増やさず、Ver.570の既存`planRoomTodoPromotionV570`のみをtransaction callbackから再利用する。**HTTP endpoint、Cloud Functions、Firebase Admin SDK初期化やクライアントAuthログイン画面は実装していない**。

### 実サーバーが必ず提供するもの

1. 運用管理者が確認したFirebase projectのIDを`expectedProjectId`として固定。署名検証と無効・失効検査を実装した`verifyIdToken(idToken, true)`（Firebase Admin SDK）を注入。サーバー内部でUIDを確定し、`aud/iss`が意図したprojectを示すことも検査する。カスタム認証やテナント化を採用する場合は運用設計・検証を追加する。
2. 権限付き`transactRoom(roomId, updater)`アダプターを注入。**対象は`roomsV2/{roomId}`の子ルームのみ**で、認証前やルームID不正時にはDBに接続しない。ルームの最新membership・UID本人ToDo・revision・保存済み操作IDをtransaction中に再評価する。初回nullスナップショットや楽観的再試行を前提に、確実なキャッシュ初期化・権限付きAdmin処理をstagingで実証する。
3. サーバーが発行する安全なtask IDと時刻だけを信頼する。ブラウザは許可された最小コマンド（ToDo ID・期待revision・requestId・タイトル・説明）だけを送付。ルームのURLやlocalStorageの表示名を本人証明に使わない。
4. **結果が不明な応答`indeterminate`を失敗として自動再作成しない**。画面は入力を保持し、トークンを再取得したうえで同じrequestIdで照合/再送する。確定した`created`と`already-applied`だけを成功扱いし、`conflict`は最新データを読んで利用者の確認へ戻す。通信・認証・DBエラーの内部詳細やトークン本文は画面/ログに出さない。

### Ver.572のテスト境界

ProtocolのモックAuthは「正しくAdmin SDKを接続する契約」を検証するが、**実Firebaseの署名検証ではない**。Firebase Emulatorで証明済みのルーム原子更新とRulesの権限分離に対して、入口のvalidation・トークン取り消し・再送/不確定結果の扱いを別観点から検査する。現行Classicと将来用スキーマの全項目が一致するわけではない。

### 今後の判断

単一ルーム全体のtransactionは同ルーム内の独立編集に競合と負荷が発生する可能性がある。代替のサーバー側マルチパス`update()`の原子更新は、旧revisionやmembership条件を同等に担保できるか未検証。staging環境で同時更新・オフライン復帰・roomサイズ・復旧を比較し、無条件で本番採用しない。患者情報や機密情報をデモ環境に入れず、実DBの監査/復元試験・運用承認までは正式公開NO-GO。

公式参考：Firebase Admin SDKのトークン検証 https://firebase.google.com/docs/auth/admin/verify-id-tokens ・失効確認 https://firebase.google.com/docs/auth/admin/manage-sessions ・Realtime Database transaction https://firebase.google.com/docs/reference/js/database#runtransaction 。

## Ver.573：SDKのTransactionResult修正と隔離Admin Auth+Database Emulator

Ver.572 CI #41166174915で`created`に対して`indeterminate`が返された原因は**2点**。第一に検証用`RulesTestEnvironment.withSecurityRulesDisabled()`の正式な返却型は`Promise<void>`であり、内部callbackの`TransactionResult`は呼び出し元へ返らない。既存の検証用`transactRoom`を直接修正し、callback内で結果を捕捉してコンテキスト終了後に返す。第二にWeb SDKの`TransactionResult`はクラスインスタンスのため、受付側のplain object限定チェックが正規戻り値を拒否していた。既存受付を型の公開契約で検証するよう修正し、異常形状・例外は`indeterminate`を維持する。

`firebase-admin@14.5.0`を開発依存に追加し、検証専用の`firebase.v568.candidate.json`へAuth Emulator (127.0.0.1:9099)を設定。`test:admin:v573`では`--only auth,database --project demo-task-kanri-v568`を指定し、両エミュレータだけを起動する。Node専用`security/firebase-admin-staging-v573.mjs`はプロジェクトID、DB URLと両localhost接続先が一致しなければSDKのサービス取得前に拒否し、**本番の資格情報や実DBに接続しない**。

Auth Emulatorで作成したテスト職員のログイン→Emulator IDトークン→Admin SDK `verifyIdToken(token,true)`→Admin RTDBのルーム単位transaction→元ToDo完了と共有タスク作成→二重送信・別ルーム・membership失効・利用者無効化を実測する。これは実プロジェクトの署名検証、採用する認証基盤、公開サーバーのアクセス制御や運用安全性を保証しない。信頼済み受付ロジックはVer.572、保存計画はVer.570だけを再利用し、Classic/Modernに新たな業務writerを導入しない。

CIのFirebaseジョブは**候補RulesのEmulator→Auth+Adminの独立Emulator→既存開発用Emulator**の順に起動し、短い安全性検査の失敗を先に検出する。全5ジョブの初回成功が確定するまでは検証中。**正式公開NO-GO**、本番適用Rules・`firebase.json`・`main`・Pages・実データの変更なし。

公式参考：https://firebase.google.com/docs/reference/js/database.transactionresult 、https://firebase.google.com/docs/emulator-suite/connect_rtdb 、https://firebase.google.com/docs/emulator-suite/connect_auth 。

## Ver.574：サーバーAPI・旧クライアント・復旧方式の受入基準（検証用）

### 現行実装を読み取った差分

| 項目 | 現行Classicの正本 | 認証後の候補 | 危険と必要な対応 |
| --- | --- | --- | --- |
| Firebaseの根 | `rooms/{roomId}` | `roomsV2/{roomId}` | 自動同期・二重書込禁止。ステージングで切替時点と復元点を固定 |
| ToDoの所有者 | `owner`に表示名、`systemTaskUser`のlocalStorage切替 | `ownerUid`に検証済みAuth UID | **表示名からUIDを推測してはならない**。職員名簿の承認済み対応表で人手突合・未特定を隔離 |
| ToDo | `text,memo,completed,order,revision,createdAt,updatedAt,completedAt`など | UID配下の本人ToDoと改訂番号 | 同じID・順序・更新日時・完了履歴を損失なく保全。旧ID許容文字/長さと新ID制約を突合 |
| 共有タスク | `assignee,status,priority,category,dueDate,dueTime,recurrence,recurrenceRule,requester,tags,checklist,comments,history,lastChange,createdBy,updatedBy,knowledgeId`等 | 現候補は`title,description,revision`だけ | **現候補へそのまま保存すると情報欠落**。旧全フィールドを継承/移行する正式schemaを設計するまで書込切替禁止 |
| 他データ | schedules/knowledge/meta/workflowV148/V152/通知・関連レコード | 将来候補Rulesは一部のみ | ルームを跨ぐ参照・通知・繰返し・履歴を含めた整合/復元設計が未完了 |

### 認証方式・運用比較

- **候補A：院内で承認されたIdP/SSOとFirebase Authを連携**。UID発行、在職/退職・異動・MFA・共有端末でのサインアウトを組織基準で運用できる場合の第一候補。ただし院内IdP種別、Firebase側の利用可能な認証プロバイダ、契約、コスト、監査体制が未確認のため未決定。
- **候補B：Firebase Auth側で別管理アカウントを発行**。導入は比較的単純だが、職員名簿とIDの二重管理や入退職時の失効漏れの運用リスクが高い。本人確認・MFA・管理責任者の承認が必要。
- **却下：ルームURL・localStorageの表示名を本人認証とする方式**。なりすましを防げず、データ分類次第では重大なリスクがある。

### 検証用HTTP/APIの最小契約

`security/room-promotion-api-v574.mjs`は実HTTPサーバーではない。将来の**信頼できるサーバー内**のパーサー後段で`handlePromotionHttpV574`を呼ぶ純粋な境界だけを追加した。POST `/api/v2/todo-promotions`、ヘッダー`x-workboard-schema: roomsV2/1`とJSONの`schemaVersion: roomsV2/1`、最小コマンドだけを許可し、旧形式は**client-upgrade-required（409）**を返して旧DBへ書かない。これは古いアプリを見分ける目印であり、セキュリティ機能ではない。Bearer認証とmembership検証はそれぞれVer.572/570が担う。結果不明では503を返して「**同じrequestIdをユーザー確認のもとで再送、毎回新しいAuth IDトークンで認証をやり直す**」。トークンを永続化せず、別IDでの自動二重作成や旧クライアント経路へのフォールバックはしない。公開時はTLS、Origin/CORS、入力ストリームのバイト上限、API認可/監査・レート制限、CSRF/共有PCのセッション管理、DoS対策、適切なエラーレスポンスを改めて実装・試験する。**この検証コード自体にはHTTPリスナーが存在しない**。

### 移行・遮断・復元の正式NO-GOゲート

1. **現行稼働状態の保全**：実Firebaseプロジェクト・RTDBインスタンスと現在適用中のRulesの証跡（取得日時とハッシュ）、全ルームの暗号化バックアップ、復元可能性のテスト、端末/キャッシュ保有状況、データ取扱区分を管理者が確認。患者・職員の実名や認証トークンをCI/PRへ載せない。
2. **schemaマッピング承認**：`auditLegacyRoomForV574`の読み取り専用集計と、管理者による非公開のUID対応表を使う。元データと移行先でタスク/ToDo/通知/予定/履歴・添付・関連ID・並び順の件数/ハッシュを突合し、認識できないデータは移行せずread-only保留。**データ削除・自動変換なし**。
3. **stagingで単一writerを確定**：Classicが直接`rooms/`に書き込む旧経路と、新APIが`roomsV2/`に書く経路を同時稼働させない。必要な機能の既存保存契約・競合・操作履歴と通知配送を移管し、旧コードは検証済み置換後に削除。複数端末、同時書き込み、通信断、結果不明、offline復帰、旧ビルドからの読み書きをテスト。
4. **旧クライアントをRulesで遮断**：本番用の**実適用Rules**で`rooms/`の匿名/旧クライアント読み書きを拒否、`roomsV2/`はUID/room membershipに必要最小限のallow。古い配布版やオフラインキャッシュを持つ端末が再接続しても旧DBを書けないことを試験。**ヘッダーのversionだけで遮断できると誤認しない**。親のallowを子ルールでは打ち消せない（Firebase公式仕様）。
5. **段階導入と復旧**：管理者承認の停止窓を設定し、バックアップ復元試験済みの状態から一部検証ルームで切替→全件突合→利用者受入。障害時は**安全なread-only/切戻し**を選び、`.read:true/.write:true`の旧Rulesには戻さない。移行途中に両スキーマを単純mergeしない。

### Ver.574の確認範囲

ProtocolでAPI旧版拒否、Bearer契約、権限、重複送信、通信切断、結果不明時の復旧判断、監査結果の匿名性と無変更性を検証する。Firebase Auth+Admin SDKの**隔離Emulator**でもAPI envelopeから実トランザクションへ至る経路を検証する。実Firebase Console・認証設定・本番Rules/DB・旧クライアントを変更しない。未確認事項を「合格」とみなさず、全5CIジョブ初回成功を待つ。正式公開は**NO-GO**。

公式資料：Firebase Auth IDトークン https://firebase.google.com/docs/auth/admin/verify-id-tokens ・トークン失効 https://firebase.google.com/docs/auth/admin/manage-sessions ・Rulesの継承 https://firebase.google.com/docs/database/security/core-syntax 。

## Ver.575：旧スキーマの全項目/関連性を失わないための監査ゲート

今回の対象は、**リポジトリのClassic実装**と、独立Emulatorの架空データだけである。本番のFirebase Database、適用中Rules、職員名簿や実タスク内容にはアクセスしていない。

Ver.574で作成した`security/legacy-room-schema-audit-v574.mjs`を**直接拡張して一元化**し、旧`rooms/{roomId}`のルームsnapshotを読み取り専用で検査する。出力は固定キー名、件数、移行不可の判断に限定し、タスク・メモ・通知の本文、職員名、実ID、ハッシュを返さない。構造不正・過大なコレクションは`countsVerified:false`を返す。正常に読み取れても`result:NO_GO`を維持し、空に見えることを移行承認としない。

| 依存関係 | 既存コード上の経路 | 検証すること |
| --- | --- | --- |
| タスクの情報保全 | `app.js normalizeTask`の担当・状態・期限・履歴・コメント・チェックリスト・更新者・revision等 | 新候補のtitle/description/revisionだけでは失われるフィールドを含む件数 |
| 繰り返しタスク | `nextRecurringTaskId`/`recurringParentId` | 現在存在するタスクとの親子参照と参照先不在 |
| 予定・ナレッジ | `schedules/{id}.relatedTaskId`、`knowledge/{id}.taskId`、タスク`knowledgeId` | 現存タスク/ナレッジへの参照切れ件数。存在しない理由は自動断定しない |
| 予約開始日・業務メモ | `taskStarts/{taskId}`、`businessMemos/{id}` | リンク先タスクと旧作成者表示名の有無。端末別の業務メモ表示順はlocalStorageにあるため今回検査できない |
| 通知と個人設定 | `workflowV148/reminders/{displayName}/{taskId}`、`workflowV152/inbox/{displayName}/{eventId}` | 表示名ベースの宛先、タスク参照、件数。UIDの紐付けは責任者承認後に行う |
| 統合/アーカイブ | `workflowV152/duplicates`、`archives` | 統合先タスクの存否、アーカイブ件数。ただしアーカイブの旧IDは歴史的な墓標の可能性があるため自動削除しない |
| 旧利用者名簿 | `meta.users[]`、旧ToDoの`owner` | 表示名の表記揺れ/正規化後重複を件数で検出。表示名をUIDに自動推測・変換しない |

**実証テスト**：Protocolで関連が整合したデータ・参照切れ・不正な入れ子構造・匿名出力・元データ不変を検査。既存Admin SDK/RTDB Emulator検証で架空の旧ルームを作り、監査前後で旧ルームが一致し、`roomsV2`に移行先が生成されないことを確認する。これは本番の全量データを復元した証明ではない。

**引き続き必要な成果物**：全フィールドを保持できる正式schema、承認済みのUID対応表、患者/職員データの取扱分類、現行本番Rulesの実確認、バックアップと別環境への復元テスト、移行前後の件数/内容ハッシュ突合、オフライン端末と旧クライアントの遮断、切戻し手順、部門受入。監査の`sourceSnapshotHashVerified:false`、`restoredSnapshotHashVerified:false`は未実施の明示であり、今回のCI合格で変更しない。**正式公開NO-GO**、PRはDraft、Classic・本番Rules/DB・main・Pagesは無変更。

## 安全な移行順序と解除条件

1. **実環境の事実確認（管理権限保持者）**：Firebase project/RTDB instanceの実際の適用Rules、Auth設定、現在の利用端末・旧キャッシュ済みクライアント、取扱情報の分類、アクセスログ・DBバックアップ能力を組織の管理手順で確認。機密データ、トークン、全量エクスポート、個人情報をPR・CI・Chatへ載せない。
2. **ID・運用承認**：認証方式（病院が承認する本人確認手段）、UIDと表示名の対応、viewer/editor/adminの付与/失効担当、退職・異動、端末の共用、MFA、旧アカウントの無効化・緊急遮断を決める。membershipはクライアントから書かせない。
3. **stagingで既存操作と新スキーマの差分を実装・試験**：認証完了まで画面はremoteデータを開かない。UID別個人データと共有データを独立購読する。room全体をatomic更新するToDoタスク化/重複統合等は**原子性を維持するサーバー処理**か安全な再設計を選ぶ。未接続時にlocal-onlyで権限をすり抜けない。二重writer/購読は作らず既存ownerを置換する。
4. **権限・整合試験**：匿名、未所属、他ルーム、reader、editor、admin、本人と他人のToDo/inbox、自己昇格、root書込、失効後の接続、未認証旧クライアント、同時編集、offline復帰、入力保持、通知重複、部分失敗を検査する。新Rulesはschema・index・サイズ/上限・履歴追跡も追加審査する。
5. **バックアップ・復旧と段階公開**：本番への書込前に復元可能なバックアップと**復元テスト**、データ移行の前後突合、旧クライアント強制更新/接続拒否、移行手順と停止時間、監査記録、障害時の読取専用・切戻しを承認。古い `.read:true/.write:true` への安易なロールバックは許可しない。安全なstaging検証と管理者承認がない限り、本番Rules/Pagesは変更しない。

## Ver.568のテストと限界

- **専用コマンド**：`npm run test:rules:v568`。明示した`firebase.v568.candidate.json` と`demo-task-kanri-v568` のEmulator（127.0.0.1:9001）のみ。既存 `firebase.json` が指す開発用全許可Rulesとは別の一時プロセスで起動する。
- テストは `@firebase/rules-unit-testing` の認証済みUID/未認証コンテキストを使用する。認証なし・非所属・別ルーム・viewerの共有編集・別人のToDo/inbox・自己昇格・room親書込をdeny、editorの子レコード書込・本人の個人領域をallow。membership失効後にdenyとなることも確認する。
- GitHub ActionsのFirebase jobで従来のEmulatorテスト後に**専用候補テスト**を実行し、どちらかが失敗すれば既存Regressionの最終ゲートを失敗とする。Protocolは候補Rulesに無条件許可がないこと、既存公開Rulesを触っていないことを監査する。
- この試験は**新パスだけの権限マトリクスの実証**。Classic/Modern業務画面は新パスを使用しておらず、Firebase Auth導入・本番移行・schema validation・運用受入・利用者権限の正式承認は**すべて未完了**。本番の実際の適用Rulesは未確認。PRはDraft、main/GitHub Pages/実DBは現状維持。

公式参考：Firebase Security Rulesの階層と継承 https://firebase.google.com/docs/database/security/core-syntax 、条件 https://firebase.google.com/docs/database/security/rules-conditions 、Emulatorテスト https://firebase.google.com/docs/rules/unit-tests 。
