import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseMessagingMutationService} from '../security/messaging-mutation-service.mjs';
const personId='p_'+'a'.repeat(32),peer='p_'+'b'.repeat(32),roomId='roomA',conversationId='dm_'+personId+'_'+peer,requestId='q_'+'c'.repeat(32),messageId='msg_'+personId+'_'+requestId;
const req={token:'synthetic-secret-token',roomId,conversationId,expectedPersonId:personId,command:{type:'send',requestId,input:{body:'synthetic private body'}}};
function setup(failAt,diagnosticThrows=false){
  let stored=null,events=[],authCalls=0;
  const secretError=Object.assign(new TypeError('synthetic private body synthetic-secret-token'),{code:'ERR_INVALID_ARG_TYPE'});
  const ref={on(){},off(){if(failAt==='release')throw secretError;},async once(){if(failAt==='read')throw secretError;return {val:()=>stored};},async transaction(decide){if(failAt==='transaction')throw secretError;const value=decide(stored);if(failAt==='abort')return {committed:false};if(value===undefined)return {committed:false};stored=JSON.parse(JSON.stringify(value));return {committed:true};}};
  const database={ref(path){return {async get(){if(path.startsWith('messagingAccessV1/'))return {val:()=>({uid:'uidA',roomId,personId,approved:true,active:true})};if(failAt==='control')throw secretError;return {val:()=>({status:'active',revision:1,members:{[personId]:{active:true,joinedAt:1000},[peer]:{active:true,joinedAt:1000}}})};},async set(){if(failAt==='activity')throw secretError;}};}};
  const service=createFirebaseMessagingMutationService({auth:{async verifyIdToken(){authCalls++;return {uid:'uidA'};}},database,digestKey:new Uint8Array(32).fill(7),clock:()=>2000,
    withActorDatabase:async(override,op)=>{if(failAt==='scope')throw secretError;return op({ref:()=>ref});},diagnostic:event=>{events.push(event);if(diagnosticThrows)throw Error('diagnostic failure');}});
  return {service,events,get stored(){return stored;},get authCalls(){return authCalls;}};
}
test('unavailable transaction reports a safe stage rather than request or exception contents',async()=>{
 const f=setup('transaction');assert.deepEqual(await f.service.mutate(req),{status:'unavailable'});assert.ok(f.events.some(e=>e.stage==='scoped-transaction'&&e.kind==='invalid-argument'));assert.equal(f.stored,null);const serialized=JSON.stringify(f.events);for(const s of [req.token,req.command.input.body,roomId,conversationId,personId,requestId,messageId])assert.equal(serialized.includes(s),false);
});
test('scope, read, abort, and release failures are distinguished',async()=>{
 for(const [failure,stage] of [['scope','scoped-app'],['read','scoped-read'],['abort','scoped-abort'],['release','scoped-release'],['control','authorize']]){const f=setup(failure);assert.deepEqual(await f.service.mutate(req),{status:'unavailable'});assert.ok(f.events.some(e=>e.stage===stage),failure+' did not report '+stage);}
});
test('successful send and idempotent retry do not produce diagnostics',async()=>{
 const f=setup();assert.deepEqual(await f.service.mutate(req),{status:'sent',id:messageId});assert.deepEqual(await f.service.mutate(req),{status:'sent',id:messageId});assert.equal(f.stored.body,req.command.input.body);assert.deepEqual(f.events,[]);
});
test('diagnostic callbacks cannot change the failure result or turn it into success',async()=>{
 const f=setup('transaction',true);assert.deepEqual(await f.service.mutate(req),{status:'unavailable'});assert.equal(f.stored,null);assert.ok(f.events.length>0);
});
