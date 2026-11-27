#!/usr/bin/env bash
set -euo pipefail
[[ "${WORKBOARD_PG_TEST:-}" == 1 ]] || exit 2
db=(psql -X --host 127.0.0.1 --port 55432 --username postgres --dbname workboard_messaging_test -v ON_ERROR_STOP=1)
"${db[@]}" <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
SQL
for migration in workboard-attachments-v1 workboard-attachments-epoch-v1 workboard-attachments-claim-v1; do
  "${db[@]}" --single-transaction -f "security/supabase/${migration}.sql" >/dev/null
done
for migration in workboard-messaging-budget-v1 workboard-attachment-send-fence-v1 workboard-messaging-budget-v2; do
  "${db[@]}" -f "security/supabase/${migration}.sql" >/dev/null
done
"${db[@]}" -c 'update public.workboard_messaging_budget_policy_v1 set requests_per_day=3,sends_per_minute=2,sends_per_day=2' >/dev/null
folder=$(mktemp -d)
pids=()
for i in {1..12}; do
  "${db[@]}" -qAt -c "set role service_role; select public.workboard_reserve_messaging_request_v1(150)->>'status'" >"$folder/global-$i" &
  pids+=("$!")
  "${db[@]}" -qAt -c "set role service_role; select public.workboard_reserve_messaging_send_v1('p_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'status'" >"$folder/send-$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ "$(awk '$0=="ok" {count++} END {print count+0}' "$folder"/global-*)" == 3 ]]
[[ "$(awk '$0=="limit" {count++} END {print count+0}' "$folder"/global-*)" == 9 ]]
[[ "$(awk '$0=="ok" {count++} END {print count+0}' "$folder"/send-*)" == 2 ]]
[[ "$(awk '$0=="limit" {count++} END {print count+0}' "$folder"/send-*)" == 10 ]]
"${db[@]}" -c 'truncate public.workboard_messaging_request_usage_v1; update public.workboard_messaging_budget_policy_v1 set requests_per_person_day=2' >/dev/null
pids=()
for i in {1..12}; do
  "${db[@]}" -qAt -c "set role service_role; select public.workboard_reserve_messaging_request_v2(150,'p_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'status'" >"$folder/actor-$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ "$(awk '$0=="ok" {count++} END {print count+0}' "$folder"/actor-*)" == 2 ]]
[[ "$(awk '$0=="limit" {count++} END {print count+0}' "$folder"/actor-*)" == 10 ]]
[[ "$("${db[@]}" -qAt -c "set role service_role; select public.workboard_reserve_messaging_request_v2(150,'p_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')->>'status'")" == ok ]]
"${db[@]}" -f security/supabase/workboard-attachment-maintenance-v1.sql -f - <<'SQL'
do $$
declare
  person text:='p_'||repeat('a',32);
  request_key text:='q_'||repeat('b',32);
  room_key text:='synthetic';
  conversation_key text:='self_'||person;
  message_key text:='msg_'||person||'_'||request_key;
  id uuid:='00000000-0000-4000-8000-000000000001';
  sender uuid:='00000000-0000-4000-8000-000000000002';
  maintenance uuid:='00000000-0000-4000-8000-000000000003';
begin
  if has_function_privilege('anon','public.workboard_reserve_messaging_request_v1(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.workboard_reserve_messaging_request_v2(integer,text)','EXECUTE')
     or has_function_privilege('authenticated','public.workboard_reserve_messaging_send_v1(text)','EXECUTE')
     or has_function_privilege('authenticated','public.workboard_acquire_attachment_send_v1(text,text,text,uuid)','EXECUTE')
  then raise exception 'Unexpected client grant'; end if;
  if (select requests from public.workboard_messaging_request_usage_v1 where utc_day=timezone('UTC',now())::date) is distinct from 3
  then raise exception 'Actor denial consumed the shared request budget'; end if;
  truncate public.workboard_messaging_request_usage_v1,public.workboard_messaging_actor_request_usage_v2;
  update public.workboard_messaging_budget_policy_v1 set requests_per_day=8000,requests_per_person_day=2500;
  -- Two people, four visible tabs, 100 initial unread checks per tab, and
  -- 100 activity refreshes per person during the eight-hour pilot simulation.
  for i in 1..2 loop
    for tab in 1..2 loop
      for request in 1..240 loop
        if public.workboard_reserve_messaging_request_v2(304,'p_'||repeat(to_hex(i),32))->>'status'<>'ok'
           or public.workboard_reserve_messaging_request_v2(24,'p_'||repeat(to_hex(i),32))->>'status'<>'ok'
        then raise exception 'Visible tabs exceeded pilot budget'; end if;
      end loop;
    end loop;
    for request in 1..300 loop
      if public.workboard_reserve_messaging_request_v2(130,'p_'||repeat(to_hex(i),32))->>'status'<>'ok'
      then raise exception 'Activity refresh exceeded pilot budget'; end if;
    end loop;
  end loop;
  if (select units from public.workboard_messaging_request_usage_v1 where utc_day=timezone('UTC',now())::date) is distinct from 392880
  then raise exception 'Unexpected multi-tab work units'; end if;
  update public.workboard_messaging_send_usage_v1 set utc_day=utc_day-1,utc_minute=utc_minute-interval '1 day';
  if public.workboard_reserve_messaging_send_v1(person)->>'status'<>'ok' then raise exception 'Previous day leaked'; end if;
  insert into public.workboard_attachments_v1
    (attachment_id,room_id,conversation_id,uploader_id,membership_joined_at,request_id,request_slot,filename,mime,declared_bytes,actual_bytes,sha256,state,message_id,expires_at)
    values (id,room_key,conversation_key,person,1000,request_key,0,'demo.txt','text/plain',5,5,repeat('0',64),'attached',message_key,now()+interval '30 min');
  insert into storage.objects values ('workboard-attachments-v1',id::text);
  if public.workboard_acquire_attachment_send_v1(room_key,conversation_key,message_key,sender)->>'status'<>'ok'
  then raise exception 'Could not acquire send fence'; end if;
  if exists(select from pg_temp.workboard_list_send_fences(room_key))
    or pg_temp.workboard_release_stale_send_fence(room_key,conversation_key,message_key,sender,true,true,true)<>'missing-or-protected'
  then raise exception 'Fresh send lock must remain protected'; end if;
  update public.workboard_attachment_send_fences_v1 set acquired_at=now()-interval '15 minutes';
  if not exists(select from pg_temp.workboard_list_send_fences(room_key) f where lease_id=sender)
    or exists(select from pg_temp.workboard_list_send_fences('unrelated'))
    or pg_temp.workboard_release_stale_send_fence(room_key,conversation_key,message_key,sender,true,false,true)<>'protected'
    or pg_temp.workboard_release_stale_send_fence(room_key,conversation_key,message_key,maintenance,true,true,true)<>'missing-or-protected'
  then raise exception 'Scoping or operator confirmation did not protect old lock'; end if;
  if pg_temp.workboard_begin_claim_recovery(room_key,id,maintenance)<>'busy' then raise exception 'In-flight claim should fence maintenance'; end if;
  if pg_temp.workboard_release_stale_send_fence(room_key,conversation_key,message_key,sender,true,true,true)<>'ok'
    or not exists(select from public.workboard_attachments_v1 where attachment_id=id and state='attached')
    or not exists(select from storage.objects where name=id::text)
  then raise exception 'Could not release only the old send lock'; end if;
  if pg_temp.workboard_begin_claim_recovery(room_key,id,maintenance)<>'ok' then raise exception 'Could not acquire maintenance fence'; end if;
  if public.workboard_acquire_attachment_send_v1(room_key,conversation_key,message_key,sender)->>'status'<>'busy'
  then raise exception 'Maintenance must fence a new send'; end if;
  if pg_temp.workboard_recover_claimed_attachment(room_key,id,maintenance,'prepare',false,false)<>'protected'
  then raise exception 'Canonical absence missing'; end if;
  if pg_temp.workboard_recover_claimed_attachment(room_key,id,maintenance,'prepare',true,false)<>'ok'
  then raise exception 'Could not protect reservation'; end if;
  if pg_temp.workboard_recover_claimed_attachment(room_key,id,maintenance,'finish',true,true)<>'object-present'
  then raise exception 'Object still present'; end if;
  -- The synthetic Storage adapter removes its own catalog row after deletion.
  delete from storage.objects where name=id::text;
  if pg_temp.workboard_recover_claimed_attachment(room_key,id,maintenance,'finish',true,true)<>'ok'
  then raise exception 'Capacity release failed'; end if;
  if pg_temp.workboard_recover_claimed_attachment(room_key,id,maintenance,'finish',true,true)<>'ok'
    or not exists(select 1 from public.workboard_attachments_v1 a where a.attachment_id=id and a.declared_bytes=5 and a.state='deleted')
  then raise exception 'Audit retention failed'; end if;
end $$;
SQL
echo 'MESSAGING_POSTGRES_CONCURRENT_BUDGET_AND_RECOVERY_OK'
