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
