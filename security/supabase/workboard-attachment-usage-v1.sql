-- Read-only usage view for the attachment ledger. Additive; never exposed to clients.
-- The predicates deliberately mirror workboard_reserve_attachment_v1: the global and
-- per-person totals count every row whose state is not 'deleted' (reserved, uploaded,
-- ready, attached and deleting rows all hold capacity), and the daily total counts
-- today's rows in Asia/Tokyo even after deletion. Limits are returned so the display
-- cannot drift from the enforced 800 MB / 20 MB values.
create function public.workboard_attachment_usage_v1(p_room_id text,p_conversation_id text,p_person_id text)
returns jsonb
language plpgsql stable security invoker
set search_path=''
as $$
declare
  v_day_start timestamptz:=((clock_timestamp() at time zone 'Asia/Tokyo')::date::timestamp at time zone 'Asia/Tokyo');
  v_global bigint;
  v_person bigint;
  v_conversation bigint;
  v_daily bigint;
begin
  if p_room_id is null or char_length(p_room_id) not between 1 and 60 or p_room_id<>btrim(p_room_id) or p_room_id ~ '[[:cntrl:]]'
     or p_conversation_id is null or p_conversation_id !~ '^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$'
     or p_person_id is null or p_person_id !~ '^p_[0-9a-f]{32}$'
  then return jsonb_build_object('status','invalid');
  end if;
  select coalesce(sum(declared_bytes) filter (where state<>'deleted'),0),
         coalesce(sum(declared_bytes) filter (where state<>'deleted' and uploader_id=p_person_id),0),
         coalesce(sum(declared_bytes) filter (where state<>'deleted' and room_id=p_room_id and conversation_id=p_conversation_id),0),
         coalesce(sum(declared_bytes) filter (where uploader_id=p_person_id and created_at>=v_day_start),0)
    into v_global,v_person,v_conversation,v_daily
  from public.workboard_attachments_v1;
  return jsonb_build_object('status','ok','globalBytes',v_global,'personBytes',v_person,'conversationBytes',v_conversation,
    'dailyBytes',v_daily,'limitBytes',800000000,'warnBytes',600000000,'cleanupBytes',720000000,'dailyLimitBytes',20000000);
end;
$$;
revoke all on function public.workboard_attachment_usage_v1(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.workboard_attachment_usage_v1(text,text,text) to service_role;
