import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingMessageCommands} from '../security/messaging-message-commands.mjs';
const a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),roomId='roomA',conversationId='dm_'+a+'_'+b,requestId='q_'+'c'.repeat(32),messageId='msg_'+a+'_'+requestId;
const commands=createMessagingMessageCommands({digestKey:new Uint8Array(32).fill(7)});
const context=(patch={})=>({roomId,conversationId,personId:a,joinedAt:1000,active:true,conversationStatus:'active',now:2000,...patch});
const send={type:'send',requestId,input:{body:'Original report'}};
const create=()=>commands.apply(null,send,context());

test('new send creates a deterministic record without exposing the internal retry fingerprint',()=>{
  const result=create();assert.equal(result.status,'sent');assert.equal(result.changed,true);assert.equal(result.id,messageId);
  assert.equal(result.record.senderId,a);assert.equal(result.record.createdAt,2000);assert.equal(result.record.revision,1);assert.equal(result.record.body,'Original report');
  assert.match(result.record.sendDigest,/^[0-9a-f]{64}$/);assert.equal(result.message.sendDigest,undefined);
});
test('identical retry is idempotent and changed content is rejected',()=>{
  const {record}=create();const replay=commands.apply(record,send,context({now:2100}));
  assert.equal(replay.status,'sent');assert.equal(replay.changed,false);assert.equal(replay.id,messageId);assert.deepEqual(replay.record,record);
  assert.deepEqual(commands.apply(record,{...send,input:{body:'Changed'}},context({now:2100})),{status:'conflict'});
});
test('editing preserves sender, creation time, request identity and increments revision',()=>{
  const {record}=create();const edit={type:'edit',messageId,expectedRevision:1,input:{body:'Updated report'}};
  const result=commands.apply(record,edit,context({now:3000}));
  assert.equal(result.status,'ok');assert.equal(result.record.id,messageId);assert.equal(result.record.senderId,a);
  assert.equal(result.record.createdAt,2000);assert.equal(result.record.revision,2);assert.equal(result.record.editedAt,3000);assert.equal(result.record.body,'Updated report');
  assert.equal(result.record.sendDigest,record.sendDigest);assert.equal(record.body,'Original report');
  assert.deepEqual(commands.apply(result.record,edit,context({now:4000})),{status:'conflict'});
  const originalRetry=commands.apply(result.record,send,context({now:4000}));assert.equal(originalRetry.changed,false);assert.equal(originalRetry.record.body,'Updated report');
});
test('deletion keeps a tombstone and retry identity but removes original body and references',()=>{
  const initial=commands.apply(null,{...send,input:{body:'Original report',refs:[{roomId,type:'task',recordId:'t1'}]}},context());
  const removed=commands.apply(initial.record,{type:'remove',messageId,expectedRevision:1},context({now:3000}));
  assert.equal(removed.status,'ok');assert.equal(removed.record.body,undefined);assert.equal(removed.record.refs,undefined);assert.equal(removed.record.deletedAt,3000);assert.equal(removed.record.revision,2);
  assert.deepEqual(removed.message,{id:messageId,senderId:a,createdAt:2000,revision:2,deletedAt:3000});
  const retry=commands.apply(removed.record,{...send,input:{body:'Original report',refs:[{roomId,type:'task',recordId:'t1'}]}},context({now:4000}));assert.equal(retry.changed,false);assert.equal(retry.record.body,undefined);
  assert.deepEqual(commands.apply(removed.record,{type:'edit',messageId,expectedRevision:2,input:{body:'Restore'}},context({now:4000})),{status:'forbidden'});
});
test('another active member cannot edit or remove a message they did not send',()=>{
  const {record}=create();for(const command of [{type:'edit',messageId,expectedRevision:1,input:{body:'Other'}},{type:'remove',messageId,expectedRevision:1}]){
    assert.deepEqual(commands.apply(record,command,context({personId:b,now:3000})),{status:'forbidden'});
  }
});
test('inactive members, archived groups and old membership records cannot be mutated',()=>{
  const {record}=create();const edit={type:'edit',messageId,expectedRevision:1,input:{body:'Changed'}};
  for(const patch of [{active:false},{conversationStatus:'archived'},{joinedAt:2000,now:3000}])assert.deepEqual(commands.apply(record,edit,context(patch)),{status:'forbidden'});
  assert.deepEqual(commands.apply(null,send,context({active:false})),{status:'forbidden'});
  assert.deepEqual(commands.apply(null,send,context({conversationStatus:'archived'})),{status:'forbidden'});
});
test('forged command fields, cross-room references and uncommitted files are rejected',()=>{
  for(const command of [{...send,senderId:b},{...send,input:{body:'x',refs:[{roomId:'other',type:'task',recordId:'t1'}]}},{...send,input:{body:'x',attachmentIds:['pending']}},{...send,input:{body:'  '}},{...send,requestId:'not-an-id'}])assert.deepEqual(commands.apply(null,command,context()),{status:'invalid'});
});
test('server clock and malformed stored identity are checked before mutation',()=>{
  const {record}=create();const edit={type:'edit',messageId,expectedRevision:1,input:{body:'Changed'}};
  assert.deepEqual(commands.apply(null,send,context({now:1000})),{status:'conflict'});
  assert.deepEqual(commands.apply(record,edit,context({now:1999})),{status:'conflict'});
  assert.deepEqual(commands.apply({...record,senderId:b},edit,context({now:3000})),{status:'unavailable'});
});

const c='p_'+'d'.repeat(32), late='p_'+'e'.repeat(32), group='group_g_'+'f'.repeat(32);
const members={[a]:{active:true,joinedAt:1000},[b]:{active:true,joinedAt:1200},[c]:{active:false,joinedAt:1100},[late]:{active:true,joinedAt:2000}};
const confirmSend={...send,input:{body:'Please check',confirmationRequested:true}};
const confirmationContext=patch=>context({conversationId:group,members,...patch});
test('confirmation request freezes eligible recipients and their membership epochs at send',()=>{
  const r=commands.apply(null,confirmSend,confirmationContext());
  assert.equal(r.status,'sent');assert.deepEqual(r.record.confirmation,{round:1,targets:{[b]:1200}});
  assert.deepEqual(r.message.confirmation,r.record.confirmation);
});
test('editing a confirmation opens a new round without adding later participants',()=>{
  const r=commands.apply(null,confirmSend,confirmationContext());
  const edit={type:'edit',messageId,expectedRevision:1,input:{body:'Please check again',confirmationRequested:true}};
  const updated=commands.apply(r.record,edit,confirmationContext({now:3000,members:{...members,[b]:{active:false,joinedAt:1200},[late]:{active:true,joinedAt:2500}}}));
  assert.deepEqual(updated.record.confirmation,{round:2,targets:{[b]:1200}});
  const removed=commands.apply(updated.record,{type:'remove',messageId,expectedRevision:2},confirmationContext({now:4000}));
  assert.equal(removed.record.confirmation,undefined);assert.equal(removed.message.confirmation,undefined);
});
test('a request first enabled by editing cannot target people who joined after the original message',()=>{
  const initial=commands.apply(null,send,confirmationContext());
  const edit={type:'edit',messageId,expectedRevision:1,input:confirmSend.input};
  const result=commands.apply(initial.record,edit,confirmationContext({now:4000}));
  assert.deepEqual(result.record.confirmation,{round:2,targets:{[b]:1200}});
});
test('self-only or missing membership information cannot create a confirmation request',()=>{
  assert.deepEqual(commands.apply(null,confirmSend,context({conversationId:'self_'+a,members:{[a]:members[a]}})),{status:'invalid'});
  assert.deepEqual(commands.apply(null,confirmSend,confirmationContext({members:undefined})),{status:'invalid'});
});
