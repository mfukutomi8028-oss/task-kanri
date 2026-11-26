-- Claim an immutable attachment batch before writing the canonical message.
-- The attached state alone never authorizes a download: the message must exist
-- and contain the attachment. Failed message commits stay quota-accounted.
create function public.workboard_claim_attachments_v1(
  p_room_id text,p_conversation_id text,p_uploader_id text,p_joined_at bigint,
  p_request_id text,p_message_id text,p_attachment_ids uuid[]
) returns jsonb
language plpgsql volatile security invoker set search_path=''
as $claim$
declare
  v_row public.workboard_attachments_v1%rowtype;
  v_count integer:=0;
begin
  if p_room_id is null or char_length(p_room_id) not between 1 and 60
     or p_conversation_id is null or p_conversation_id !~ '^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$'
     or p_uploader_id is null or p_uploader_id !~ '^p_[0-9a-f]{32}$'
     or p_joined_at is null or p_joined_at not between 0 and 9007199254740991
     or p_request_id is null or p_request_id !~ '^q_[0-9a-f]{32}$'
     or p_message_id is distinct from ('msg_'||p_uploader_id||'_'||p_request_id)
     or p_attachment_ids is null or cardinality(p_attachment_ids) not between 1 and 5
     or array_ndims(p_attachment_ids)<>1
     or (select count(distinct id) from unnest(p_attachment_ids) as ids(id))<>cardinality(p_attachment_ids)
  then return jsonb_build_object('status','invalid');
  end if;
  -- Ordered row locks avoid opposing lock order for overlapping batches.
  for v_row in select * from public.workboard_attachments_v1
    where attachment_id=any(p_attachment_ids) order by attachment_id for update
  loop
    v_count:=v_count+1;
    if v_row.room_id<>p_room_id or v_row.conversation_id<>p_conversation_id
       or v_row.uploader_id<>p_uploader_id or v_row.membership_joined_at<>p_joined_at
       or v_row.request_id<>p_request_id or v_row.state not in ('ready','attached')
       or v_row.actual_bytes is distinct from v_row.declared_bytes or v_row.sha256 is null
       or (v_row.state='attached' and v_row.message_id is distinct from p_message_id)
       or (v_row.state='ready' and v_row.message_id is not null)
    then return jsonb_build_object('status','conflict');
    end if;
    if v_row.state='ready' and v_row.expires_at<=clock_timestamp() then
      return jsonb_build_object('status','expired');
    end if;
  end loop;
  if v_count<>cardinality(p_attachment_ids) then return jsonb_build_object('status','conflict'); end if;
  update public.workboard_attachments_v1 set state='attached',message_id=p_message_id
  where attachment_id=any(p_attachment_ids) and state='ready';
  return jsonb_build_object('status','ok');
end;
$claim$;
revoke all on function public.workboard_claim_attachments_v1(text,text,text,bigint,text,text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.workboard_claim_attachments_v1(text,text,text,bigint,text,text,uuid[]) to service_role;

-- Count requested file bytes conservatively, including failed retrievals.
-- A monthly application budget is not a guarantee of provider billing totals.
create table public.workboard_attachment_download_usage_v1 (
  month_start date primary key,
  requested_bytes bigint not null check (requested_bytes between 0 and 4000000000)
);
alter table public.workboard_attachment_download_usage_v1 enable row level security;
revoke all on table public.workboard_attachment_download_usage_v1 from public,anon,authenticated,service_role;
grant select,insert,update on table public.workboard_attachment_download_usage_v1 to service_role;
create function public.workboard_reserve_attachment_download_v1(p_bytes bigint)
returns jsonb language plpgsql volatile security invoker set search_path=''
as $budget$
declare
  v_month date;
  v_total bigint;
begin
  if p_bytes is null or p_bytes not between 1 and 5000000 then return jsonb_build_object('status','invalid'); end if;
  v_month:=date_trunc('month',clock_timestamp() at time zone 'Asia/Tokyo')::date;
  insert into public.workboard_attachment_download_usage_v1(month_start,requested_bytes)
  values(v_month,p_bytes)
  on conflict(month_start) do update
    set requested_bytes=workboard_attachment_download_usage_v1.requested_bytes+excluded.requested_bytes
    where workboard_attachment_download_usage_v1.requested_bytes+excluded.requested_bytes<=4000000000
  returning requested_bytes into v_total;
  if not found then return jsonb_build_object('status','limit'); end if;
  return jsonb_build_object('status','ok');
end;
$budget$;
revoke all on function public.workboard_reserve_attachment_download_v1(bigint) from public,anon,authenticated,service_role;
grant execute on function public.workboard_reserve_attachment_download_v1(bigint) to service_role;
