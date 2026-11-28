import test from 'node:test';
import assert from 'node:assert/strict';
import * as upload from '../security/messaging-attachment-upload.mjs';
const roomId='roomA',personId='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),conversationId='dm_'+personId+'_'+other,requestId='q_'+'c'.repeat(32),attachmentId='00000000-0000-4000-8000-000000000001';
const data=new TextEncoder().encode('test'),changedData=new TextEncoder().encode('evil');
const now=2000;
function body(bytes){return new ReadableStream({start(c){c.enqueue(bytes);c.close();}});}
function fixture(){
  let binding={uid:'uidA',roomId,personId,approved:true,active:true},member={active:true,joinedAt:1000},ledger=null,object=null,finalizeFails=false,putHook=()=>{},putStatus='stored';const writes=[],calls=[];
  const service=upload.createMessagingAttachmentUploadService({clock:()=>now,verifyToken:async token=>{if(token!=='token')throw Error('denied');return {uid:'uidA'};},readBinding:async()=>binding,readControl:async()=>({id:conversationId,roomId,status:'active',members:{[personId]:member}}),
    reserve:async target=>{calls.push(['reserve',target]);if(!ledger)ledger={attachmentId,...target,state:'reserved',expiresAt:now+1000,actualBytes:null,sha256:null};return {status:'ok',attachmentId};},
    readLedger:async id=>id===attachmentId?ledger:null,
    putObject:async(id,bytes,mime)=>{assert.equal(id,attachmentId);writes.push([id,mime]);if(object)return {status:'exists'};object=bytes.slice();await putHook();return {status:putStatus};},
    readObject:async()=>object?.slice()??null,
    finalize:async(target)=>{calls.push(['finalize',target]);if(finalizeFails)return {status:'unavailable'};if(ledger.state==='reserved')ledger={...ledger,state:'ready',actualBytes:target.actualBytes,sha256:target.sha256};return {status:'ok'};}
  });
  const request=(bytes=data,patch={})=>({token:'token',roomId,conversationId,expectedPersonId:personId,requestId,slot:0,filename:'report.txt',mime:'text/plain',declaredBytes:bytes.length,body:body(bytes),...patch});
  return {service,request,writes,calls,get ledger(){return ledger;},get object(){return object;},deny(){binding={...binding,active:false};},rejoin(){member={active:true,joinedAt:1500};},expire(){ledger={...ledger,expiresAt:now};},failFinalize(v){finalizeFails=v;},onPut(fn){putHook=fn;},setPutStatus(v){putStatus=v;}};
}
test('authorized upload reserves the current membership epoch and returns only ready metadata',async()=>{
  const f=fixture();const result=await f.service.upload(f.request());assert.deepEqual(result,{status:'ok',attachmentId,filename:'report.txt',mime:'text/plain',bytes:4});
  assert.equal(f.ledger.joinedAt,1000);assert.equal(f.ledger.uploaderId,personId);assert.equal(f.ledger.state,'ready');assert.equal(f.ledger.actualBytes,4);assert.match(f.ledger.sha256,/^[0-9a-f]{64}$/);assert.deepEqual(f.object,data);assert.equal(f.writes.length,1);
});
test('identity and content are validated before creating any reservation or object',async()=>{
  for(const patch of [{token:'bad'},{expectedPersonId:other},{roomId:'wrong/path'},{filename:'x.exe'},{slot:5},{declaredBytes:3}]){const f=fixture();assert.notEqual((await f.service.upload(f.request(data,patch))).status,'ok');assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);}
  const f=fixture();f.deny();assert.deepEqual(await f.service.upload(f.request()),{status:'forbidden'});assert.equal(f.calls.length,0);
});
test('idempotent retry preserves one file and rejects same-slot different bytes',async()=>{
  const f=fixture();assert.equal((await f.service.upload(f.request())).status,'ok');assert.equal((await f.service.upload(f.request())).status,'ok');assert.equal(f.writes.length,1);assert.deepEqual(await f.service.upload(f.request(changedData)),{status:'conflict'});assert.deepEqual(f.object,data);
});
test('lost storage response or ledger failure can be repaired on retry without overwriting the object',async()=>{
  const f=fixture();f.setPutStatus('unavailable');f.failFinalize(true);assert.deepEqual(await f.service.upload(f.request()),{status:'unavailable'});assert.deepEqual(f.object,data);assert.equal(f.ledger.state,'reserved');
  f.failFinalize(false);assert.equal((await f.service.upload(f.request())).status,'ok');assert.equal(f.ledger.state,'ready');assert.deepEqual(f.object,data);
});
test('revocation or a new membership epoch during storage cannot finalize or expose metadata',async()=>{
  for(const change of [f=>f.deny(),f=>f.rejoin()]){const f=fixture();f.onPut(()=>change(f));assert.deepEqual(await f.service.upload(f.request()),{status:'forbidden'});assert.equal(f.ledger.state,'reserved');assert.equal(f.calls.filter(([kind])=>kind==='finalize').length,0);}
});
test('expired reservation cannot be finalized and old-epoch ready attachment cannot be reused',async()=>{
  const f=fixture();f.onPut(()=>f.expire());assert.deepEqual(await f.service.upload(f.request()),{status:'expired'});assert.equal(f.ledger.state,'reserved');
  const g=fixture();assert.equal((await g.service.upload(g.request())).status,'ok');g.rejoin();assert.deepEqual(await g.service.upload(g.request()),{status:'conflict'});assert.equal(g.writes.length,1);
});
