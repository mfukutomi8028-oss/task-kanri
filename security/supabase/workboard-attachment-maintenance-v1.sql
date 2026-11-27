-- Administrator-only SQL editor helpers. These functions are session-local.
-- They are never exposed as application RPCs. Storage deletion is a separate
-- Storage API/dashboard operation; do not modify storage.objects with SQL.
create temp table if not exists workboard_attachment_maintenance_session(marker boolean) on commit drop;
create or replace function pg_temp.workboard_prepare_expired_attachment(
  p_room_id text,p_attachment_id uuid,p_no_message_confirmed boolean
) returns text language plpgsql volatile security invoker set search_path='' as $prepare$
declare r public.workboard_attachments_v1%rowtype;
begin
  if p_room_id is null or char_length(p_room_id) not between 1 and 60 or p_attachment_id is null or p_no_message_confirmed is distinct from true then return 'invalid'; end if;
  select * into r from public.workboard_attachments_v1
  where room_id=p_room_id and attachment_id=p_attachment_id for update;
  if not found then return 'missing'; end if;
  if r.message_id is not null or r.state not in ('reserved','uploaded','ready','deleting') or r.expires_at>clock_timestamp()-interval '24 hours' then return 'protected'; end if;
  if r.state='deleting' then return 'ok'; end if;
  update public.workboard_attachments_v1 set state='deleting' where attachment_id=r.attachment_id;
  return 'ok';
end;
$prepare$;
create or replace function pg_temp.workboard_finish_expired_attachment(
  p_room_id text,p_attachment_id uuid,p_no_message_confirmed boolean,p_storage_checked boolean
) returns text language plpgsql volatile security invoker set search_path='' as $finish$
declare r public.workboard_attachments_v1%rowtype;
begin
  if p_room_id is null or char_length(p_room_id) not between 1 and 60 or p_attachment_id is null or p_no_message_confirmed is distinct from true or p_storage_checked is distinct from true then return 'invalid'; end if;
  select * into r from public.workboard_attachments_v1
  where room_id=p_room_id and attachment_id=p_attachment_id for update;
  if not found then return 'missing'; end if;
  if r.message_id is not null or r.state not in ('deleting','deleted') or r.expires_at>clock_timestamp()-interval '24 hours' then return 'protected'; end if;
  if exists(select 1 from storage.objects where bucket_id='workboard-attachments-v1' and name=r.attachment_id::text) then return 'object-present'; end if;
  if r.state='deleted' then return 'ok'; end if;
  update public.workboard_attachments_v1 set state='deleted' where attachment_id=r.attachment_id;
  return 'ok';
end;
$finish$;


-- Claimed rows use a separately held maintenance lease. Run each operation
-- in an explicit transaction and retain the same UUID until finish or abort.
create or replace function pg_temp.workboard_begin_claim_recovery(
  p_room_id text,p_attachment_id uuid,p_lease_id uuid
) returns text language plpgsql volatile security invoker set search_path='' as $start$
declare r public.workboard_attachments_v1%rowtype;
begin
  if p_lease_id is null then return 'invalid'; end if;
  select * into r from public.workboard_attachments_v1
  where room_id=p_room_id and attachment_id=p_attachment_id;
  if not found then return 'missing'; end if;
  if r.state not in ('attached','deleting') or r.message_id is distinct from ('msg_'||r.uploader_id||'_'||r.request_id) then return 'protected'; end if;
  insert into public.workboard_attachment_send_fences_v1(room_id,conversation_id,message_id,lease_id,kind)
  values(r.room_id,r.conversation_id,r.message_id,p_lease_id,'maintenance')
  on conflict do nothing;
  if found or exists(select 1 from public.workboard_attachment_send_fences_v1 f
     where f.room_id=r.room_id and f.conversation_id=r.conversation_id and f.message_id=r.message_id and f.lease_id=p_lease_id and f.kind='maintenance')
  then return 'ok'; end if;
  return 'busy';
end;
$start$;

create or replace function pg_temp.workboard_recover_claimed_attachment(
  p_room_id text,p_attachment_id uuid,p_lease_id uuid,p_stage text,
  p_no_message_confirmed boolean,p_storage_checked boolean
) returns text language plpgsql volatile security invoker set search_path='' as $recover$
declare r public.workboard_attachments_v1%rowtype;
begin
  if p_lease_id is null or p_stage is null or p_stage not in ('prepare','finish','abort') then return 'invalid'; end if;
  select * into r from public.workboard_attachments_v1
  where room_id=p_room_id and attachment_id=p_attachment_id for update;
  if not found then return 'missing'; end if;
  if r.message_id is distinct from ('msg_'||r.uploader_id||'_'||r.request_id) then return 'protected'; end if;
  perform 1 from public.workboard_attachment_send_fences_v1 f
  where f.room_id=r.room_id and f.conversation_id=r.conversation_id and f.message_id=r.message_id
    and f.lease_id=p_lease_id and f.kind='maintenance' for update;
  if not found then
    if p_stage='finish' and r.state='deleted' and p_no_message_confirmed is true and p_storage_checked is true
      and not exists(select 1 from storage.objects where bucket_id='workboard-attachments-v1' and name=r.attachment_id::text)
    then return 'ok'; end if;
    return 'busy';
  end if;
  if p_stage='abort' then
    if r.state<>'attached' then return 'protected'; end if;
  else
    if p_no_message_confirmed is distinct from true then return 'protected'; end if;
    if p_stage='prepare' then
      if r.state not in ('attached','deleting') then return 'protected'; end if;
      update public.workboard_attachments_v1 set state='deleting' where attachment_id=r.attachment_id;
      return 'ok';
    end if;
    if p_storage_checked is distinct from true or r.state<>'deleting' then return 'protected'; end if;
    if exists(select 1 from storage.objects where bucket_id='workboard-attachments-v1' and name=r.attachment_id::text) then return 'object-present'; end if;
    update public.workboard_attachments_v1 set state='deleted' where attachment_id=r.attachment_id;
  end if;
  delete from public.workboard_attachment_send_fences_v1
  where room_id=r.room_id and conversation_id=r.conversation_id and message_id=r.message_id and lease_id=p_lease_id and kind='maintenance';
  return 'ok';
end;
$recover$;

-- Diagnosis is read-only. Age selects candidates and never proves an execution stopped.
create or replace function pg_temp.workboard_list_send_fences(p_room_id text)
returns table(conversation_id text,message_id text,lease_id uuid,acquired_at timestamptz)
language sql stable security invoker set search_path='' as $list$
  select f.conversation_id,f.message_id,f.lease_id,f.acquired_at
  from public.workboard_attachment_send_fences_v1 f
  where f.room_id=p_room_id and f.kind='send' and f.acquired_at<=clock_timestamp()-interval '10 minutes'
  order by f.acquired_at,f.conversation_id,f.message_id limit 50
$list$;

-- The operator keeps admission stopped, proves old workers drained and checks
-- the canonical message before confirming. This changes only one exact send lock.
create or replace function pg_temp.workboard_release_stale_send_fence(
  p_room_id text,p_conversation_id text,p_message_id text,p_lease_id uuid,
  p_admission_stopped boolean,p_workers_drained boolean,p_canonical_checked boolean
) returns text language plpgsql volatile security invoker set search_path='' as $release$
begin
  if p_admission_stopped is distinct from true or p_workers_drained is distinct from true
    or p_canonical_checked is distinct from true or p_lease_id is null
  then return 'protected'; end if;
  delete from public.workboard_attachment_send_fences_v1 f
  where f.room_id=p_room_id and f.conversation_id=p_conversation_id and f.message_id=p_message_id
    and f.lease_id=p_lease_id and f.kind='send' and f.acquired_at<=clock_timestamp()-interval '10 minutes';
  if found then return 'ok'; end if;
  return 'missing-or-protected';
end;
$release$;
