import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingRecordLinkTransport,recordLinkKey} from '../workspace-messaging-record-links.js';
const personId='p_'+'a'.repeat(32),actor={roomId:'roomA',personId},conversationId='self_'+personId,messageId='msg_'+personId+'_q_'+'b'.repeat(32);
const ref={roomId:'roomA',type:'task',recordId:'task-1'};
const denied=()=>Object.assign(Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
// The fake mirrors the Rules: the first write wins, every rewrite is denied.
function fake(){const data=new Map(),writes=[];let fail=null;return {data,writes,fail(v){fail=v;},sdk:{db:{},ref:(_,p)=>p,get:async p=>{if(fail)throw fail;return {val:()=>data.get(p)??null};},set:async(p,v)=>{if(fail)throw fail;if(data.has(p))throw denied();writes.push([p,v]);data.set(p,{...v,createdAt:1});},serverTimestamp:()=>'TS'}};}
test('one shared link per record, creator recorded by personId, no content copied, idempotent retries',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'ok'});
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'ok'});
  assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0],['messagingV1/roomA/recordLinks/task/task-1',{conversationId,messageId,createdBy:personId,createdAt:'TS'}]);
  // Another person reads the same record-level link.
  assert.deepEqual(await t.readLink({roomId:'roomA',personId:'p_'+'c'.repeat(32)},ref),{status:'ok',conversationId,messageId});
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId:'msg_'+personId+'_q_'+'c'.repeat(32)}),{status:'conflict'});
});
test('invalid scopes, other rooms, memos and unsafe ids are rejected; permission errors map to forbidden',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  for(const bad of [{...ref,type:'memo'},{...ref,roomId:'roomB'},{...ref,recordId:'a/b'},{...ref,recordId:''}])assert.equal((await t.writeLink(actor,bad,{conversationId,messageId})).status,'invalid');
  assert.equal(recordLinkKey({type:'schedule',recordId:'e1'}),'schedule/e1');
  assert.deepEqual(await t.readLink(actor,ref),{status:'missing'});
  f.fail(denied());assert.deepEqual(await t.readLink(actor,ref),{status:'forbidden'});
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'forbidden'});
  f.fail(Error('offline'));assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'unavailable'});
});
test('pending link intents survive a reload, stay scoped by room and person, and can be cleared',async()=>{
  const {createPendingLinkStore}=await import('../origin-messaging-live.js');
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const scope={roomId:'roomA',personId},otherScope={roomId:'roomA',personId:'p_'+'c'.repeat(32)};
  const first=createPendingLinkStore(storage);
  const key=first.add(scope,{type:'schedule',recordId:'s1',conversationId,messageId});
  first.add(scope,{type:'schedule',recordId:'s2',conversationId,messageId});
  assert.equal(key,'schedule/s1');
  // A new page load (new store instance) sees the same intents; another person sees none.
  const reloaded=createPendingLinkStore(storage);
  assert.deepEqual(Object.keys(reloaded.read(scope)).sort(),['schedule/s1','schedule/s2']);
  assert.deepEqual(reloaded.read(otherScope),{});
  assert.equal(JSON.stringify([...data.values()]).includes('body'),false);
  reloaded.remove(scope,'schedule/s1');assert.deepEqual(Object.keys(createPendingLinkStore(storage).read(scope)),['schedule/s2']);
  reloaded.clear(scope);assert.equal(data.size,0);
  // Corrupt or blocked storage never throws.
  const blocked=createPendingLinkStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
  assert.equal(blocked.add(scope,{type:'task',recordId:'t1',conversationId,messageId}),'task/t1');
  assert.deepEqual(Object.keys(blocked.read(scope)),['task/t1']);
  data.set('wb-messaging-pending-links-v1|roomA|'+personId,'{not json');assert.deepEqual(createPendingLinkStore(storage).read(scope),{});
});
