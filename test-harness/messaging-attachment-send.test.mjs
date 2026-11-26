import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMessageInput} from './messaging-preview/workspace-messaging-core.js';
import {createMessagingMutationService} from '../security/messaging-mutation-service.mjs';
const roomId='roomA',personId='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),conversationId='dm_'+personId+'_'+other,requestId='q_'+'c'.repeat(32),messageId='msg_'+personId+'_'+requestId;
const id='00000000-0000-4000-8000-000000000001',otherId='00000000-0000-4000-8000-000000000002';
const send={token:'token',roomId,conversationId,command:{type:'send',requestId,input:{body:'',attachmentIds:[id]}}};
function fixture({claimStatus='ok',configured=true}={}){
  let stored=null,active=true;const calls=[];
  const claimAttachments=async target=>{calls.push(['claim',target]);return {status:claimStatus};};
  const service=createMessagingMutationService({digestKey:new Uint8Array(32).fill(7),clock:()=>2000,verifyToken:async()=>({uid:'uidA'}),readBinding:async()=>({uid:'uidA',roomId,personId,approved:true,active}),readControl:async()=>({status:'active',members:{[personId]:{active:true,joinedAt:1000}}}),transactMessage:async(scope,decide)=>{calls.push(['write',scope]);const decision=decide(stored);if(decision.changed)stored=structuredClone(decision.record);return {status:'ok',decision};},...(configured?{claimAttachments}:{})});
  return {service,calls,get stored(){return stored;},revoke(){active=false;}};
}
test('message accepts up to five unique UUIDs and attachment-only content',()=>{
  assert.deepEqual(validateMessageInput({body:'',attachmentIds:[id]}).attachmentIds,[id]);
  for(const attachmentIds of [[id,id],['pending'],Array(6).fill(id),[null],new Array(1)])assert.throws(()=>validateMessageInput({body:'text',attachmentIds}),TypeError);
});
test('authorized sender claims attachment IDs before canonical message write, with an idempotent retry',async()=>{
  const f=fixture();assert.deepEqual(await f.service.mutate(send),{status:'sent',id:messageId});assert.deepEqual(f.calls[0],['claim',{roomId,conversationId,personId,joinedAt:1000,requestId,messageId,attachmentIds:[id]}]);assert.equal(f.calls[1][0],'write');assert.deepEqual(f.stored.attachmentIds,[id]);assert.deepEqual(await f.service.mutate(send),{status:'sent',id:messageId});assert.equal(f.stored.revision,1);
});
test('failed or unavailable attachment claim never writes a message',async()=>{
  for(const opts of [{configured:false},{claimStatus:'conflict'},{claimStatus:'expired'},{claimStatus:'unavailable'}]){const f=fixture(opts);assert.notEqual((await f.service.mutate(send)).status,'sent');assert.equal(f.stored,null);assert.ok(f.calls.every(x=>x[0]!=='write'));}
});
test('an unauthorized request cannot claim or write',async()=>{
  const f=fixture();f.revoke();assert.deepEqual(await f.service.mutate(send),{status:'forbidden'});assert.deepEqual(f.calls,[]);
});
test('edits cannot replace or silently remove attachments, deletion removes references',async()=>{
  const f=fixture();await f.service.mutate(send);
  const edit={token:'token',roomId,conversationId,command:{type:'edit',messageId,expectedRevision:1,input:{body:'edited',attachmentIds:[otherId]}}};
  assert.deepEqual(await f.service.mutate(edit),{status:'conflict'});assert.deepEqual(f.stored.attachmentIds,[id]);
  assert.deepEqual(await f.service.mutate({...edit,command:{...edit.command,input:{body:'edited'}}}),{status:'conflict'});
  const accepted=await f.service.mutate({...edit,command:{...edit.command,input:{body:'edited',attachmentIds:[id]}}});assert.equal(accepted.status,'ok');assert.deepEqual(f.stored.attachmentIds,[id]);
  const removed=await f.service.mutate({...edit,command:{type:'remove',messageId,expectedRevision:2}});assert.equal(removed.status,'ok');assert.equal(f.stored.attachmentIds,undefined);
});
