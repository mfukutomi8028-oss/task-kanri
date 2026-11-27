import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingReferenceResolver,searchLoadedMessages,selectSharedData} from '../workspace-messaging-refs.js';
const personId='p_'+'a'.repeat(32),roomId='roomA',conversationId='self_'+personId;
const id=i=>'msg_'+personId+'_q_'+i.toString(16).padStart(32,'0');
const context={roomId,conversationId,personId,joinedAt:1000};
const ref=(type,recordId)=>({roomId,type,recordId});
const message=(i,patch={})=>({id:id(i),senderId:personId,createdAt:1000+i,revision:1,body:'Report',...patch});
function fixture(){
  const snapshot={roomId,currentUser:'Staff A',tasks:[{id:'t1',title:'PC setup',status:'Done',description:'Private detail'}],schedules:[{id:'s1',title:'Install PC',startAt:'2026-11-26T00:00:00Z',endAt:'2026-11-26T01:00:00Z'}]};
  const memos=[{id:'m1',title:'Setup manual',body:'Private memo text'}];const messages=new Map([[id(1),message(1)]]);const opened=[],restored=[];let allowed=true;
  const resolver=createMessagingReferenceResolver({readSnapshot:()=>snapshot,readMemos:()=>memos,canRead:async()=>allowed,readMessage:async({messageId})=>messages.get(messageId),openRecord:async(r)=>{opened.push(r);return true;},restoreConversation:async(value)=>{restored.push(value);return true;}});
  return {snapshot,memos,messages,opened,restored,resolver,setAllowed(v){allowed=v;}};
}
test('all three business reference types resolve current titles without private text',async()=>{
  const f=fixture();const a=await f.resolver.resolve(ref('task','t1'),context),b=await f.resolver.resolve(ref('schedule','s1'),context),c=await f.resolver.resolve(ref('memo','m1'),context);
  assert.equal(a.title,'PC setup');assert.equal(a.currentState,'Done');assert.equal(b.title,'Install PC');assert.equal(c.title,'Setup manual');
  assert.equal(JSON.stringify([a,b,c]).includes('Private'),false);
  f.snapshot.tasks[0].title='Updated';assert.equal((await f.resolver.resolve(ref('task','t1'),context)).title,'Updated');
  assert.deepEqual(await f.resolver.shareRecord(ref('task','t1'),context),ref('task','t1'));
});
test('deleted, denied, other-room or stale-snapshot references expose no cached title',async()=>{
  const f=fixture();f.snapshot.tasks.length=0;assert.deepEqual(await f.resolver.resolve(ref('task','t1'),context),{status:'unavailable'});
  f.setAllowed(false);assert.deepEqual(await f.resolver.resolve(ref('memo','m1'),context),{status:'unavailable'});
  f.setAllowed(true);assert.deepEqual(await f.resolver.resolve({...ref('memo','m1'),roomId:'other'},context),{status:'unavailable'});
  f.snapshot.roomId='other';assert.deepEqual(await f.resolver.resolve(ref('memo','m1'),context),{status:'unavailable'});
});
test('quotes respect membership boundary and never expose deleted bodies',async()=>{
  const f=fixture();assert.equal((await f.resolver.resolveQuote(id(1),context)).excerpt,'Report');
  assert.deepEqual(await f.resolver.resolveQuote(id(1),{...context,joinedAt:1001}),{status:'unavailable'});
  f.messages.set(id(1),message(1,{deletedAt:2000,body:'Removed text'}));assert.deepEqual(await f.resolver.resolveQuote(id(1),context),{status:'unavailable'});
  f.setAllowed(false);assert.deepEqual(await f.resolver.resolveQuote(id(1),context),{status:'unavailable'});
});
test('opening an authorized record and restoring the conversation retains the source location',async()=>{
  const f=fixture();const location={conversationId,messageId:id(1),scrollTop:420,query:'PC'};
  assert.equal(await f.resolver.open(ref('schedule','s1'),context,location),true);assert.deepEqual(f.opened,[ref('schedule','s1')]);
  assert.equal(await f.resolver.restore(context),true);assert.deepEqual(f.restored,[location]);
  f.setAllowed(false);assert.equal(await f.resolver.open(ref('memo','m1'),context,location),false);
});
test('search operates only on loaded authorized messages and current reference titles',async()=>{
  const f=fixture();const messages=[message(1,{body:'Other',refs:[ref('task','t1')]}),message(2,{body:'Report PC'}),message(3,{body:'PC old',deletedAt:2000}),message(4,{body:'Other'})];
  let result=await searchLoadedMessages(messages,{query:'pc',context,resolver:f.resolver});
  assert.equal(result.scope,'loaded');assert.deepEqual(result.matches.map(m=>m.id),[id(2),id(1)]);
  f.setAllowed(false);result=await searchLoadedMessages(messages,{query:'pc',context,resolver:f.resolver});assert.deepEqual(result.matches.map(m=>m.id),[id(2)]);
});
test('shared records are permission-filtered, bounded and link back to a message',async()=>{
  const f=fixture();const messages=[message(1,{refs:[ref('task','t1')]}),message(2,{refs:[ref('memo','m1')]}),message(3,{refs:[ref('task','t1')]}),message(4,{deletedAt:2000,refs:[ref('schedule','s1')]})];
  const {rows}=await selectSharedData(messages,{context,resolver:f.resolver,type:'task',limit:1});
  assert.equal(rows.length,1);assert.deepEqual(rows[0].ref,ref('task','t1'));assert.equal(rows[0].messageId,id(3));
  f.setAllowed(false);assert.deepEqual((await selectSharedData(messages,{context,resolver:f.resolver})).rows,[]);
});

test('shared attachment metadata can page past 20 files to find an older authorized image',async()=>{
  const f=fixture();
  const attachmentId=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
  const messages=Array.from({length:21},(_,i)=>message(i+1,{attachmentIds:[attachmentId(i+1)]}));
  const calls=[];
  const options={context,resolver:f.resolver,type:'image',readAttachmentMetadata:async items=>{
    calls.push(items.length);
    return {status:'ok',items:items.map(item=>({...item,filename:'dummy',mime:item.messageId===id(1)?'image/png':'text/plain'}))};
  }};
  const first=await selectSharedData(messages,options);
  assert.deepEqual(first.rows,[]);
  assert.deepEqual(first.attachments,{offset:0,checked:20,total:21});
  const second=await selectSharedData(messages,{...options,attachmentOffset:20});
  assert.deepEqual(second.rows.map(row=>row.messageId),[id(1)]);
  assert.deepEqual(second.attachments,{offset:20,checked:1,total:21});
  assert.deepEqual(calls,[20,1]);
});
