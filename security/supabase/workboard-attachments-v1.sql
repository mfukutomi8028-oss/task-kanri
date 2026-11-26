-- Workboard messaging / attachment foundation V1.
-- Additive only. No browser access or upload endpoint is enabled by this change.
-- The trusted service MUST authorize Firebase identity and membership first.
create table public.workboard_attachments_v1 (
  attachment_id uuid primary key default gen_random_uuid(),
  room_id text not null check (char_length(room_id) between 1 and 60),
  conversation_id text not null check (conversation_id ~ '^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$'),
  uploader_id text not null check (uploader_id ~ '^p_[0-9a-f]{32}$'),
  request_id text not null check (request_id ~ '^q_[0-9a-f]{32}$'),
  request_slot integer not null check (request_slot between 0 and 4),
  filename text not null check (char_length(filename) between 1 and 200 and filename !~ '[[:cntrl:]]' and strpos(filename,'/')=0 and strpos(filename,chr(92))=0),
  mime text not null check (mime in (
    'image/jpeg','image/png','image/webp','application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv'
  )),
  declared_bytes bigint not null check (declared_bytes between 1 and 5000000),
  actual_bytes bigint check (actual_bytes between 1 and declared_bytes),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'reserved' check (state in ('reserved','uploaded','ready','attached','deleting','deleted')),
  message_id text,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (room_id,conversation_id,uploader_id,request_id,request_slot),
  check (expires_at > created_at),
  check (state not in ('ready','attached') or (actual_bytes is not null and sha256 is not null)),
  check (state <> 'attached' or message_id is not null)
);
create index workboard_attachments_v1_uploader_day_idx
  on public.workboard_attachments_v1 (uploader_id,created_at);
create index workboard_attachments_v1_conversation_idx
  on public.workboard_attachments_v1 (room_id,conversation_id,created_at,attachment_id);
create index workboard_attachments_v1_pending_expiry_idx
  on public.workboard_attachments_v1 (expires_at) where state='reserved';

alter table public.workboard_attachments_v1 enable row level security;
revoke all on table public.workboard_attachments_v1 from public, anon, authenticated, service_role;
grant select, insert, update on table public.workboard_attachments_v1 to service_role;

-- A private, application-specific storage bucket, with defense in depth
-- against any permissive storage policies introduced for other features.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('workboard-attachments-v1','workboard-attachments-v1',false,5000000,array[
  'image/jpeg','image/png','image/webp','application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv'
]);
create policy workboard_attachments_v1_no_client_objects
  on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'workboard-attachments-v1')
  with check (bucket_id <> 'workboard-attachments-v1');

-- All reserve requests use a short transaction lock. Never expose this RPC
-- directly to users. No network operations happen within the SQL transaction.
-- At READ COMMITTED each statement after the lock sees committed reservations.
-- At higher isolation levels, reject rather than risk a stale quota snapshot.
create function public.workboard_reserve_attachment_v1(
  p_room_id text,p_conversation_id text,p_uploader_id text,p_request_id text,
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
    if v_existing.filename<>p_filename or v_existing.mime<>p_mime or v_existing.declared_bytes<>p_bytes
       or v_existing.state in ('deleting','deleted') then
      return jsonb_build_object('status','conflict');
    end if;
    if v_existing.state='reserved' and v_existing.expires_at<=v_now then
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
    (room_id,conversation_id,uploader_id,request_id,request_slot,filename,mime,declared_bytes,created_at,expires_at)
  values (p_room_id,p_conversation_id,p_uploader_id,p_request_id,p_slot,p_filename,p_mime,p_bytes,v_now,v_now+interval '30 minutes')
  returning attachment_id into v_id;
  return jsonb_build_object('status','ok','attachmentId',v_id,'state','reserved');
end;
$$;
revoke all on function public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint)
  to service_role;
