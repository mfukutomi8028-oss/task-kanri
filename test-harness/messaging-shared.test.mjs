import test from 'node:test';
import assert from 'node:assert/strict';
import * as shared from '../workspace-messaging-shared.js';
const p='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),group='group_g_'+'c'.repeat(32),messageId='msg_'+other+'_q_'+'d'.repeat(32);
const scope={roomId:'roomA',conversationId:group,messageId,personId:p};
const root='messagingV1/roomA/';
function fixture(){
  const data=new Map();
  const transport=shared.createMessagingSharedTransport({db:{},ref:(_,path)=>path,get:async path=>({val:()=>data.get(path)??null}),set:async(path,value)=>{if(value===null)data.delete(path);else data.set(path,value);}});
  return {transport,data};
}
test('a reaction is an explicit single selection, not a retry-sensitive toggle',async()=>{
  const f=fixture(),path=root+'reactions/'+group+'/'+messageId+'/'+p;
  assert.deepEqual(await f.transport.setReaction({...scope,reaction:'like'}),{status:'ok'});
  assert.deepEqual(await f.transport.setReaction({...scope,reaction:'like'}),{status:'ok'});
  assert.equal(f.data.get(path),'like');
  await f.transport.setReaction({...scope,reaction:'thanks'});assert.equal(f.data.get(path),'thanks');
  await f.transport.setReaction({...scope,reaction:null});assert.equal(f.data.has(path),false);
});
test('reaction reads are bounded to a message and known values only',async()=>{
  const f=fixture(),path=root+'reactions/'+group+'/'+messageId;
  assert.deepEqual(await f.transport.readReactions(scope),{status:'ok',reactions:{}});
  f.data.set(path,{[p]:'like',[other]:'thanks'});assert.deepEqual(await f.transport.readReactions(scope),{status:'ok',reactions:{[p]:'like',[other]:'thanks'}});
  f.data.set(path,{[p]:'unknown'});assert.deepEqual(await f.transport.readReactions(scope),{status:'unavailable'});
});
test('shared message pin is group-only and an idempotent explicit value',async()=>{
  const f=fixture(),path=root+'sharedPins/'+group+'/'+messageId;
  assert.deepEqual(await f.transport.readSharedPin(scope),{status:'ok',pinned:false});
  await f.transport.setSharedPin({...scope,pinned:true});await f.transport.setSharedPin({...scope,pinned:true});
  assert.equal(f.data.get(path),true);assert.deepEqual(await f.transport.readSharedPin(scope),{status:'ok',pinned:true});
  await f.transport.setSharedPin({...scope,pinned:false});assert.equal(f.data.has(path),false);
  assert.deepEqual(await f.transport.setSharedPin({...scope,conversationId:'self_'+p,pinned:true}),{status:'invalid'});
});
test('invalid shared state paths and values never write',async()=>{
  const f=fixture();for(const patch of [{roomId:'a/b'},{personId:'bad'},{messageId:'bad'},{conversationId:'bad'},{reaction:'custom'},{reaction:undefined}])assert.deepEqual(await f.transport.setReaction({...scope,reaction:'like',...patch}),{status:'invalid'});
  assert.deepEqual(await f.transport.setSharedPin({...scope,pinned:'yes'}),{status:'invalid'});assert.equal(f.data.size,0);
});
test('server authorization errors never produce local success',async()=>{
  const denied=async()=>{const e=Error('Permission denied');e.code='PERMISSION_DENIED';throw e;};
  const f=shared.createMessagingSharedTransport({db:{},ref:(_,p)=>p,get:denied,set:denied});
  assert.deepEqual(await f.setReaction({...scope,reaction:'like'}),{status:'forbidden'});assert.deepEqual(await f.readSharedPin(scope),{status:'forbidden'});
});
