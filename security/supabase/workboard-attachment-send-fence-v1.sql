-- Durable arbitration between an attachment send and operator maintenance.
-- In-flight claims have no automatic expiry. A lost worker leaves a safe hold.
begin;
create table public.workboard_attachment_send_fences_v1 (
  room_id text not null check (char_length(room_id) between 1 and 60),
  conversation_id text not null check (conversation_id ~ '^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$'),
  message_id text not null check (message_id ~ '^msg_p_[0-9a-f]{32}_q_[0-9a-f]{32}$'),
  lease_id uuid not null,
  kind text not null check (kind in ('send','maintenance')),
  acquired_at timestamptz not null default clock_timestamp(),
  primary key (room_id,conversation_id,message_id)
);
alter table public.workboard_attachment_send_fences_v1 enable row level security;
revoke all on public.workboard_attachment_send_fences_v1 from public,anon,authenticated,service_role;
grant select,insert,delete on public.workboard_attachment_send_fences_v1 to service_role;

create function public.workboard_acquire_attachment_send_v1(
  p_room_id text,p_conversation_id text,p_message_id text,p_lease_id uuid
) returns jsonb language plpgsql volatile security invoker set search_path='' as $acquire$
begin
  insert into public.workboard_attachment_send_fences_v1(room_id,conversation_id,message_id,lease_id,kind)
  values(p_room_id,p_conversation_id,p_message_id,p_lease_id,'send')
  on conflict do nothing;
  return jsonb_build_object('status',case when found then 'ok' else 'busy' end);
end;
$acquire$;

create function public.workboard_release_attachment_send_v1(
  p_room_id text,p_conversation_id text,p_message_id text,p_lease_id uuid
) returns jsonb language plpgsql volatile security invoker set search_path='' as $release$
begin
  delete from public.workboard_attachment_send_fences_v1
  where room_id=p_room_id and conversation_id=p_conversation_id and message_id=p_message_id and lease_id=p_lease_id and kind='send';
  return jsonb_build_object('status',case when found then 'ok' else 'missing' end);
end;
$release$;

revoke all on function public.workboard_acquire_attachment_send_v1(text,text,text,uuid),public.workboard_release_attachment_send_v1(text,text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.workboard_acquire_attachment_send_v1(text,text,text,uuid),public.workboard_release_attachment_send_v1(text,text,text,uuid)
  to service_role;
commit;
