import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingRecordLinkTransport,recordLinkKey} from '../workspace-messaging-record-links.js';
const personId='p_'+'a'.repeat(32),actor={roomId:'roomA',personId},conversationId='self_'+personId,messageId='msg_'+personId+'_q_'+'b'.repeat(32);
const ref={roomId:'roomA',type:'task',recordId:'task-1'};
function fake(){const data=new Map(),writes=[];let fail=null;return {data,writes,fail(v){fail=v;},sdk:{db:{},ref:(_,p)=>p,get:async p=>{if(fail)throw fail;return {val:()=>data.get(p)??null};},set:async(p,v)=>{if(fail)throw fail;writes.push([p,v]);data.set(p,{...v,createdAt:1});},serverTimestamp:()=>'TS'}};}
test('links are keyed by personId and record, never copy content, and are idempotent',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'ok'});
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'ok'});
  assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0],['messagingV1/roomA/recordLinks/'+personId+'/task/task-1',{conversationId,messageId,createdAt:'TS'}]);
  assert.deepEqual(await t.readLink(actor,ref),{status:'ok',conversationId,messageId});
  assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId:'msg_'+personId+'_q_'+'c'.repeat(32)}),{status:'conflict'});
});
test('invalid scopes, other rooms, memos and unsafe ids are rejected; permission errors map to forbidden',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  for(const bad of [{...ref,type:'memo'},{...ref,roomId:'roomB'},{...ref,recordId:'a/b'},{...ref,recordId:''}])assert.equal((await t.writeLink(actor,bad,{conversationId,messageId})).status,'invalid');
  assert.equal(recordLinkKey({type:'schedule',recordId:'e1'}),'schedule/e1');
  assert.deepEqual(await t.readLink(actor,ref),{status:'missing'});
  f.fail(Object.assign(Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'}));assert.deepEqual(await t.readLink(actor,ref),{status:'forbidden'});
  f.fail(Error('offline'));assert.deepEqual(await t.writeLink(actor,ref,{conversationId,messageId}),{status:'unavailable'});
});
