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
