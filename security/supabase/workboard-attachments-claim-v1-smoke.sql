-- Run in the same transaction as the migration. Synthetic rows are rolled back.
do $privileges$
declare sig text;
begin
  foreach sig in array array['public.workboard_claim_attachments_v1(text,text,text,bigint,text,text,uuid[])','public.workboard_reserve_attachment_download_v1(bigint)'] loop
    if has_function_privilege('anon',sig,'EXECUTE') or has_function_privilege('authenticated',sig,'EXECUTE') or not has_function_privilege('service_role',sig,'EXECUTE') then raise exception 'Attachment RPC privilege mismatch'; end if;
  end loop;
  if has_table_privilege('anon','public.workboard_attachment_download_usage_v1','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.workboard_attachment_download_usage_v1','SELECT,INSERT,UPDATE,DELETE') or not (select relrowsecurity from pg_class where oid='public.workboard_attachment_download_usage_v1'::regclass) then raise exception 'Budget ledger privilege mismatch'; end if;
end;
$privileges$;
set local role service_role;
do $smoke$
declare
  v_room text:='__synthetic_claim_smoke__';
  v_person text:='p_'||repeat('a',32);
  v_conv text:='self_'||v_person;
  v_request text:='q_'||repeat('b',32);
  v_message text:='msg_'||v_person||'_'||v_request;
  v_ids uuid[]:=array[]::uuid[];
  v_id uuid;
  v_result jsonb;
  v_month date:=date_trunc('month',clock_timestamp() at time zone 'Asia/Tokyo')::date;
begin
  begin
    for slot in 0..1 loop
      v_result:=public.workboard_reserve_attachment_v1(v_room,v_conv,v_person,1000,v_request,slot,'test.txt','text/plain',4);
      if v_result->>'status' is distinct from 'ok' then raise exception 'Reservation failed'; end if;
      v_id:=(v_result->>'attachmentId')::uuid;v_ids:=array_append(v_ids,v_id);
      if slot=0 then
        v_result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,1000,v_request,slot,4,repeat('c',64));
        if v_result->>'status' is distinct from 'ok' then raise exception 'Finalize failed'; end if;
      end if;
    end loop;
    v_result:=public.workboard_claim_attachments_v1(v_room,v_conv,v_person,1000,v_request,v_message,v_ids);
    if v_result->>'status' is distinct from 'conflict' or exists(select 1 from public.workboard_attachments_v1 where attachment_id=any(v_ids) and state='attached') then raise exception 'Partial batch committed'; end if;
    v_result:=public.workboard_finalize_attachment_v1(v_ids[2],v_room,v_conv,v_person,1000,v_request,1,4,repeat('d',64));
    if v_result->>'status' is distinct from 'ok' then raise exception 'Second finalize failed'; end if;
    v_result:=public.workboard_claim_attachments_v1(v_room,v_conv,v_person,2000,v_request,v_message,v_ids);
    if v_result->>'status' is distinct from 'conflict' then raise exception 'Wrong epoch accepted'; end if;
    v_result:=public.workboard_claim_attachments_v1(v_room,v_conv,v_person,1000,v_request,v_message,array[v_ids[1],v_ids[1]]);
    if v_result->>'status' is distinct from 'invalid' then raise exception 'Duplicate ID accepted'; end if;
    v_result:=public.workboard_claim_attachments_v1(v_room,v_conv,v_person,1000,v_request,v_message,v_ids);
    if v_result->>'status' is distinct from 'ok' or (select count(*) from public.workboard_attachments_v1 where attachment_id=any(v_ids) and state='attached' and message_id=v_message)<>2 then raise exception 'Batch claim failed'; end if;
    v_result:=public.workboard_claim_attachments_v1(v_room,v_conv,v_person,1000,v_request,v_message,v_ids);
    if v_result->>'status' is distinct from 'ok' then raise exception 'Claim retry failed'; end if;
    v_result:=public.workboard_reserve_attachment_download_v1(4);
    if v_result->>'status' is distinct from 'ok' then raise exception 'Budget reservation failed'; end if;
    update public.workboard_attachment_download_usage_v1 set requested_bytes=3999999999 where month_start=v_month;
    v_result:=public.workboard_reserve_attachment_download_v1(2);
    if v_result->>'status' is distinct from 'limit' then raise exception 'Budget overflow accepted'; end if;
    v_result:=public.workboard_reserve_attachment_download_v1(1);
    if v_result->>'status' is distinct from 'ok' or (select requested_bytes from public.workboard_attachment_download_usage_v1 where month_start=v_month)<>4000000000 then raise exception 'Budget boundary failed'; end if;
    raise exception using errcode='PZ002',message='ROLLBACK_SYNTHETIC_CLAIM_SMOKE';
  exception when sqlstate 'PZ002' then
    if sqlerrm<>'ROLLBACK_SYNTHETIC_CLAIM_SMOKE' then raise; end if;
  end;
  if exists(select 1 from public.workboard_attachments_v1 where room_id=v_room) or exists(select 1 from public.workboard_attachment_download_usage_v1) then raise exception 'Synthetic rows persisted'; end if;
end;
$smoke$;
reset role;
