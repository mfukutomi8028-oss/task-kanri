import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMessagingAttachmentAccessService} from '../security/messaging-attachment-access.mjs';
const roomId='roomA',sender='p_'+'a'.repeat(32),personId='p_'+'b'.repeat(32),conversationId='dm_'+sender+'_'+personId,requestId='q_'+'c'.repeat(32),messageId='msg_'+sender+'_'+requestId;
const attachmentId='00000000-0000-4000-8000-000000000001',secondId='00000000-0000-4000-8000-000000000002';
const bytes=new TextEncoder().encode('report'),hash=createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const calls=[];let member={active:true,joinedAt:1000},binding={uid:'uidB',personId,roomId,approved:true,active:true};
  let message={id:messageId,senderId:sender,createdAt:2000,revision:1,body:'',attachmentIds:[attachmentId]};
  let row={attachmentId,roomId,conversationId,uploaderId:sender,joinedAt:500,requestId,slot:0,state:'attached',messageId,filename:'report.txt',mime:'text/plain',declaredBytes:6,actualBytes:6,sha256:hash};
  let object=bytes.slice(),quota={status:'ok'},onRead=()=>{};
  const service=createMessagingAttachmentAccessService({verifyToken:async token=>{if(token!=='token')throw Error('invalid');return {uid:'uidB'};},readBinding:async()=>binding,readControl:async()=>({id:conversationId,roomId,status:'active',members:{[personId]:member}}),readMessage:async scope=>{calls.push(['message',scope]);return message;},readLedger:async id=>{calls.push(['ledger',id]);return row;},reserveDownload:async target=>{calls.push(['quota',target]);return quota;},readObject:async id=>{calls.push(['storage',id]);await onRead();return object;},claimBatch:async target=>{calls.push(['claim',target]);return {status:'ok'};}});
  const request={token:'token',roomId,conversationId,expectedPersonId:personId,messageId,attachmentId};
  const claim={roomId,conversationId,personId:sender,joinedAt:500,requestId,messageId,attachmentIds:[attachmentId,secondId]};
  return {service,request,claim,calls,member(patch){member={...member,...patch};},binding(patch){binding={...binding,...patch};},message(patch){message={...message,...patch};},row(patch){row={...row,...patch};},quota(v){quota=v;},object(v){object=v;},onRead(fn){onRead=fn;}};
}
test('download uses canonical message and bound ledger, charges measured bytes before returning immutable bytes',async()=>{
  const f=fixture(),result=await f.service.download(f.request);
  assert.deepEqual(result,{status:'ok',filename:'report.txt',mime:'text/plain',bytes});
  assert.deepEqual(f.calls.find(c=>c[0]==='quota'),['quota',{roomId,personId,bytes:6}]);
  assert.ok(f.calls.findIndex(c=>c[0]==='quota')<f.calls.findIndex(c=>c[0]==='storage'));
});
test('unapproved, revoked, other-person and pre-join reads never touch storage or quota',async()=>{
  for(const change of [f=>f.binding({approved:false}),f=>f.binding({active:false}),f=>f.member({active:false}),f=>f.member({joinedAt:2000}),f=>{f.request.expectedPersonId=sender;},f=>{f.request.token='forged';}]){
    const f=fixture();change(f);assert.deepEqual(await f.service.download(f.request),{status:'forbidden'});assert.equal(f.calls.filter(c=>['quota','storage'].includes(c[0])).length,0);
  }
});
test('an unreferenced, deleted, ready, wrong-message, wrong-room or wrong-owner attachment is denied',async()=>{
  for(const change of [f=>f.message({attachmentIds:[secondId]}),f=>f.message({deletedAt:2100}),f=>f.row({state:'ready'}),f=>f.row({messageId:'msg_'+sender+'_q_'+'d'.repeat(32)}),f=>f.row({roomId:'other'}),f=>f.row({uploaderId:personId}),f=>f.row({joinedAt:2000}),f=>f.row({requestId:'q_'+'d'.repeat(32)})]){
    const f=fixture();change(f);assert.deepEqual(await f.service.download(f.request),{status:'forbidden'});assert.equal(f.calls.filter(c=>['quota','storage'].includes(c[0])).length,0);
  }
});
test('quota rejection prevents storage access and is not a false successful download',async()=>{
  const f=fixture();f.quota({status:'limit'});assert.deepEqual(await f.service.download(f.request),{status:'limit'});assert.equal(f.calls.filter(c=>c[0]==='storage').length,0);
});
test('size or hash mismatch never returns corrupted bytes',async()=>{
  for(const data of [new Uint8Array([1]),new TextEncoder().encode('forged')]){const f=fixture();f.object(data);assert.deepEqual(await f.service.download(f.request),{status:'unavailable'});}
});
test('membership change, message deletion or ledger detachment during read rejects the result',async()=>{
  for(const change of [f=>f.member({joinedAt:1500}),f=>f.binding({active:false}),f=>f.message({deletedAt:2100}),f=>f.message({attachmentIds:[]}),f=>f.row({state:'deleting'})]){const f=fixture();f.onRead(()=>change(f));assert.deepEqual(await f.service.download(f.request),{status:'forbidden'});}
});
test('claim is bound to server-derived deterministic message and unique bounded IDs',async()=>{
  const f=fixture();assert.deepEqual(await f.service.claim(f.claim),{status:'ok'});assert.deepEqual(f.calls,[['claim',f.claim]]);
  for(const patch of [{messageId:'msg_'+personId+'_'+requestId},{attachmentIds:[attachmentId,attachmentId]},{attachmentIds:['pending']},{attachmentIds:[]},{personId:'staff'},{joinedAt:-1},{roomId:'x/y'}]){const g=fixture();assert.deepEqual(await g.service.claim({...g.claim,...patch}),{status:'invalid'});assert.deepEqual(g.calls,[]);}
});

test('shared metadata omits deleted or inaccessible attachments without reading bytes or spending download quota',async()=>{
  const f=fixture();
  const {messageId,attachmentId,...actor}=f.request;
  const input={...actor,items:[{messageId,attachmentId},{messageId,attachmentId:secondId}]};
  assert.deepEqual(await f.service.metadata(input),{status:'ok',items:[{messageId,attachmentId,filename:'report.txt',mime:'text/plain',bytes:6}]});
  f.message({deletedAt:2100});
  assert.deepEqual(await f.service.metadata(input),{status:'ok',items:[]});
  f.member({active:false});
  assert.deepEqual(await f.service.metadata(input),{status:'forbidden'});
  assert.equal(f.calls.filter(([kind])=>kind==='storage'||kind==='quota').length,0);
});
