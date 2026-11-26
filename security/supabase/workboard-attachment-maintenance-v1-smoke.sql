-- Run only with empty ledger. Wrap this and maintenance definitions in BEGIN/ROLLBACK.
do $test$
declare
  r text:='__synthetic_expiry_maintenance__';
  p text:='p_'||repeat('a',32);
  c text:='self_'||p;
  q text:='q_'||repeat('b',32);
  ids uuid[]:=array[]::uuid[];
  v_id uuid;
  v_state text;
  i integer;
begin
  if exists(select 1 from public.workboard_attachments_v1) then raise exception 'Requires empty ledger'; end if;
  for i in 0..4 loop
    v_state:=case i when 0 then 'reserved' when 1 then 'ready' when 2 then 'attached' when 3 then 'uploaded' else 'ready' end;
    insert into public.workboard_attachments_v1(room_id,conversation_id,uploader_id,membership_joined_at,request_id,request_slot,filename,mime,declared_bytes,actual_bytes,sha256,state,message_id,created_at,expires_at)
    values(r,c,p,1000,q,i,'synthetic.txt','text/plain',4,case when v_state in ('ready','attached') then 4 else null end,case when v_state in ('ready','attached') then repeat('c',64) else null end,v_state,case when v_state='attached' then 'msg_'||p||'_'||q else null end,clock_timestamp()-interval '26 hours',case when i=1 then clock_timestamp()+interval '1 hour' else clock_timestamp()-interval '25 hours' end)
    returning attachment_id into v_id;
    ids:=array_append(ids,v_id);
  end loop;
  if pg_temp.workboard_prepare_expired_attachment(r,ids[1],false)<>'invalid' then raise exception 'Confirmation bypass'; end if;
  if pg_temp.workboard_prepare_expired_attachment('wrong-room',ids[1],true)<>'missing' then raise exception 'Room boundary bypass'; end if;
  if pg_temp.workboard_prepare_expired_attachment(r,ids[2],true)<>'protected' then raise exception 'Unexpired row accepted'; end if;
  if pg_temp.workboard_prepare_expired_attachment(r,ids[3],true)<>'protected' then raise exception 'Attached row accepted'; end if;
  if pg_temp.workboard_finish_expired_attachment(r,ids[1],true,true)<>'protected' then raise exception 'Finalize before prepare'; end if;
  foreach v_id in array array[ids[1],ids[4],ids[5]] loop
    if pg_temp.workboard_prepare_expired_attachment(r,v_id,true)<>'ok' or pg_temp.workboard_prepare_expired_attachment(r,v_id,true)<>'ok' then raise exception 'Prepare/retry failed'; end if;
    if not exists(select 1 from public.workboard_attachments_v1 where attachment_id=v_id and state='deleting') then raise exception 'Quota released too early'; end if;
    if pg_temp.workboard_finish_expired_attachment(r,v_id,true,false)<>'invalid' then raise exception 'Storage confirmation bypass'; end if;
    if pg_temp.workboard_finish_expired_attachment(r,v_id,true,true)<>'ok' or pg_temp.workboard_finish_expired_attachment(r,v_id,true,true)<>'ok' then raise exception 'Finish/retry failed'; end if;
  end loop;
  if (select count(*) from public.workboard_attachments_v1 where room_id=r and state='deleted')<>3 or (select count(*) from public.workboard_attachments_v1 where room_id=r)<>5 then raise exception 'Ledger or daily usage lost'; end if;
  if (select state from public.workboard_attachments_v1 where attachment_id=ids[3])<>'attached' then raise exception 'Live attachment changed'; end if;
end;
$test$;
