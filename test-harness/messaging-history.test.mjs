import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessagingHistoryService, createFirebaseMessagingHistoryService } from '../security/messaging-history-service.mjs';

const alice='p_'+'a'.repeat(32), bob='p_'+'b'.repeat(32);
const group='group_g_'+'c'.repeat(32), room='roomA';
const msgId=i=>'msg_'+alice+'_q_'+i.toString(16).padStart(32,'0');
const row=i=>({id:msgId(i),senderId:alice,createdAt:i<=1?1000:1000+i,revision:1,body:'Message '+i});
const call={token:'tokenA',roomId:room,conversationId:group};
const okBinding=()=>({uid:'uidA',roomId:room,personId:alice,approved:true,active:true,displayName:'Alice'});
const okMember=()=>({active:true,joinedAt:1000,role:'member'});
function fixture({records=Array.from({length:56},(_,i)=>row(i)),onPage,modifyPage}={}) {
  let binding=okBinding(),member=okMember(),uid='uidA',queries=[];
  const service=createMessagingHistoryService({
    verifyToken:async token=>token==='tokenA'&&uid?{uid}:null,
    readBinding:async ({roomId,uid:requested})=>roomId===room&&requested==='uidA'?structuredClone(binding):null,
    readMember:async ({roomId,conversationId,personId})=>roomId===room&&conversationId===group&&personId===alice?structuredClone(member):null,
    readPage:async request=>{
      queries.push(request); const {joinedAt,before,limit}=request;
      let page=records.filter(r=>r.createdAt>joinedAt&&(!before||r.createdAt<before.createdAt||r.createdAt===before.createdAt&&r.id<before.id)).slice(-limit).map(r=>structuredClone(r));
      onPage?.(f);
      return modifyPage?modifyPage(page):page;
    }
  });
  const f={service,queries,revoke:()=>{binding.active=false;},leave:()=>{member.active=false;},rejoin:()=>{member.joinedAt=1050;},rebind:()=>{binding.personId=bob;},invalidateToken:()=>{uid=null;}};
  return f;
}

test('history returns only newest 50 records after the strict join boundary',async()=>{
  const f=fixture();const r=await f.service.readHistory(call);
  assert.equal(r.status,'ok');assert.equal(r.joinedAt,1000);assert.equal(r.messages.length,50);
  assert.equal(r.messages[0].id,msgId(6));assert.equal(r.messages.at(-1).id,msgId(55));
  assert.deepEqual(r.nextCursor,{createdAt:1006,id:msgId(6)});assert.equal(r.hasMore,true);
  assert.deepEqual(f.queries,[{roomId:room,conversationId:group,joinedAt:1000,before:null,limit:50}]);
  const older=await f.service.readHistory({...call,before:r.nextCursor});
  assert.deepEqual(older.messages.map(m=>m.id),[2,3,4,5].map(msgId));
  assert.equal(older.hasMore,false);assert.equal(older.nextCursor,null);
});
test('cursor with tied timestamps does not repeat or skip the preceding record',async()=>{
  const records=Array.from({length:55},(_,i)=>({...row(i+2),createdAt:1050}));
  const f=fixture({records});const a=await f.service.readHistory(call);
  const b=await f.service.readHistory({...call,before:a.nextCursor});
  assert.equal(a.messages.length,50);assert.equal(b.messages.length,5);
  assert.deepEqual([...b.messages,...a.messages].map(m=>m.id),records.map(m=>m.id));
});
test('invalid tokens, unapproved users, other rooms and nonmembers cannot query messages',async()=>{
  const f=fixture();
  for(const patch of [{token:'forged'},{roomId:'other'},{conversationId:'group_g_'+'e'.repeat(32)}]){
    assert.deepEqual(await f.service.readHistory({...call,...patch}),{status:'forbidden'});
  }
  f.revoke();assert.deepEqual(await f.service.readHistory(call),{status:'forbidden'});
  assert.equal(f.queries.length,0);
});
test('request limits and paths are validated before calling the data source',async()=>{
  const f=fixture();
  for(const patch of [{roomId:'room/other'},{conversationId:'../x'},{conversationId:group+'\n'},{before:{id:msgId(3)+'\n',createdAt:1020}},{limit:51},{limit:0},{limit:1.5},{before:{id:'../x',createdAt:1020}},{before:{id:msgId(3),createdAt:NaN}},{personId:bob}]){
    assert.deepEqual(await f.service.readHistory({...call,...patch}),{status:'invalid'});
  }
  assert.equal(f.queries.length,0);
});
test('revocation or membership change during data retrieval returns no history',async()=>{
  for(const action of ['revoke','leave','rejoin','rebind','invalidateToken']){
    const f=fixture({onPage:f=>f[action]()});
    assert.deepEqual(await f.service.readHistory(call),{status:'forbidden'},action);
  }
});
test('a repository returning out-of-bound, duplicate or unbounded records fails closed',async()=>{
  for(const modifyPage of [p=>[row(1),...p.slice(1)],p=>[p[0],...p],p=>[p[0],p[0]],p=>[...p].reverse(),p=>[{...p[0],senderId:bob}],p=>[{...p[0],refs:[{roomId:'other',type:'memo',recordId:'secret'}]}]]){
    const f=fixture({modifyPage});assert.deepEqual(await f.service.readHistory(call),{status:'unavailable'});
  }
});
test('deleted messages expose only a tombstone; business references contain no cached titles',async()=>{
  const records=[{...row(2),deletedAt:1010,body:'old confidential text',refs:[{title:'hidden'}]},
    {...row(3),refs:[{roomId:room,type:'task',recordId:'task1',title:'hidden'}],internal:'not for UI'}];
  const f=fixture({records});const r=await f.service.readHistory(call);
  assert.equal(r.status,'ok');
  assert.deepEqual(r.messages[0],{id:msgId(2),senderId:alice,createdAt:1002,revision:1,deletedAt:1010});
  assert.deepEqual(r.messages[1].refs,[{roomId:room,type:'task',recordId:'task1'}]);
  assert.equal(JSON.stringify(r).includes('hidden'),false);assert.equal(JSON.stringify(r).includes('confidential'),false);assert.equal(JSON.stringify(r).includes('not for UI'),false);
});
test('adapter construction requires a trusted auth verifier and database',()=>{
  assert.throws(()=>createFirebaseMessagingHistoryService({}),TypeError);
  assert.throws(()=>createMessagingHistoryService({verifyToken:async()=>null}),TypeError);
});

test('the bound UI person assertion must match the token before history is queried',async()=>{
  const f=fixture();assert.deepEqual(await f.service.readHistory({...call,expectedPersonId:bob}),{status:'forbidden'});assert.equal(f.queries.length,0);
  assert.equal((await f.service.readHistory({...call,expectedPersonId:alice})).status,'ok');
});
