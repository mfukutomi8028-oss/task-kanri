import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from './messaging-preview/workspace-messaging-core.js';
const a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),c='p_'+'c'.repeat(32),roomId='roomA';
const group='group_g_'+'d'.repeat(32),id='msg_'+a+'_q_'+'e'.repeat(32);
const message={id,senderId:a,createdAt:2000,revision:2,editedAt:3000,body:'Check again',confirmationRequested:true,confirmation:{round:2,targets:{[b]:1000,[c]:1200}}};
const context={roomId,joinedAt:500};
test('confirmation projection accepts only current round and original membership epochs',()=>{
  assert.deepEqual(core.projectMessagingMessage(message,context).confirmation,{round:2,targets:{[b]:1000,[c]:1200}});
  for(const confirmation of [{round:1,targets:{[b]:1000}},{round:2,targets:{[a]:500}},{round:2,targets:{[b]:2000}},{round:2,targets:{[b]:-1}},{round:2,targets:{[b]:1000},body:'unsafe'}]){
    assert.throws(()=>core.projectMessagingMessage({...message,confirmation},context),TypeError);
  }
  assert.equal(core.projectMessagingMessage({...message,deletedAt:4000},context).confirmation,undefined);
});
test('confirmation status distinguishes recipients who left or rejoined from pending and confirmed',()=>{
  assert.equal(typeof core.summarizeMessageConfirmation,'function');
  const members={[b]:{active:true,joinedAt:1000},[c]:{active:true,joinedAt:3500}};
  const rows=core.summarizeMessageConfirmation(message,members,{[b]:3200,[c]:3400});
  assert.deepEqual(rows,[{personId:b,status:'confirmed',confirmedAt:3200},{personId:c,status:'left',confirmedAt:3400}]);
  assert.deepEqual(core.summarizeMessageConfirmation(message,{...members,[c]:{active:true,joinedAt:1200}},{[b]:2900}),[{personId:b,status:'pending',confirmedAt:null},{personId:c,status:'pending',confirmedAt:null}]);
});

import * as transportModule from './messaging-preview/workspace-messaging-confirmations.js';
const scope={roomId,conversationId:group,messageId:id,round:2,personId:b};
const receiptPath='messagingV1/'+roomId+'/confirmationReceipts/'+group+'/'+id+'/2/'+b;
function fixture(){
  const data=new Map();let now=3500,committed=true;
  const t=transportModule.createMessagingConfirmationTransport({db:{},ref:(_,path)=>path,get:async path=>({val:()=>data.get(path)??null}),serverTimestamp:()=>now,
    runTransaction:async(path,fn)=>{const v=fn(data.get(path)??null);if(committed)data.set(path,v);return {committed,snapshot:{val:()=>data.get(path)??null}};}
  });return {t,data,setNow(v){now=v;},abort(){committed=false;}};
}
test('explicit confirmation is idempotent and the first committed timestamp is preserved',async()=>{
  const f=fixture();assert.deepEqual(await f.t.readOwnConfirmation(scope),{status:'ok',confirmedAt:null});
  assert.deepEqual(await f.t.confirm(scope),{status:'ok',confirmedAt:3500});f.setNow(3800);
  assert.deepEqual(await f.t.confirm(scope),{status:'ok',confirmedAt:3500});
  assert.equal(f.data.get(receiptPath),3500);assert.deepEqual(await f.t.readOwnConfirmation({...scope,round:3}),{status:'ok',confirmedAt:null});
});
test('an aborted transaction must not be acknowledged using a cached receipt',async()=>{
  const f=fixture();f.data.set(receiptPath,3500);f.abort();assert.deepEqual(await f.t.confirm(scope),{status:'unavailable'});
});
test('invalid receipt paths and request rounds never write',async()=>{
  const f=fixture();for(const patch of [{roomId:'room/a'},{conversationId:'bad'},{messageId:'bad'},{personId:'bad'},{round:0},{round:1.5}])assert.deepEqual(await f.t.confirm({...scope,...patch}),{status:'invalid'});
  assert.equal(f.data.size,0);
});
test('sender reads only the current round and validates receipt timestamps',async()=>{
  const f=fixture();const parent=receiptPath.slice(0,receiptPath.lastIndexOf('/'));
  f.data.set(parent,{[b]:3500,[c]:3600});assert.deepEqual(await f.t.readReceipts(scope),{status:'ok',receipts:{[b]:3500,[c]:3600}});
  f.data.set(parent,{[b]:'3500'});assert.deepEqual(await f.t.readReceipts(scope),{status:'unavailable'});
});
