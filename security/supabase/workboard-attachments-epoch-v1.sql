-- Workboard attachments: membership-epoch binding and atomic ready transition.
-- Requires the original workboard-attachments-v1.sql. This is a candidate
-- migration for an unused attachment ledger, not a destructive backfill.
-- No RLS or storage bucket policy is relaxed.
lock table public.workboard_attachments_v1 in access exclusive mode;
do $guard$
begin
  if exists (select 1 from public.workboard_attachments_v1) then
    raise exception 'Existing attachments require a reviewed membership migration';
  end if;
end;
$guard$;
alter table public.workboard_attachments_v1
  add column membership_joined_at bigint not null
  check (membership_joined_at between 0 and 9007199254740991);

create function public.workboard_reserve_attachment_v1(
  p_room_id text,p_conversation_id text,p_uploader_id text,p_joined_at bigint,p_request_id text,
  p_slot integer,p_filename text,p_mime text,p_bytes bigint
) returns jsonb
language plpgsql volatile security invoker
set search_path=''
as $$
declare
  v_existing public.workboard_attachments_v1%rowtype;
  v_now timestamptz;
  v_day_start timestamptz;
  v_global bigint;
  v_daily bigint;
  v_id uuid;
begin
  if p_room_id is null or char_length(p_room_id) not between 1 and 60
     or p_room_id <> btrim(p_room_id) or p_room_id ~ '[[:cntrl:]]'
     or p_conversation_id is null or p_conversation_id !~ '^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$'
     or p_uploader_id is null or p_uploader_id !~ '^p_[0-9a-f]{32}$'
     or p_joined_at is null or p_joined_at not between 0 and 9007199254740991
     or p_request_id is null or p_request_id !~ '^q_[0-9a-f]{32}$'
     or p_slot is null or p_slot not between 0 and 4
     or p_filename is null or char_length(p_filename) not between 1 and 200
     or p_filename ~ '[[:cntrl:]]' or strpos(p_filename,'/')>0 or strpos(p_filename,chr(92))>0
     or p_mime is null or p_mime not in (
       'image/jpeg','image/png','image/webp','application/pdf',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
       'text/plain','text/csv'
     )
     or p_bytes is null or p_bytes not between 1 and 5000000
  then return jsonb_build_object('status','invalid');
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Attachment reservation requires read committed isolation';
  end if;
  perform pg_advisory_xact_lock(20261126,7001);
  v_now:=clock_timestamp();
  v_day_start:=((v_now at time zone 'Asia/Tokyo')::date::timestamp at time zone 'Asia/Tokyo');

  select * into v_existing from public.workboard_attachments_v1
  where room_id=p_room_id and conversation_id=p_conversation_id and uploader_id=p_uploader_id
    and request_id=p_request_id and request_slot=p_slot;
  if found then
    if v_existing.membership_joined_at<>p_joined_at or v_existing.filename<>p_filename or v_existing.mime<>p_mime or v_existing.declared_bytes<>p_bytes
       or v_existing.state in ('deleting','deleted') then
      return jsonb_build_object('status','conflict');
    end if;
    if v_existing.state in ('reserved','uploaded') and v_existing.expires_at<=v_now then
      return jsonb_build_object('status','expired');
    end if;
    return jsonb_build_object('status','ok','attachmentId',v_existing.attachment_id,'state',v_existing.state);
  end if;
  -- Count all non-deleted reservations, including uncertain uploads/deletions.
  -- The later cleanup service may mark deleted only after object absence is verified.
  select coalesce(sum(declared_bytes),0) into v_global
  from public.workboard_attachments_v1 where state<>'deleted';
  if v_global+p_bytes>800000000 then
    return jsonb_build_object('status','storage-limit');
  end if;
  -- Count today's requests even after deletion, to prevent repeated reserve/delete abuse.
  select coalesce(sum(declared_bytes),0) into v_daily
  from public.workboard_attachments_v1 where uploader_id=p_uploader_id and created_at>=v_day_start;
  if v_daily+p_bytes>20000000 then
    return jsonb_build_object('status','daily-limit');
  end if;
  insert into public.workboard_attachments_v1
    (room_id,conversation_id,uploader_id,membership_joined_at,request_id,request_slot,filename,mime,declared_bytes,created_at,expires_at)
  values (p_room_id,p_conversation_id,p_uploader_id,p_joined_at,p_request_id,p_slot,p_filename,p_mime,p_bytes,v_now,v_now+interval '30 minutes')
  returning attachment_id into v_id;
  return jsonb_build_object('status','ok','attachmentId',v_id,'state','reserved');
end;
$$;
revoke all on function public.workboard_reserve_attachment_v1(text,text,text,bigint,text,integer,text,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.workboard_reserve_attachment_v1(text,text,text,bigint,text,integer,text,text,bigint)
  to service_role;

-- Remove the obsolete overload so callers cannot omit the membership epoch.
drop function public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint);

-- Only a trusted server that has verified the immutable storage object may
-- call this function. It checks the exact reserved scope under a row lock.
create function public.workboard_finalize_attachment_v1(
  p_attachment_id uuid,p_room_id text,p_conversation_id text,p_uploader_id text,
  p_joined_at bigint,p_request_id text,p_slot integer,p_actual_bytes bigint,p_sha256 text
) returns jsonb
language plpgsql volatile security invoker
set search_path=''
as $finalize$
declare
  v_row public.workboard_attachments_v1%rowtype;
begin
  if p_attachment_id is null or p_room_id is null or p_conversation_id is null
     or p_uploader_id is null or p_joined_at is null or p_request_id is null
     or p_slot is null or p_actual_bytes is null or p_actual_bytes not between 1 and 5000000
     or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
  then return jsonb_build_object('status','invalid');
  end if;
  select * into v_row from public.workboard_attachments_v1
  where attachment_id=p_attachment_id for update;
  if not found or v_row.room_id<>p_room_id or v_row.conversation_id<>p_conversation_id
     or v_row.uploader_id<>p_uploader_id or v_row.membership_joined_at<>p_joined_at
     or v_row.request_id<>p_request_id or v_row.request_slot<>p_slot
     or v_row.declared_bytes<>p_actual_bytes
  then return jsonb_build_object('status','conflict');
  end if;
  if v_row.state='ready' then
    if v_row.actual_bytes=p_actual_bytes and v_row.sha256=p_sha256 then
      return jsonb_build_object('status','ok');
    end if;
    return jsonb_build_object('status','conflict');
  end if;
  if v_row.state not in ('reserved','uploaded') then
    return jsonb_build_object('status','conflict');
  end if;
  if v_row.expires_at<=clock_timestamp() then
    return jsonb_build_object('status','expired');
  end if;
  update public.workboard_attachments_v1
  set state='ready',actual_bytes=p_actual_bytes,sha256=p_sha256
  where attachment_id=p_attachment_id;
  return jsonb_build_object('status','ok');
end;
$finalize$;
revoke all on function public.workboard_finalize_attachment_v1(uuid,text,text,text,bigint,text,integer,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.workboard_finalize_attachment_v1(uuid,text,text,text,bigint,text,integer,bigint,text)
  to service_role;
