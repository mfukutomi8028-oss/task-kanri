-- Run after workboard-attachments-epoch-v1.sql, in the same transaction.
-- Privilege checks and synthetic reservation/finalize tests. The nested
-- subtransaction is deliberately rolled back; no attachment is retained.
do $permissions$
declare
  signature text;
begin
  foreach signature in array array[
    'public.workboard_reserve_attachment_v1(text,text,text,bigint,text,integer,text,text,bigint)',
    'public.workboard_finalize_attachment_v1(uuid,text,text,text,bigint,text,integer,bigint,text)'
  ] loop
    if has_function_privilege('anon',signature,'EXECUTE')
       or has_function_privilege('authenticated',signature,'EXECUTE')
       or not has_function_privilege('service_role',signature,'EXECUTE') then
      raise exception 'Unexpected attachment RPC permissions';
    end if;
  end loop;
  if has_table_privilege('anon','public.workboard_attachments_v1','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.workboard_attachments_v1','SELECT,INSERT,UPDATE,DELETE')
     or not (select relrowsecurity from pg_class where oid='public.workboard_attachments_v1'::regclass)
     or not exists (select 1 from storage.buckets where id='workboard-attachments-v1' and public=false and file_size_limit=5000000)
  then raise exception 'Unexpected attachment storage permissions';
  end if;
end;
$permissions$;
set local role service_role;
do $smoke$
declare
  v_room text:='__synthetic_attachment_smoke__';
  v_person text:='p_'||repeat('a',32);
  v_conv text:='self_'||v_person;
  v_request text:='q_'||repeat('b',32);
  v_hash text:=repeat('c',64);
  v_id uuid;
  result jsonb;
begin
  begin
    result:=public.workboard_reserve_attachment_v1(v_room,v_conv,v_person,1000,v_request,0,'report.txt','text/plain',4);
    if result->>'status' is distinct from 'ok' then raise exception 'Reservation failed'; end if;
    v_id:=(result->>'attachmentId')::uuid;
    result:=public.workboard_reserve_attachment_v1(v_room,v_conv,v_person,1000,v_request,0,'report.txt','text/plain',4);
    if result->>'status' is distinct from 'ok' or (result->>'attachmentId')::uuid is distinct from v_id then raise exception 'Retry changed attachment'; end if;
    result:=public.workboard_reserve_attachment_v1(v_room,v_conv,v_person,2000,v_request,0,'report.txt','text/plain',4);
    if result->>'status' is distinct from 'conflict' then raise exception 'Old epoch accepted'; end if;
    result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,2000,v_request,0,4,v_hash);
    if result->>'status' is distinct from 'conflict' then raise exception 'Wrong epoch finalized'; end if;
    result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,1000,v_request,0,3,v_hash);
    if result->>'status' is distinct from 'conflict' then raise exception 'Wrong byte count finalized'; end if;
    result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,1000,v_request,0,4,v_hash);
    if result->>'status' is distinct from 'ok' then raise exception 'Finalize failed'; end if;
    result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,1000,v_request,0,4,v_hash);
    if result->>'status' is distinct from 'ok' then raise exception 'Finalize retry failed'; end if;
    result:=public.workboard_finalize_attachment_v1(v_id,v_room,v_conv,v_person,1000,v_request,0,4,repeat('d',64));
    if result->>'status' is distinct from 'conflict' then raise exception 'Changed hash accepted'; end if;
    if not exists (select 1 from public.workboard_attachments_v1 where attachment_id=v_id and state='ready' and actual_bytes=4 and sha256=v_hash and membership_joined_at=1000) then raise exception 'Ready ledger mismatch'; end if;
    raise exception using errcode='PZ001',message='ROLLBACK_SYNTHETIC_ATTACHMENT_SMOKE';
  exception when sqlstate 'PZ001' then
    if sqlerrm<>'ROLLBACK_SYNTHETIC_ATTACHMENT_SMOKE' then raise; end if;
  end;
  if exists(select 1 from public.workboard_attachments_v1 where room_id=v_room) then raise exception 'Synthetic rows persisted'; end if;
end;
$smoke$;
reset role;
