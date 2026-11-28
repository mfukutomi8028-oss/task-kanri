import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingRecordLinkTransport,recordLinkKey} from '../workspace-messaging-record-links.js';
import {issueRecordId,isIssuedRecordId} from '../security/messaging-record-origin-service.mjs';
import {createMessagingApiHandler} from '../security/messaging-api-handler.mjs';
const personId='p_'+'a'.repeat(32),actor={roomId:'roomA',personId},conversationId='self_'+personId,messageId='msg_'+personId+'_q_'+'b'.repeat(32);
const ref={roomId:'roomA',type:'task',recordId:'task-1'};
const denied=()=>Object.assign(Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
function fake(){const data=new Map();let fail=null;return {data,fail(v){fail=v;},sdk:{db:{},ref:(_,p)=>p,get:async p=>{if(fail)throw fail;return {val:()=>data.get(p)??null};}}};}
test('the browser only reads record links; there is no client write path',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  assert.deepEqual(Object.keys(t),['readLink']);
  f.data.set('messagingV1/roomA/recordLinks/task/task-1',{conversationId,messageId,createdBy:personId,createdAt:5});
  // Another person reads the same record-level link.
  assert.deepEqual(await t.readLink({roomId:'roomA',personId:'p_'+'c'.repeat(32)},ref),{status:'ok',conversationId,messageId});
  f.data.set('messagingV1/roomA/recordLinks/task/task-2',{conversationId,messageId:'forged',createdBy:personId,createdAt:5});
  assert.deepEqual(await t.readLink(actor,{...ref,recordId:'task-2'}),{status:'unavailable'});
});
test('invalid scopes, other rooms, memos and unsafe ids are rejected; permission errors map to forbidden',async()=>{
  const f=fake(),t=createMessagingRecordLinkTransport(f.sdk);
  for(const bad of [{...ref,type:'memo'},{...ref,roomId:'roomB'},{...ref,recordId:'a/b'},{...ref,recordId:''}])assert.equal((await t.readLink(actor,bad)).status,'invalid');
  assert.equal(recordLinkKey({type:'schedule',recordId:'e1'}),'schedule/e1');
  assert.deepEqual(await t.readLink(actor,ref),{status:'missing'});
  f.fail(denied());assert.deepEqual(await t.readLink(actor,ref),{status:'forbidden'});
  f.fail(Error('offline'));assert.deepEqual(await t.readLink(actor,ref),{status:'unavailable'});
});
test('issued record ids keep the push-key shape but are never sequential or predictable',()=>{
  const now=1767225600000,ids=Array.from({length:200},()=>issueRecordId(now));
  assert.equal(ids.every(isIssuedRecordId),true);
  assert.equal(new Set(ids).size,200);
  // Same millisecond: identical time prefix, independent random suffixes (no +1 increments).
  assert.equal(new Set(ids.map(id=>id.slice(0,8))).size,1);
  const chars='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const value=id=>[...id.slice(8)].reduce((n,c)=>n*64n+BigInt(chars.indexOf(c)),0n);
  const sorted=ids.map(value).sort((a,b)=>a<b?-1:a>b?1:0);
  assert.equal(sorted.slice(1).some((v,i)=>v-sorted[i]===1n),false);
  for(const bad of ['task-1','-abc','-'+'a'.repeat(18)+'/','x'+'a'.repeat(19)])assert.equal(isIssuedRecordId(bad),false);
});
test('earlier browser pending-link entries are removed and nothing new is stored',async()=>{
  const {removeLegacyPendingLinks}=await import('../origin-messaging-live.js');
  const data=new Map([['wb-messaging-pending-links-v1|roomA|'+personId,'{"task/t1":{}}'],['wb-messaging-pending-links-v1|roomB|'+personId,'{}'],['workBoardDisplayV356:roomA','modern']]);
  const storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  assert.equal(removeLegacyPendingLinks(storage),2);
  assert.deepEqual([...data.keys()],['workBoardDisplayV356:roomA']);
  assert.equal(removeLegacyPendingLinks({get length(){throw Error('blocked');}}),0);
});
test('the reservation API is budgeted within the per-request cap and absent unless configured',async()=>{
  const services={history:{readHistory:async()=>({status:'ok'})},mutation:{mutate:async()=>({status:'ok'})},directory:{readDirectory:async()=>({status:'ok'}),readUnread:async()=>({status:'ok'})},conversations:{readPeople:async()=>({status:'ok'}),execute:async()=>({status:'ok'})}};
  const units=[];
  const handler=createMessagingApiHandler({allowedOrigins:['https://origin.example'],...services,recordOrigins:{reserve:async request=>({status:'ok',requestId:request.requestId,recordType:request.recordType,ids:[issueRecordId(1)]})},
    authorizeRequest:async()=>({uid:'uidA',personId}),reserveRequest:async(action,n)=>{units.push([action,n]);return {status:'ok'};},checkAvailable:async()=>true});
  const call=(action,payload)=>handler(new Request('https://api.example/',{method:'POST',headers:{Origin:'https://origin.example',Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify({action,payload,expectedPersonId:personId})}));
  const response=await call('recordReserve',{roomId:'roomA',conversationId,messageId,requestId:'q_'+'1'.repeat(32),recordType:'schedule',count:200});
  assert.equal(response.status,200);
  for(const action of ['recordConfirm','recordResume','recordLink'])assert.equal((await call(action,{roomId:'roomA'})).status,400);
  await call('history',{roomId:'roomA',conversationId,around:messageId});
  assert.deepEqual(units,[['recordReserve',224],['history',58]]);
  assert.equal(units.every(([,n])=>n<=304),true);
  const without=createMessagingApiHandler({allowedOrigins:['https://origin.example'],...services});
  const r=await without(new Request('https://api.example/',{method:'POST',headers:{Origin:'https://origin.example',Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify({action:'recordReserve',payload:{roomId:'roomA'},expectedPersonId:personId})}));
  assert.equal(r.status,400);
});
