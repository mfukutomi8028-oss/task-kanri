# Ver.449 — Firebase RTDBアクセス制御・個人データ分離のread-only監査

**対象:** Security Issue [#368](https://github.com/mfukutomi8028-oss/task-kanri/issues/368)。前提はVer.448正式main `ba5aa6945951cbe0bf0da837e5eba4819b46a57f`、同SHA Regression #38346603801・Pages #38346603805成功、checkpoint `backup/ver448-product-handoff-notes-validated-checkpoint`。本工程はリスク調査と安全な移行要件の定義であり、安全な本番設定への切替・承認の完了ではない。

## 1. 確認できた事実と確認できない事項

| 論点 | 現行ソースで確認した事実 | 判断 |
| --- | --- | --- |
| Repositoryルール | `firebase-rules.json`: `rooms/$roomId`にboolean `.read:true`と`.write:true` | **HIGH（このファイルを適用した場合）**。ルームの全子孫を認証・所属照合なしに読み書きできる |
| 開発用ルール | `database.rules.test.json`: DBルートで`.read:true` / `.write:true` | Emulatorテスト用の全許可。安全な本番Rulesの実証ではない |
| CLI設定 | `firebase.json`は開発用ルールを指す。`npm run test:firebase`はlocalhost Emulatorと`demo-task-kanri`を指定 | 開発用設定の誤本番deployが二次リスク。運用コマンド・configを分離する |
| 本人性 | `app.js`のルームIDは`?room=`/localStorage、表示ユーザーは`systemTaskUser`。Firebase SDK importはapp/databaseのみ | URLと表示名は認証ではなく、UIDに結びついた権限もない |
| データ経路 | `/rooms/$roomId/tasks`、`schedules`、`knowledge`、`todos`、`meta`を購読。`workflow-v152.js`は`/rooms/$roomId/workflowV152`を購読 | ルーム内に個人Todo/inboxを同居させる現構造では利用者単位の非公開を実現しにくい |
| 更新単位 | `runTransaction(state.roomRef, ...)`でルーム全体を原子的更新。ToDo作成は`runTransaction(state.todosRef, ...)` | 親ルーム全体に広い書込権限を与えたまま子ルールだけを厳格化しても防げない |
| 本番適用状態 | Firebase Console上のプロジェクト・DBインスタンス・現行公開Rules・実データ・アクセスログは**取得していない** | 本番で公開中か、不正使用歴があるか、患者情報の有無は未判定。安全性を宣言しない |

**重要:** Realtime Databaseの`.read/.write`は浅い階層の許可が子へ継承される。子でdenyしても親allowは取り消せない。`.validate`はwrite許可の代替ではない。ローカルのrevisions・UIチェック・room ID難読化はアクセス制御ではない。ブラウザ向けFirebase APIキーを秘匿化してもRulesの代わりにはならない。

## 2. 作業停止境界（今回行わないこと）

- Firebase Console、管理API、実DB、認証ユーザー、個人情報、端末・アクセス履歴を読み書きしない。Firebase認証・Rules・config.js・アプリの動作・GitHub Pages公開内容を変更しない。
- `firebase-rules.json`、`database.rules.test.json`、`firebase.json`、Firebase Emulatorの既存fixture/Tests/CI workflowは変更しない。新しい認証を入れずにsecureと表示するようなUI変更も禁止。
- 病院用途における患者情報、医療記録、個人識別情報、パスワード等は、**現行権限構造の安全性が立証されるまで本システムへ格納しない**。既存データの有無・実運用判断は正式管理者が別途確認する。

## 3. 権限モデルの比較・推奨

| 方式 | 効果・利点 | コスト/残る課題 | 判断 |
| --- | --- | --- | --- |
| A. Firebase Authentication + 管理者が発行・失効するUID/room membership + RTDB Rules | 現在のRTDB同期を保ちつつ部屋・役割単位でdeny-first可能 | 親room transaction、個人Todo/inboxパスと旧クライアントの移行設計が必須 | **第1候補** |
| B. 本人認証 + サーバー側のAPI/Functionsが許可済み更新のみ実施 | 複数データ更新・監査・強い書込検証を集約しやすい | 設備・保守コスト上昇。病院の正式ID基盤や監査要件次第で選ぶ | 代替 |
| C. 現在のroom URL・表示名を秘密扱いして使い続ける | 改修は小さい | URL漏えい・表示名なりすまし・ルーム越境書込を防げない | **不採用** |

設計上の本人識別子は表示名でなく検証済みAuth UIDとし、membership権限レコードは信頼できる運用者／サーバーだけが付与・失効できるようにする。一般ユーザーのmembership自己付与・昇格を認めない。各ルームの閲覧・編集・管理を区別し、別ルームはdeny。通知inbox・個人ToDo・個人リマインダーは本人UIDで識別/アクセス分離する。共同で配信する通知は信頼できるwrite経路を別途設計する。

## 4. 移行を阻む既存契約と解決順

1. **実環境確認とデータ分類（最優先、所有者作業）:** Firebase Consoleの対象project/instanceと適用中Rules（日時・ハッシュを含む）、Authプロバイダ、アクセス監査、バックアップ/復旧能力、実データ分類、実利用端末を確認する。秘密、UID、患者情報、トークン、DB全量をIssue/CIへ貼らない。漏えい・患者情報の疑いは所属組織のインシデント手順を優先。
2. **UID・membership設計:** 病院で承認されたアカウント基盤への紐づけ、入退職・異動・失効、権限の付与責任、共有ルームの閲覧者/編集者/管理者、招待の認可を決める。匿名参加・共有URL・表示ユーザー名を本人証明に使わない。
3. **読取/書込パスの再設計:** task/schedules/knowledge/meta/todos/workflowV148/V152、ルーム一括transactionを網羅。親`rooms/$roomId`の広い`.read/.write`を残したまま子ルールで拒否する案は不可。全room transactionの同時更新・競合・リビジョン整合を保つ手段を検証してから子ノードへ縮小する。個人ToDo/inboxの参照・更新をUID単位へ移す。必要なら管理API/Functionsへ権限付き書込を移管。
4. **分離Emulatorとstaging環境でdeny-first検証:** 既存`database.rules.test.json`は旧動作のテスト専用として温存し、新たなセキュアRulesは別の**明示指定された**staging構成で検証する。既存`firebase.json`を本番deploymentに使用しない。Rules新規版はこの監査PRでは作成・deployしない。
5. **本番移行・復旧:** 組織承認、対象ユーザーの事前準備、データ退避と**復元テスト**、旧キャッシュ済みクライアントの認証未対応時の扱い、offline cacheの保持/削除、セッション失効、導入日時、段階切替、通信失敗時の表示・read-only保護、監査記録を定めてから反映する。過去の無制限allowへのロールバックを通常の復旧案としない。

## 5. 次工程の最小検査マトリクス（未実施）

| 対象 | read | write | 前提 |
| --- | --- | --- | --- |
| 匿名 / 未認証 | deny | deny | ルームID/公開APIキーを知っても不可 |
| 認証済み・非所属UID / 別ルーム | deny | deny | 共有URLや他ルーム番号で越境不可 |
| 所属の閲覧者 | allow（当該共有領域のみ） | deny | 個人inbox/ToDoは他人からdeny |
| 所属の編集者 | allow（必要領域のみ） | allow（認可対象のみ） | revision, schema validation, record owner検証 |
| 個人ToDo / inbox / リマインダー | UID所有者にallow | 所有者または権限を持つ安全な配信者のみ | 表示名の切替で他人のデータを読めない |
| membershipの自己追加・権限昇格 / ルーム親への一括更新 | deny | deny | 明示承認済みの信頼経路以外は禁止 |
| 旧クライアント・失効したアカウント・offline再接続 | deny / 安全にエラー表示 | deny / 再同期で破壊しない | ローカルキャッシュ/既存処理の影響を評価 |

実際のAllow/Denyは`@firebase/rules-unit-testing`等を使い、匿名・複数UID・複数ルームの独立コンテキストからEmulatorに対して検証する。新Rules・認証済みクライアント・バックアップ計画が一式揃うまで、テストだけをgreenにして移行完了とはしない。

## 6. Ver.449の検証・出荷判定

新しいProtocol契約は**危険な現状を計測・固定して再調査を促すread-onlyな監査**であり、認可セキュリティ試験や対策完成の証明ではない。現在のルールが変更された際は、監査の前提と安全性の判定を改訂する。CIログの`HIGH_UNVERIFIED_DEPLOYMENT`は本番環境の評価ではなく、repo定義上の警告。

受入ゲートはPR exact-head Protocol/Browser shard 1+2/Firebase/最終Regression success → expected-head merge → main同SHA Regression/Pages success → 同SHAcheckpoint確認。今回の完成判定は**監査・移行設計と危険度の可視化**に限る。

### 公式資料（確認：2026-10-13）

- https://firebase.google.com/docs/database/security
- https://firebase.google.com/docs/database/security/core-syntax
- https://firebase.google.com/docs/database/security/rules-conditions
- https://firebase.google.com/docs/reference/emulator-suite/rules-unit-testing
- https://firebase.google.com/docs/projects/api-keys
