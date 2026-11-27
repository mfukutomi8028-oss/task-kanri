# Origin メッセージ機能：限定試用の運用手順（管理者専用）

## 方針

無料プランを維持する。初回は少人数・非機密データ限定。正本はFirebaseの会話controlとmessages、添付台帳はSupabase、実体はprivate bucket。通常利用者・公開Pagesに管理者資格や保守APIを渡さない。会話索引修復は既存revision付きreconcilerを使用する。添付清掃は当面明示的な管理者操作とし、期限切れ未確定ファイルだけを対象とする。送信済み資料の自動削除は行わない。

## 1. 会話一覧の修復

リポジトリの開発作業用コピーと既存のfirebase-admin依存を用い、管理者端末のApplication Default Credentialsで実行する。認証ファイルをGitに追加しない。実行前に対象project・roomを確認する。

```cmd
node security/messaging-directory-admin.mjs --project task-kanri-2ad16 --room ROOM_ID --limit 50
```

既定はdry-runで対象会話IDのみを確認する。意図したroomと範囲であることを確認してから同じコマンドに `--apply` を追加する。正本、履歴本文、既存業務roomsは変更しない。最大50会話ごとに `hasMore` と `nextCursor` を確認し、次ページには `--after ID` を指定する。partial の `failed` は記録して単一会話指定で再試行する。

```cmd
node security/messaging-directory-admin.mjs --project task-kanri-2ad16 --room ROOM_ID --conversation CONVERSATION_ID
node security/messaging-directory-admin.mjs --project task-kanri-2ad16 --room ROOM_ID --conversation CONVERSATION_ID --apply
```

status ok以外は終了コード1。partialの失敗IDを破棄して先に進まない。認証・所属判定は引き続き正本によるため、索引修復を本人承認の代用にしない。dry-runは候補ID一覧で、各索引の差分や修復成功までは保証しない。

## 2. 期限切れ添付の確認・隔離・清掃

既定で自動削除しない。管理者がSupabase SQL Editorから対象roomの期限切れ候補を確認する。roomを必ず指定し、最大50件。本文や元ファイルの内容は表示しない。

```sql
select room_id, attachment_id, conversation_id, uploader_id, request_id,
       state, expires_at, declared_bytes
from public.workboard_attachments_v1
where room_id = 'ROOM_ID'
  and message_id is null
  and state in ('reserved','uploaded','ready','deleting')
  and expires_at <= clock_timestamp() - interval '24 hours'
order by expires_at, attachment_id
limit 50;
```

24時間の猶予はサーバー側の30分予約期限とは別。期限内に開始されたEdge処理の終了を待つための保守的な余裕で、Supabase Freeのworker wall-clock上限150秒より十分長い。Edge以外の書込み主体を追加した場合は再検討する（https://supabase.com/docs/guides/functions/limits）。可能な限り低負荷の管理時間に、バックアップと対象の記録を行い、一度に1件だけ操作する。

1. 対象行の room/conversation/uploader/request を照合する。Firebase管理者経路で、`messagingV1/ROOM_ID/messages/CONVERSATION_ID/msg_UPLOADER_ID_REQUEST_ID` の正本メッセージが存在しないことを確認する。ここで UPLOADER_ID と REQUEST_ID は接頭辞を含む実値。例：msg_p_…_q_…。通信エラー、欠損の原因不明、削除墓標を含むレコードがある場合は中止する。確認結果・IDを記録する。
2. SQL Editorで明示的に BEGIN; を開始し、`security/supabase/workboard-attachment-maintenance-v1.sql` の定義を貼り付け、その末尾に次の単一対象呼出しと COMMIT; を追加して一括実行する。true は手順1が確認できた場合に限る。

```sql
select pg_temp.workboard_prepare_expired_attachment(
  'ROOM_ID','ATTACHMENT_UUID'::uuid,true);
```

ok の場合のみ先へ進む。状態がdeletingになり、既存の予約・確定・claim処理が拒否する。容量枠はまだ解放されない。関数はsession-localで、恒久RPCや権限変更は作らない。
3. 同じIDを private bucket `workboard-attachments-v1` で確認し、実体があればStorage管理画面またはStorage APIのremoveでそのIDのみ削除する。存在しない場合もStorage画面/APIで確認する。エラーの場合はdeletingのまま保留し、再確認して再試行する。storage.objectsをSQLで削除しない。バケットを空にしたり削除したりしない。
4. Firebase正本の不存在を再確認し、Storage API/画面で実体の不存在を確認する。別トランザクションで同じSQL定義を再度読み込み、次の呼出しとCOMMIT; を追加して実行する。両確認が成立した場合だけtrueを渡す。

```sql
select pg_temp.workboard_finish_expired_attachment(
  'ROOM_ID','ATTACHMENT_UUID'::uuid,true,true);
```

ok の場合のみ、該当行がdeletedになり保守的な容量予約を解放する。台帳行は消さないため当日アップロード量は維持される。object-present、protected、missing、invalidの場合は容量を解放しない。途中停止時は同じ対象IDで手順を再開できる。

attached、message_idあり、期限前、参照の疑いがある行は対象外。送信確定前のclaimだけ成功した孤立attachedや削除済みメッセージの添付も自動削除しない。別途、正本・バックアップ・保有要件を確認して個別の復旧/削除判断をする。週次で候補数と保留状況を確認し、増加時は独立した修復設計を行う。初回実機ではStorage実体が残っている場合のfinish拒否・削除後のfinish・再試行の確認を行う。ファイルの実体がないSQL合成試験だけで物理削除の成功を保証しない。

## 3. 端末登録・利用停止・監視

既存 `security/messaging-device-admin.mjs` の --help、register-person、approve-device、revoke-device を使用する。dry-run後に明示 --apply。本人と端末を別経路で確認し、表示名を本人認証に使用しない。新端末・ブラウザデータ消去は再承認。必要に応じて全該当端末を失効。患者情報・個人情報・機密資料はこの限定試用に登録しない。従来のroomsの包括許可は既存データ互換のため残っており、正式ログイン移行とは別に解消する。

Supabaseの容量・通信量とFirebase使用量を定期的に監視。SQL上のstorage予約予算800,000,000 bytes、日次20,000,000 bytes/人、取得予算4,000,000,000 bytes/月を計測する。使用量集計をリセットしない。課金プランへ変更しない。停止時は新規メッセージを無効にし、既存データを保全する。業務データの消去・ルールの緩和による復旧は禁止。

### リクエストと送信の上限


Edge は `workboard-messaging-budget-v1.sql` の PostgreSQL 台帳を使う。UTC で日付・分を区切り、全体は8,000要求/日・48万処理単位/日、本文と添付の送信は承認済み personId ごとに20要求/分・180要求/日とする。同じ要求IDでの再送も送信枠を消費する。HTTP 429 の再試行目安は最大1時間で、添付ストレージの既存バイト枠は別に適用する。台帳応答が得られなければ新規要求は503で停止する。

2利用者・各1タブ・1日8時間・各100会話の想定では、60秒周期の会話一覧と名簿で1,920要求/日、約31.5万処理単位/日。初回の未読100件ずつを含めると2,120要求/日、約34.1万単位/日。30日で約6.36万要求という試算で、操作・再接続・事前確認・他用途分は別途加算する。処理単位は主に取得件数を重み付けしたアプリ内予算で、Firebaseの通信バイト数や金額とは一致しない。50タブが同条件で動作すると予算を超えるため、初回試用の人数を増やす前に実測して見直す。

Supabase Free の50万 Edge 呼び出し/月は組織の実使用量で確認する。外部トラフィック、HTTP事前確認、メソッド拒否、Edgeが処理を始める前の呼び出し、クライアントからのFirebase操作、既存業務データの利用はこの台帳で制限できない。運用者が Edge 呼び出し数、Supabase通信量、Firebase接続数・通信量を確認し、試用開始前と異常発生時に停止基準を判断する。

### 確保済みで送信未確定の添付

確保済み行は既存の期限切れ清掃から除外する。送信は会話・正本メッセージIDごとの永続ロックを取得してから確保処理を行い、Firebase書き込み終了後に解放する。旧Edgeの書き込みを止めたことを確認してからこの運用へ移行する。途中停止でロックが残る場合は、旧実行が終了したことと正本・台帳を確認するまで保留とする。

1. 読み取り専用で対象を1件選び、room、会話、送信者、加入時点、要求ID、添付IDを台帳と照合する。管理者は `workboard_attachments_v1` と `workboard_attachment_send_fences_v1` の対象行を確認し、`message_id` と同じFirebase正本のレコードを取得する。正本がある場合や照会に失敗した場合、送信ロックが残る場合は保留する。private Storageから該当IDの1件だけを暗号化された管理領域へ取得し、実測バイト数が台帳の `declared_bytes` と `actual_bytes`と、SHA-256が台帳ハッシュと一致することを確認する（Windowsでは `Get-Item -LiteralPath <ファイル>` と `Get-FileHash -LiteralPath <ファイル> -Algorithm SHA256`）。同じ正本IDで不存在が確認でき、行が `attached` または `deleting` で、ロックなし・実体一致の条件がそろった場合だけ次へ進める。復旧を優先し、再送可能なら本人が同じ要求ID・内容で再試行する。
2. オペレーターがUUIDを一つ発行する。SQL Editorで既存の保守定義をトランザクション内に読み込み、`pg_temp.workboard_begin_claim_recovery(room,attachment,lease)` を実行してコミットする。`busy` の場合は待機・再確認する。ロック取得後、Firebaseを新規読み取りし、対象の正本がないことを確認する。通信失敗・墓標・正本レコードありは保留。準備前であれば同じUUIDで `abort` しロックを解放できる。
3. 同じ保守定義とUUIDを使い、`pg_temp.workboard_recover_claimed_attachment(room,attachment,lease,'prepare',true,false)` を実行しコミットする。`ok` の行を対象にStorage APIで実体を1件だけ削除する。`deleting` の間も容量枠は予約されたまま。
4. 正本とStorage APIで不存在を再確認し、同じUUIDで `'finish',true,true` を実行する。Storage台帳に実体が残る場合は拒否される。完了後も行と送信時の使用量は保持し、送信ロックだけを解放する。中断時は同じUUIDで再開する。SQLでStorage実体を削除しない。

## 4. 緊急停止、バックアップ、復元

停止操作は管理者が対象プロジェクトを再確認し、Firebase RTDB の `messagingControlV1/enabled` を false にする。値がない場合、型が違う場合、取得不能の場合もEdgeは拒否する。通常の開いたタブでは制御値を購読し、停止中は本文・個人状態・添付を解除する。制御値は認証済みクライアントが閲覧できる真偽値1個で、書き込みは管理者経路のみ。変更前に受信済みの応答やブラウザから持ち出されたデータは回収できない。旧業務ルームにはメッセージ停止条件を適用しない。

バックアップ前にEdgeの旧稼働版を止め、デプロイ履歴、停止前に受け付けたリクエストの完了、永続送信ロックの状態を照合する。時間経過だけで送信ロックを除去しない。処理中の状態が判断できなければ復元用スナップショットの確定を保留する。必要に応じて環境フラグも false にした版へ切り替え、Edgeの応答と開いた旧タブからの拒否を確認する。

1. Rulesを管理者経路で新規にエクスポートし、取得日時、対象、現行Edgeの版、配信SHAとともに暗号化した管理領域へ保管する。既存の承認情報と合成対象の3領域の整合を確認する。JSONに管理キーやトークンを同梱しない。
2. スコープを対象roomに限定し、Firebaseの会話・メッセージ・個人状態・端末承認・本人名簿をエクスポートする。端末の資格情報は含めない。Supabaseの添付台帳、取得量、保存/要求予算、残存ロックを保全し、private Storageは管理者経路で該当物だけ取得する。各ファイルの容量・SHA-256・IDを台帳と照合する。バックアップ一覧のSHA-256も別に記録する。
3. 復元は作業開始から停止状態の隔離先で試験する。IDと加入時点を保ち、Firebase正本、Supabase台帳と使用量、ハッシュ一致を確認した実体を復元する。Firebase AuthのUIDが一致しない環境では端末を未承認のままにし、隔離用本人確認を行う。旧自動復元や管理者による広い許可の追加は行わない。
4. 正本のハッシュと件数、Storageと台帳の双方向照合、旧業務ルームの検査、合成アカウントでの閲覧・送信・再送・ダウンロード、脱退/失効による拒否、日次/月次使用量の維持を検証する。本番で復元が必要な場合は検証できた版、復元対象、書き戻し順序を承認してから個別実行する。

## 5. 初回公開候補への切替順序

1. 旧Edgeの書き込みを停止・排水して、前節のバックアップを作成する。既存添付基盤の適用履歴を確認し、追加の `workboard-messaging-budget-v1.sql`、`workboard-attachment-send-fence-v1.sql` をこの順で適用する。期限切れ保守SQLは必要時だけ管理セッションに読み込む。
2. 取得した現行Rulesに対し、レビュー済み前版の隔離Rulesと新候補を使って合成する。前版は対象の確定SHAから取得し、本番Messaging下位ルールが前版と一致することを確認する。停止値を維持し、既存ルームとすべての対象認可をEmulatorで検査してから対象Rulesを適用する。読み戻した現物の差分を確認する。
3. 新Edgeを配備し、Firebase IDトークン、HTTPSの許可オリジン、サーバー側秘密、SQL RPC、停止中の拒否を確認する。二人の合成利用者で限定試験を行い、新版の起動・停止・復旧を確認する。その後に公開候補のPages設定を別の承認済みSHAで有効化する。今回のVer.676候補は無効設定で固定する。
4. ロールバック時は先に中央停止し、公開UIを無効設定へ戻す。旧Edgeへ戻す場合は書き込み停止・排水・暗号化バックアップの後に、停止を維持した状態で互換性を確認する。旧Rulesに戻すと中央停止の強制が失われるため、許可経路が再開しない別の停止措置が先に必要。追加SQL台帳や既存添付は保持し、データ削除を切り戻しの条件にしない。
