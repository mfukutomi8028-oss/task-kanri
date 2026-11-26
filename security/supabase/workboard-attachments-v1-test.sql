-- Isolated synthetic reservation tests. No objects are uploaded.
-- Execute only against an empty workboard attachment ledger.
-- All fixture changes are rolled back even when an assertion fails.
begin;
do $test$
declare
  p text := 'p_'||repeat('a',32);
  q text := 'q_'||repeat('b',32);
  c text := 'self_p_'||repeat('a',32);
  r jsonb; initial jsonb;
  other_p text; other_q text;
  remaining bigint;
  i integer:=0;
begin
  if exists(select 1 from public.workboard_attachments_v1) then
    raise exception 'Synthetic quota test requires an empty ledger';
  end if;
  if not exists(select 1 from storage.buckets
    where id='workboard-attachments-v1' and public=false and file_size_limit=5000000
    and 'application/pdf'=any(allowed_mime_types) and not ('text/html'=any(allowed_mime_types))) then
    raise exception 'Private bucket restrictions missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.workboard_attachments_v1'::regclass)
     or has_table_privilege('anon','public.workboard_attachments_v1','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.workboard_attachments_v1','SELECT,INSERT,UPDATE,DELETE')
     or has_function_privilege('anon','public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint)','EXECUTE')
     or not has_function_privilege('service_role','public.workboard_reserve_attachment_v1(text,text,text,text,integer,text,text,bigint)','EXECUTE') then
    raise exception 'Role boundary failed';
  end if;
  initial:=public.workboard_reserve_attachment_v1('room-test',c,p,q,0,'test.pdf','application/pdf',5000000);
  if initial->>'status'<>'ok' or initial->>'attachmentId' is null then raise exception 'Valid reservation failed'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,0,'test.pdf','application/pdf',5000000);
  if r is distinct from initial then raise exception 'Idempotent retry changed the reservation'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,0,'other.pdf','application/pdf',5000000);
  if r->>'status'<>'conflict' then raise exception 'Changed request was accepted'; end if;
  for i in 1..3 loop
    r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,i,'test.pdf','application/pdf',5000000);
    if r->>'status'<>'ok' then raise exception 'Daily allowance rejected'; end if;
  end loop;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,4,'test.pdf','application/pdf',1);
  if r->>'status'<>'daily-limit' then raise exception 'Daily cap bypassed'; end if;
  update public.workboard_attachments_v1 set state='deleted' where attachment_id=(initial->>'attachmentId')::uuid;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,4,'test.pdf','application/pdf',1);
  if r->>'status'<>'daily-limit' then raise exception 'Delete bypassed daily cap'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,4,'test.pdf','application/pdf',5000001);
  if r->>'status'<>'invalid' then raise exception 'File size cap bypassed'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,4,'test.html','text/html',100);
  if r->>'status'<>'invalid' then raise exception 'Disallowed MIME accepted'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,5,'test.pdf','application/pdf',100);
  if r->>'status'<>'invalid' then raise exception 'Message slot cap bypassed'; end if;
  r:=public.workboard_reserve_attachment_v1('room-test',c,p,q,4,'../test.pdf','application/pdf',100);
  if r->>'status'<>'invalid' then raise exception 'Unsafe filename accepted'; end if;
  -- Fill the application-wide budget using metadata only, independent users.
  remaining:=800000000-(select coalesce(sum(declared_bytes),0) from public.workboard_attachments_v1 where state<>'deleted');
  i:=0;
  while remaining>0 loop
    i:=i+1;
    other_p:='p_'||md5('workboard-synthetic-person-'||i);
    other_q:='q_'||md5('workboard-synthetic-request-'||i);
    r:=public.workboard_reserve_attachment_v1('room-test','self_'||other_p,other_p,other_q,0,'test.pdf','application/pdf',least(5000000,remaining));
    if r->>'status'<>'ok' then raise exception 'Budget prematurely rejected'; end if;
    remaining:=remaining-least(5000000,remaining);
  end loop;
  other_p:='p_'||md5('workboard-synthetic-over-budget');
  r:=public.workboard_reserve_attachment_v1('room-test','self_'||other_p,other_p,'q_'||md5('overflow'),0,'test.pdf','application/pdf',1);
  if r->>'status'<>'storage-limit' then raise exception 'Global quota bypassed'; end if;
  if (select sum(declared_bytes) from public.workboard_attachments_v1 where state<>'deleted')<>800000000 then
    raise exception 'Global quota accounting mismatch';
  end if;
end;
$test$;
select 'WORKBOARD_ATTACHMENT_FOUNDATION_OK' as verification;
rollback;
