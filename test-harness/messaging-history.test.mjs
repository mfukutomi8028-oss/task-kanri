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
test('a jump reads one bounded window around any target, never the whole span to the latest',async()=>{
  // 5,200 messages: targets 300, 301 and 4,950 messages away from the latest.
  const records=Array.from({length:5200},(_,i)=>row(i+2));
  const windows=[],afters=[];
  const base={verifyToken:async token=>token==='tokenA'?{uid:'uidA'}:null,readBinding:async()=>okBinding(),readMember:async()=>okMember(),readPage:async()=>[]};
  const service=createMessagingHistoryService({...base,readTarget:async request=>structuredClone(records.find(r=>r.id===request.messageId)??null),
    readWindow:async request=>{
      windows.push(request);const index=records.findIndex(r=>r.id===request.around);
      if(index<0)return {status:'missing'};
      const older=records.slice(Math.max(0,index-request.older-1),index),newer=records.slice(index+1,index+request.newer+2);
      return {status:'ok',records:structuredClone([...older.slice(-request.older),records[index],...newer.slice(0,request.newer)]),hasMore:older.length>request.older,hasNewer:newer.length>request.newer};
    },
    readAfter:async request=>{
      afters.push(request);const index=records.findIndex(r=>r.id===request.after.id);
      const next=records.slice(index+1,index+request.limit+2);
      return {status:'ok',records:structuredClone(next.slice(0,request.limit)),hasNewer:next.length>request.limit};
    }});
  for(const distance of [300,301,4950]){
    const target=records[records.length-1-distance];
    const r=await service.readHistory({...call,around:target.id});
    assert.equal(r.status,'ok');assert.ok(r.messages.length<=50);
    assert.equal(r.messages[24].id,target.id);assert.equal(r.hasMore,true);assert.equal(r.hasNewer,true);
    assert.deepEqual(r.nextCursor,{createdAt:r.messages[0].createdAt,id:r.messages[0].id});
    assert.deepEqual(r.newerCursor,{createdAt:r.messages.at(-1).createdAt,id:r.messages.at(-1).id});
    // The unloaded gap is filled one page at a time.
    const next=await service.readHistory({...call,after:r.newerCursor,limit:50});
    assert.equal(next.status,'ok');assert.equal(next.messages.length,50);assert.equal(next.hasNewer,true);
    assert.equal(next.messages[0].createdAt>r.messages.at(-1).createdAt,true);
  }
  assert.equal(windows.every(w=>w.older===24&&w.newer===25&&w.joinedAt===1000),true);
  // The window at the very start of the history has nothing older.
  const first=await service.readHistory({...call,around:records[0].id});
  assert.equal(first.hasMore,false);assert.equal(first.nextCursor,null);assert.equal(first.messages[0].id,records[0].id);
  // The last page after a window reaches the latest message.
  const tail=await service.readHistory({...call,after:{createdAt:records.at(-3).createdAt,id:records.at(-3).id},limit:50});
  assert.equal(tail.messages.length,2);assert.equal(tail.hasNewer,false);assert.equal(tail.newerCursor,null);
  assert.deepEqual(await service.readHistory({...call,around:msgId(99999)}),{status:'missing'});
  // A pre-join cursor or a window without its target is never accepted.
  assert.deepEqual(await service.readHistory({...call,after:{createdAt:900,id:msgId(1)},limit:50}),{status:'missing'});
  const lying=createMessagingHistoryService({...base,readTarget:async()=>records[4],readWindow:async()=>({status:'ok',records:[records[5]],hasMore:false,hasNewer:false})});
  assert.deepEqual(await lying.readHistory({...call,around:records[4].id}),{status:'unavailable'});
  // Mixed or unsupported modes are invalid, never a silent page.
  assert.deepEqual(await service.readHistory({...call,around:records[4].id,before:{createdAt:2000,id:msgId(3)}}),{status:'invalid'});
  assert.deepEqual(await createMessagingHistoryService(base).readHistory({...call,around:records[4].id}),{status:'invalid'});
  assert.deepEqual(await service.readHistory({...call,until:records[4].id}),{status:'invalid'});
});
test('a window is authorized again before it is returned',async()=>{
  let active=true;
  const records=Array.from({length:80},(_,i)=>row(i+2));
  const service=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>({...okBinding(),active}),readMember:async()=>okMember(),readPage:async()=>[],readTarget:async()=>records[40],
    readWindow:async request=>{active=false;const index=records.findIndex(r=>r.id===request.around);return {status:'ok',records:structuredClone(records.slice(index-3,index+3)),hasMore:true,hasNewer:true};}});
  assert.deepEqual(await service.readHistory({...call,around:records[40].id}),{status:'forbidden'});
});
test('a target deleted while its window is read is reported as missing, never as success',async()=>{
  const records=Array.from({length:80},(_,i)=>row(i+2));
  let deleted=false;const reads=[];
  const service=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>okBinding(),readMember:async()=>okMember(),readPage:async()=>[],
    readWindow:async request=>{const index=records.findIndex(r=>r.id===request.around);deleted=true;return {status:'ok',records:structuredClone(records.slice(index-3,index+3)),hasMore:true,hasNewer:true};},
    // The target is read again after the window, right before the response.
    readTarget:async request=>{reads.push(request);const target=records.find(r=>r.id===request.messageId);return deleted?{...target,deletedAt:5000}:target;}});
  assert.deepEqual(await service.readHistory({...call,around:records[40].id}),{status:'missing'});
  assert.deepEqual(reads,[{roomId:room,conversationId:group,messageId:records[40].id}]);
  // A target that disappears entirely is missing too.
  const gone=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>okBinding(),readMember:async()=>okMember(),readPage:async()=>[],
    readWindow:async request=>{const index=records.findIndex(r=>r.id===request.around);return {status:'ok',records:structuredClone(records.slice(index-3,index+3)),hasMore:true,hasNewer:true};},
    readTarget:async()=>null});
  assert.deepEqual(await gone.readHistory({...call,around:records[40].id}),{status:'missing'});
  // Without a target reader a window cannot be served.
  const unchecked=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>okBinding(),readMember:async()=>okMember(),readPage:async()=>[],
    readWindow:async request=>{const index=records.findIndex(r=>r.id===request.around);return {status:'ok',records:structuredClone(records.slice(index-3,index+3)),hasMore:true,hasNewer:true};}});
  assert.deepEqual(await unchecked.readHistory({...call,around:records[40].id}),{status:'invalid'});
});
test('history is never returned when access changes during any of its database reads, including the target re-check',async()=>{
  const records=Array.from({length:80},(_,i)=>row(i+2));
  for(const change of ['revoke','leave','rejoin','rebind']){
    let binding=okBinding(),member=okMember();
    const apply={revoke:()=>{binding={...binding,active:false};},leave:()=>{member={...member,active:false};},rejoin:()=>{member={...member,joinedAt:1500};},rebind:()=>{binding={...binding,personId:bob};}}[change];
    const service=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>structuredClone(binding),readMember:async()=>structuredClone(member),readPage:async()=>[],
      readWindow:async request=>{const index=records.findIndex(r=>r.id===request.around);return {status:'ok',records:structuredClone(records.slice(index-3,index+3)),hasMore:true,hasNewer:true};},
      // Access changes while the last database read (the target re-check) is in flight.
      readTarget:async request=>{apply();return structuredClone(records.find(r=>r.id===request.messageId));}});
    assert.deepEqual(await service.readHistory({...call,around:records[40].id}),{status:'forbidden'},change);
  }
});
test('review5: the inclusive range read starts at the given row, respects ties and the join time, and rejects bad pages',async()=>{
  const records=Array.from({length:120},(_,i)=>row(i+2)).map((r,i)=>i>=40&&i<44?{...r,createdAt:1042}:r);
  const cmp=(a,b)=>a.createdAt-b.createdAt||(a.id<b.id?-1:a.id>b.id?1:0);
  const reads=[];
  const base={verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>okBinding(),readMember:async()=>okMember(),readPage:async()=>[]};
  const service=createMessagingHistoryService({...base,readAfter:async request=>{reads.push(request);
    const next=records.filter(r=>request.inclusive?cmp(r,request.after)>=0:cmp(r,request.after)>0).slice(0,request.limit+1);
    return {status:'ok',records:structuredClone(next.slice(0,request.limit)),hasNewer:next.length>request.limit};}});
  const tie={createdAt:1042,id:records[42].id};
  const page=await service.readHistory({...call,from:tie,limit:50});
  assert.equal(page.status,'ok');assert.equal(page.messages[0].id,records[42].id);assert.equal(page.messages.length,50);
  assert.equal(page.hasNewer,true);assert.deepEqual(page.newerCursor,{createdAt:page.messages.at(-1).createdAt,id:page.messages.at(-1).id});
  assert.equal(reads[0].inclusive,true);
  const after=await service.readHistory({...call,after:tie,limit:50});
  assert.equal(after.messages[0].id,records[43].id);assert.equal(reads[1].inclusive,false);
  // Join boundary, mixed modes and pages outside the range.
  assert.deepEqual(await service.readHistory({...call,from:{createdAt:1000,id:records[0].id},limit:50}),{status:'missing'});
  for(const bad of [{from:tie,before:tie},{from:tie,after:tie},{from:tie,around:records[5].id},{from:{createdAt:1042},limit:50}])
    assert.deepEqual(await service.readHistory({...call,...bad}),{status:'invalid'});
  const lying=createMessagingHistoryService({...base,readAfter:async()=>({status:'ok',records:[records[10]],hasNewer:false})});
  assert.deepEqual(await lying.readHistory({...call,from:tie,limit:50}),{status:'unavailable'});
  const tooMany=createMessagingHistoryService({...base,readAfter:async()=>({status:'ok',records:structuredClone(records.slice(50,52)),hasNewer:false})});
  assert.deepEqual(await tooMany.readHistory({...call,from:{createdAt:records[50].createdAt,id:records[50].id},limit:1}),{status:'unavailable'});
});
test('review5: every history mode re-checks access after its last database read',async()=>{
  const records=Array.from({length:120},(_,i)=>row(i+2));
  for(const mode of ['page','after','from','around']){
    const order=[];let binding=okBinding();
    const revokeOnRead=fn=>async request=>{const out=await fn(request);order.push('read');binding={...binding,active:false};return out;};
    const service=createMessagingHistoryService({verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>{order.push('binding');return structuredClone(binding);},readMember:async()=>okMember(),
      readPage:revokeOnRead(async()=>structuredClone(records.slice(-5))),
      readAfter:revokeOnRead(async()=>({status:'ok',records:structuredClone(records.slice(60,65)),hasNewer:false})),
      readWindow:async request=>{order.push('window');const i=records.findIndex(r=>r.id===request.around);return {status:'ok',records:structuredClone(records.slice(i-2,i+3)),hasMore:true,hasNewer:true};},
      readTarget:revokeOnRead(async request=>structuredClone(records.find(r=>r.id===request.messageId)))});
    const request={page:{},after:{after:{createdAt:records[59].createdAt,id:records[59].id},limit:50},from:{from:{createdAt:records[60].createdAt,id:records[60].id},limit:50},around:{around:records[40].id}}[mode];
    assert.deepEqual(await service.readHistory({...call,...request}),{status:'forbidden'},mode);
    assert.equal(order.at(-1),'binding',mode+': the access check is the last step');
  }
});
