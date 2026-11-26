import test from 'node:test';
import assert from 'node:assert/strict';
import * as activity from './messaging-preview/workspace-messaging-activity.js';
import * as publisher from '../security/messaging-activity-publisher.mjs';
const roomId='roomA',personId='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),conversationId='group_g_'+'c'.repeat(32);
const identity={status:'bound',roomId,personId},scope={roomId,conversationId};
const root='messagingV1/'+roomId;
const memberPath=root+'/control/'+conversationId+'/members/'+personId;
const signalPath=root+'/activity/'+conversationId;
const personalPath=root+'/personal/'+personId+'/'+conversationId+'/1000';
const marker='00000000-0000-4000-8000-000000000001';
const marker2='00000000-0000-4000-8000-000000000002';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  let current=identity;const watches=new Map(),removed=[],events=[];
  const session={getSnapshot:()=>current};
  assert.equal(typeof activity.createFirebaseMessagingActivityTransport,'function');
  const transport=activity.createFirebaseMessagingActivityTransport({db:{},session,ref:(_db,path)=>path,onValue(path,onData,onError){const watch={onData,onError};watches.set(path,watch);return ()=>{removed.push(path);if(watches.get(path)===watch)watches.delete(path);};}});
  const stop=transport.observeActivity(scope,()=>events.push('refresh'),()=>events.push('error'));
  return {transport,events,watches,removed,stop,changeIdentity(v){current=v;},emit(path,value){assert.ok(watches.has(path),path);watches.get(path).onData({val:()=>value});}};
}
test('only the active conversation metadata is observed; bursts trigger a single refresh',async()=>{
  const f=fixture();assert.deepEqual([...f.watches.keys()],[memberPath]);
  f.emit(memberPath,{active:true,joinedAt:1000,role:'member'});
  assert.deepEqual([...f.watches.keys()],[memberPath,signalPath,personalPath+'/readCursor',personalPath+'/preferences']);
  f.emit(signalPath,marker);f.emit(personalPath+'/readCursor',null);f.emit(personalPath+'/preferences',null);await tick();
  assert.deepEqual(f.events,['refresh']);f.events.length=0;
  f.emit(signalPath,marker2);f.emit(personalPath+'/readCursor',{id:'msg_'+other+'_q_'+'1'.repeat(32),createdAt:2000});f.emit(personalPath+'/preferences',{muted:true});await tick();
  assert.deepEqual(f.events,['refresh']);f.stop();assert.equal(f.watches.size,0);assert.equal(f.removed.length,4);
});
test('a delayed callback after cleanup or identity switch cannot refresh the old conversation',async()=>{
  const f=fixture();f.emit(memberPath,{active:true,joinedAt:1000});const late=f.watches.get(signalPath).onData;await tick();f.events.length=0;
  f.changeIdentity({...identity,personId:other});late({val:()=>marker});await tick();assert.deepEqual(f.events,[]);f.stop();late({val:()=>marker2});await tick();assert.deepEqual(f.events,[]);
});
test('revoked membership and changed membership epoch fail closed and remove all observers',async()=>{
  for(const member of [{active:false,joinedAt:1000},{active:true,joinedAt:3000},null]){
    const f=fixture();f.emit(memberPath,{active:true,joinedAt:1000});await tick();f.events.length=0;const late=f.watches.get(signalPath).onData;
    f.emit(memberPath,member);late({val:()=>marker2});await tick();assert.deepEqual(f.events,['error']);assert.equal(f.watches.size,0);f.stop();
  }
});
test('permission errors and malformed activity markers terminate the observer',async()=>{
  for(const fail of [f=>f.watches.get(signalPath).onError(new Error('permission-denied')),f=>f.emit(signalPath,{body:'unexpected'})]){
    const f=fixture();f.emit(memberPath,{active:true,joinedAt:1000});fail(f);await tick();assert.deepEqual(f.events,['error']);assert.equal(f.watches.size,0);f.stop();
  }
});
test('synchronous cancellation during registration still unsubscribes',async()=>{
  assert.equal(typeof activity.createFirebaseMessagingActivityTransport,'function');let removed=0,errors=0;
  const transport=activity.createFirebaseMessagingActivityTransport({db:{},session:{getSnapshot:()=>identity},ref:(_db,path)=>path,onValue(_ref,_value,error){error(new Error('denied'));return ()=>removed++;}});
  const stop=transport.observeActivity(scope,()=>assert.fail('no refresh'),()=>errors++);stop();assert.equal(removed,1);assert.equal(errors,1);
});
test('invalid or different-room subscription does not touch Firebase',()=>{
  const f=fixture();const before=f.watches.size;let errors=0;const stop=f.transport.observeActivity({...scope,roomId:'other'},()=>assert.fail(),()=>errors++);stop();assert.equal(errors,1);assert.equal(f.watches.size,before);f.stop();
});
test('publisher writes only a fresh opaque token at the conversation scope',async()=>{
  assert.equal(typeof publisher.createFirebaseMessagingActivityPublisher,'function');const writes=[];let next=marker;
  const publish=publisher.createFirebaseMessagingActivityPublisher({database:{ref:path=>({set:async value=>writes.push([path,value])})},makeToken:()=>next});
  assert.deepEqual(await publish(scope),{status:'ok'});next=marker2;assert.deepEqual(await publish(scope),{status:'ok'});
  assert.deepEqual(writes,[[signalPath,marker],[signalPath,marker2]]);
});
test('publisher rejects invalid paths or token data and reports a failed write',async()=>{
  assert.equal(typeof publisher.createFirebaseMessagingActivityPublisher,'function');let writes=0;
  const database={ref:()=>({set:async()=>{writes++;throw Error('offline');}})};
  const publish=publisher.createFirebaseMessagingActivityPublisher({database,makeToken:()=>marker});
  assert.deepEqual(await publish({...scope,conversationId:'../other'}),{status:'invalid'});assert.equal(writes,0);
  assert.deepEqual(await publish(scope),{status:'unavailable'});assert.equal(writes,1);
  const malformed=publisher.createFirebaseMessagingActivityPublisher({database,makeToken:()=>({body:'secret'})});assert.deepEqual(await malformed(scope),{status:'unavailable'});assert.equal(writes,1);
});

import {createMessagingMutationService} from '../security/messaging-mutation-service.mjs';
function mutationFixture({publishStatus='ok',denied=false}={}){
  let stored=null,now=2000,signalStatus=publishStatus;const published=[];
  const service=createMessagingMutationService({digestKey:new Uint8Array(32).fill(8),clock:()=>now,
    verifyToken:async token=>({uid:token}),readBinding:async({uid})=>({uid,roomId,personId,approved:true,active:true}),
    readControl:async()=>({status:'active',members:{[personId]:{active:true,joinedAt:1000}}}),
    transactMessage:async(_scope,decide)=>{if(denied)return {status:'forbidden'};const decision=decide(stored);if(decision.changed)stored=structuredClone(decision.record);return {status:'ok',decision};},
    publishActivity:async target=>{assert.ok(stored);published.push(target);return {status:signalStatus};}
  });
  const send={token:'uidA',roomId,conversationId,command:{type:'send',requestId:'q_'+'d'.repeat(32),input:{body:'Hello'}}};
  return {service,send,published,get stored(){return stored;},setNow(v){now=v;},setSignalStatus(v){signalStatus=v;}};
}
test('committed sends and edits publish only conversation scope, but failed writes do not',async()=>{
  const f=mutationFixture(),r=await f.service.mutate(f.send);assert.equal(r.status,'sent');assert.deepEqual(f.published,[scope]);
  f.setNow(3000);assert.equal((await f.service.mutate({...f.send,command:{type:'edit',messageId:r.id,expectedRevision:1,input:{body:'Edited'}}})).status,'ok');
  assert.deepEqual(f.published,[scope,scope]);assert.equal((await f.service.mutate({...f.send,command:{...f.send.command,input:{body:'Different'}}})).status,'conflict');assert.equal(f.published.length,2);
  f.setNow(4000);assert.equal((await f.service.mutate({...f.send,command:{type:'remove',messageId:r.id,expectedRevision:2}})).status,'ok');assert.equal(f.published.length,3);
  const denied=mutationFixture({denied:true});assert.deepEqual(await denied.service.mutate(denied.send),{status:'forbidden'});assert.deepEqual(denied.published,[]);
});
test('notification failure cannot undo the committed message and retry repairs the marker without duplicating content',async()=>{
  const f=mutationFixture({publishStatus:'unavailable'});const first=await f.service.mutate(f.send);
  assert.equal(first.status,'sent');assert.equal(first.activityPending,true);assert.equal(f.stored.body,'Hello');
  f.setSignalStatus('ok');f.setNow(3000);const retry=await f.service.mutate(f.send);assert.deepEqual(retry,{status:'sent',id:first.id});assert.equal(f.stored.createdAt,2000);assert.equal(f.published.length,2);
});
