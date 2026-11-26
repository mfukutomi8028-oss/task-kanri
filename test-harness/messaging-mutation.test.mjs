import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingMutationService} from '../security/messaging-mutation-service.mjs';
const p='p_'+'a'.repeat(32), b='p_'+'b'.repeat(32), roomId='roomA', conversationId='dm_'+p+'_'+b;
const requestId='q_'+'c'.repeat(32), messageId='msg_'+p+'_'+requestId;
const request={token:'synthetic-token',roomId,conversationId,command:{type:'send',requestId,input:{body:'Report'}}};
function fixture(){
  let binding={uid:'uidA',roomId,personId:p,approved:true,active:true};
  let member={active:true,joinedAt:1000,role:'member'}, status='active',stored=null,revoked=false, beforeCommit=()=>{}, now=2000;
  const calls=[];
  const service=createMessagingMutationService({
    digestKey:new Uint8Array(32).fill(7),clock:()=>now,
    async verifyToken(token){if(token!=='synthetic-token'||revoked)throw Error('invalid');return {uid:'uidA'};},
    async readBinding(target){return target.roomId===roomId&&target.uid==='uidA'?binding:null;},
    async readControl(target){return target.roomId===roomId&&target.conversationId===conversationId?{status, members:{[p]:member}}:null;},
    async transactMessage(scope,decide){
      calls.push(scope);await beforeCommit();
      if(binding.active!==true||binding.personId!==scope.personId||member.active!==true||member.joinedAt!==scope.joinedAt||status!=='active')return {status:'forbidden'};
      const decision=decide(stored);if(decision.changed)stored=structuredClone(decision.record);
      return {status:'ok',decision};
    }
  });
  return {service,calls,get stored(){return stored},setBinding(patch){binding={...binding,...patch}},setMember(patch){member={...member,...patch}},setStatus(v){status=v},revoke(){revoked=true},before(fn){beforeCommit=fn},setNow(v){now=v}};
}
test('authenticated send chooses the sender and commits a scoped record',async()=>{
  const f=fixture();const r=await f.service.mutate(request);
  assert.deepEqual(r,{status:'sent',id:messageId});assert.equal(f.stored.body,'Report');assert.equal(f.stored.senderId,p);
  assert.deepEqual(f.calls[0],{uid:'uidA',roomId,conversationId,personId:p,joinedAt:1000,messageId});
});
test('unapproved, revoked and nonmember requests never enter the write adapter',async()=>{
  for(const change of [f=>f.setBinding({approved:false}),f=>f.setBinding({active:false}),f=>f.setMember({active:false}),f=>f.setStatus('archived'),f=>f.revoke()]){
    const f=fixture();change(f);assert.deepEqual(await f.service.mutate(request),{status:'forbidden'});assert.equal(f.calls.length,0);
  }
});
test('invalid command data does not reach persistence',async()=>{
  const f=fixture();for(const patch of [{roomId:'other/path'},{personId:b},{command:{...request.command,input:{body:' '}}},{command:{...request.command,requestId:'bad'}}])assert.deepEqual(await f.service.mutate({...request,...patch}),{status:'invalid'});
  assert.equal(f.calls.length,0);
});
test('revocation and membership changes before commit are rejected',async()=>{
  for(const change of [f=>f.setMember({active:false}),f=>f.setMember({joinedAt:1500}),f=>f.setBinding({active:false}),f=>f.setStatus('archived')]){
    const f=fixture();f.before(()=>change(f));assert.deepEqual(await f.service.mutate(request),{status:'forbidden'});assert.equal(f.stored,null);
  }
});
test('retry preserves one message and rejects changed content',async()=>{
  const f=fixture();await f.service.mutate(request);f.setNow(3000);
  assert.deepEqual(await f.service.mutate(request),{status:'sent',id:messageId});assert.equal(f.stored.createdAt,2000);
  assert.deepEqual(await f.service.mutate({...request,command:{...request.command,input:{body:'Different'}}}),{status:'conflict'});assert.equal(f.stored.body,'Report');
});
test('edit and delete return only the authorized projection',async()=>{
  const f=fixture();await f.service.mutate(request);f.setNow(3000);
  const edit={...request,command:{type:'edit',messageId,expectedRevision:1,input:{body:'Updated'}}};
  const edited=await f.service.mutate(edit);assert.equal(edited.status,'ok');assert.equal(edited.message.revision,2);assert.equal(edited.message.sendDigest,undefined);
  assert.deepEqual(await f.service.mutate(edit),{status:'conflict'});
  f.setNow(4000);const removed=await f.service.mutate({...request,command:{type:'remove',messageId,expectedRevision:2}});
  assert.deepEqual(removed,{status:'ok',message:{id:messageId,senderId:p,createdAt:2000,revision:3,deletedAt:4000}});assert.equal(f.stored.body,undefined);
});
test('a write result is not returned if identity becomes invalid before response',async()=>{
  const f=fixture();f.before(()=>f.revoke());assert.deepEqual(await f.service.mutate(request),{status:'forbidden'});
});

test('confirmation targets derive from the trusted conversation snapshot and capture its revision for commit',async()=>{
  let scopeSeen, stored;
  const service=createMessagingMutationService({digestKey:new Uint8Array(32).fill(7),clock:()=>3000,
    verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>({uid:'uidA',roomId,personId:p,approved:true,active:true}),
    readControl:async()=>({status:'active',revision:7,members:{[p]:{active:true,joinedAt:1000},[b]:{active:true,joinedAt:2000}}}),
    transactMessage:async(scope,decide)=>{scopeSeen=scope;const decision=decide(null);stored=decision.record;return {status:'ok',decision};}
  });
  assert.deepEqual(await service.mutate({...request,command:{...request.command,input:{body:'Check',confirmationRequested:true}}}),{status:'sent',id:messageId});
  assert.equal(scopeSeen.controlRevision,7);assert.deepEqual(stored.confirmation,{round:1,targets:{[b]:2000}});
});
