import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingAttachmentAccessService} from '../security/messaging-attachment-access.mjs';
const roomId='roomA',personId='p_'+'b'.repeat(32),peer='p_'+'a'.repeat(32),conversationId='dm_'+peer+'_'+personId;
const value={status:'ok',globalBytes:650000000,personBytes:3000000,conversationBytes:9000000,dailyBytes:1000000,limitBytes:800000000,warnBytes:600000000,cleanupBytes:720000000,dailyLimitBytes:20000000};
function fixture(){
  const calls=[];let member={active:true,joinedAt:1000,},binding={uid:'uidB',personId,roomId,approved:true,active:true},status='active',reply=value;
  const noop=async()=>{throw Error('must not be used');};
  const service=createMessagingAttachmentAccessService({verifyToken:async t=>{if(t!=='token')throw Error('bad');return {uid:'uidB'};},readBinding:async()=>binding,readControl:async()=>({id:conversationId,roomId,status,members:{[personId]:member}}),readMessage:noop,readLedger:noop,reserveDownload:noop,readObject:noop,claimBatch:noop,readUsage:async s=>{calls.push(s);return reply;}});
  return {service,calls,request:{token:'token',roomId,conversationId,expectedPersonId:personId},member(p){member={...member,...p};},binding(p){binding={...binding,...p};},status(v){status=v;},reply(v){reply=v;}};
}
test('usage returns only the caller totals and the authorized conversation aggregate',async()=>{
  const f=fixture();assert.deepEqual(await f.service.usage(f.request),value);
  assert.deepEqual(f.calls,[{roomId,conversationId,personId,joinedAt:1000}]);
});
test('archived conversations still show usage; unapproved, revoked, left or forged requests read nothing',async()=>{
  const a=fixture();a.status('archived');assert.equal((await a.service.usage(a.request)).status,'ok');
  for(const change of [f=>f.binding({approved:false}),f=>f.binding({active:false}),f=>f.member({active:false}),f=>f.status('deleted'),f=>{f.request.expectedPersonId=peer;},f=>{f.request.token='forged';}]){
    const f=fixture();change(f);assert.deepEqual(await f.service.usage(f.request),{status:'forbidden'});assert.equal(f.calls.length,0);
  }
});
test('malformed requests and malformed ledger answers fail closed',async()=>{
  const f=fixture();
  for(const bad of [{...f.request,extra:1},{...f.request,conversationId:'group_x'},{...f.request,token:''}])assert.deepEqual(await f.service.usage(bad),{status:'invalid'});
  for(const reply of [null,{status:'ok'},{...value,globalBytes:-1},{...value,personBytes:1.5},{status:'unavailable'}]){f.reply(reply);assert.deepEqual(await f.service.usage(f.request),{status:'unavailable'});}
});
test('membership revoked while the ledger is read is denied before results are returned',async()=>{
  const f=fixture();let reads=0;f.reply(value);
  const original=f.service;const wrapped=createMessagingAttachmentAccessService({verifyToken:async()=>({uid:'uidB'}),readBinding:async()=>({uid:'uidB',personId,roomId,approved:true,active:true}),readControl:async()=>{reads++;return {id:conversationId,roomId,status:'active',members:{[personId]:{active:reads<2,joinedAt:1000}}};},readMessage:async()=>null,readLedger:async()=>null,reserveDownload:async()=>null,readObject:async()=>null,claimBatch:async()=>null,readUsage:async()=>value});
  assert.deepEqual(await wrapped.usage(f.request),{status:'forbidden'});assert.ok(original);
});
import {createMessagingApiHandler} from '../security/messaging-api-handler.mjs';
test('the HTTP boundary exposes attachmentUsage only when the service provides it',async()=>{
  const origin='https://board.example.test',fallback=async()=>({status:'ok'});
  const base={allowedOrigins:[origin],history:{readHistory:fallback},mutation:{mutate:fallback},directory:{readDirectory:fallback,readUnread:fallback},conversations:{readPeople:fallback,execute:fallback}};
  const call=handler=>handler(new Request('https://api.example.test/m',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer t'},body:JSON.stringify({action:'attachmentUsage',expectedPersonId:personId,payload:{roomId,conversationId}})}));
  const seen=[];const withUsage=createMessagingApiHandler({...base,attachments:{upload:fallback,download:fallback,usage:async input=>{seen.push(input);return value;}}});
  const ok=await call(withUsage);assert.equal(ok.status,200);assert.deepEqual(await ok.json(),value);assert.equal(seen[0].token,'t');assert.equal(seen[0].expectedPersonId,personId);
  const without=createMessagingApiHandler({...base,attachments:{upload:fallback,download:fallback}});assert.equal((await call(without)).status,400);
  const none=createMessagingApiHandler(base);assert.equal((await call(none)).status,400);
});
