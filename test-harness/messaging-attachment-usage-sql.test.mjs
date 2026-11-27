import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const sql=name=>readFile(new URL('../security/supabase/'+name+'.sql',import.meta.url),'utf8');
const A='p_'+'a'.repeat(32),B='p_'+'b'.repeat(32),self='self_'+A,group='group_g_'+'c'.repeat(32);
test('usage mirrors the quota ledger: reserved/deleting count, deleted frees global but not the day, other people stay private',async()=>{
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
    `);
  await db.exec(await sql('workboard-attachments-v1'));await db.exec(await sql('workboard-attachment-usage-v1'));
  const put=(room,conv,who,state,bytes,i)=>db.query(`insert into public.workboard_attachments_v1(room_id,conversation_id,uploader_id,request_id,request_slot,filename,mime,declared_bytes,state,message_id,created_at,expires_at,actual_bytes,sha256)
    values($1,$2,$3,'q_'||repeat('d',31)||$4::text,0,'a.txt','text/plain',$5,$6,case when $6='attached' then 'msg_x' end,clock_timestamp(),clock_timestamp()+interval '1 hour',case when $6 in ('ready','attached') then $5::bigint end,case when $6 in ('ready','attached') then repeat('e',64) end)`,[room,conv,who,i,bytes,state]);
  await put('r',self,A,'reserved',1000000,1);await put('r',group,A,'attached',2000000,2);await put('r',group,B,'deleting',4000000,3);await put('r',group,B,'deleted',5000000,4);
  const usage=async(person,conv)=>JSON.parse(JSON.stringify((await db.query(`select public.workboard_attachment_usage_v1('r',$1,$2) v`,[conv,person])).rows[0].v));
  const a=await usage(A,group);
  assert.deepEqual([a.globalBytes,a.personBytes,a.conversationBytes,a.dailyBytes],[7000000,3000000,6000000,3000000]);
  const b=await usage(B,group);assert.deepEqual([b.personBytes,b.dailyBytes],[4000000,9000000]);
  assert.deepEqual([a.limitBytes,a.warnBytes,a.cleanupBytes,a.dailyLimitBytes],[800000000,600000000,720000000,20000000]);
  assert.equal(JSON.stringify(a).includes(B),false);
  assert.equal((await usage('bad',group)).status,'invalid');
  const reserve=(who,i,bytes)=>db.query(`select public.workboard_reserve_attachment_v1('r',$1,$2,'q_'||repeat('f',31)||$3::text,0,'b.txt','text/plain',$4) v`,[group,who,i,bytes]).then(r=>r.rows[0].v.status);
  assert.equal(await reserve(A,1,5000000),'ok');assert.equal((await usage(A,group)).dailyBytes,8000000);
  assert.equal(await reserve(B,2,5000000),'ok');assert.equal(await reserve(B,3,5000000),'ok');assert.equal(await reserve(B,4,5000000),'daily-limit');assert.equal((await usage(B,group)).dailyBytes,19000000);
  await db.close();
});
