import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingPersonalStateTransport} from './messaging-preview/workspace-messaging-personal.js';
const p='p_'+'a'.repeat(32),q='p_'+'b'.repeat(32),conversationId='dm_'+p+'_'+q;
const scope={roomId:'roomA',personId:p,conversationId,joinedAt:1000};
const path='messagingV1/roomA/personal/'+p+'/'+conversationId+'/1000';
const id=n=>'msg_'+q+'_q_'+n.toString(16).padStart(32,'0');
const cursor=(n,createdAt=2000)=>({id:id(n),createdAt});
// The only fake is the network boundary. Test the real transport's paths,
// validation, merge, and public results. Actual Rules run in the Emulator.
function fixture(){
  const data=new Map(),writes=[];
  const transport=createMessagingPersonalStateTransport({db:{},ref:(_,p)=>p,
    get:async p=>({val:()=>structuredClone(data.get(p)??null)}),
    update:async(p,patch)=>{writes.push([p,patch]);data.set(p,{...data.get(p),...patch});},
    set:async(p,v)=>{writes.push([p,v]);if(v==null)data.delete(p);else data.set(p,v);},
    runTransaction:async(p,fn)=>{const v=fn(structuredClone(data.get(p)??null));if(v!==undefined){writes.push([p,v]);data.set(p,v);}return {committed:v!==undefined,snapshot:{val:()=>structuredClone(data.get(p)??null)}};}
  });return {transport,data,writes};
}
test('preferences are field patches in the current person and membership epoch only',async()=>{
  const f=fixture();assert.deepEqual(await f.transport.setPersonalState({...scope,patch:{favorite:true,muted:true}}),{status:'ok'});
  await f.transport.setPersonalState({...scope,patch:{archived:true}});
  assert.deepEqual(f.data.get(path+'/preferences'),{favorite:true,muted:true,archived:true});
  assert.deepEqual(await f.transport.readPersonalState(scope),{status:'ok',preferences:{favorite:true,muted:true,archived:true,pinned:false},cursor:null});
  assert.deepEqual(await f.transport.readPersonalState({...scope,personId:q}),{status:'ok',preferences:{favorite:false,muted:false,archived:false,pinned:false},cursor:null});
  assert.deepEqual(await f.transport.readPersonalState({...scope,joinedAt:1500}),{status:'ok',preferences:{favorite:false,muted:false,archived:false,pinned:false},cursor:null});
});
test('invalid preferences and identity paths are rejected before network writes',async()=>{
  const f=fixture();for(const patch of [{other:true},{muted:'yes'},{},null,{favorite:true,personId:q}])assert.deepEqual(await f.transport.setPersonalState({...scope,patch}),{status:'invalid'});
  for(const change of [{roomId:'a/b'},{personId:'bad'},{conversationId:'bad'},{joinedAt:-1}])assert.deepEqual(await f.transport.setPersonalState({...scope,...change,patch:{favorite:true}}),{status:'invalid'});
  assert.equal(f.writes.length,0);
});
test('read cursor is monotonic including equal-timestamp messages and returns server state',async()=>{
  const f=fixture();assert.deepEqual(await f.transport.markRead({...scope,cursor:cursor(2)}),{status:'ok',cursor:cursor(2)});
  assert.deepEqual(await f.transport.markRead({...scope,cursor:cursor(1)}),{status:'ok',cursor:cursor(2)});
  assert.deepEqual(await f.transport.markRead({...scope,cursor:cursor(3)}),{status:'ok',cursor:cursor(3)});
  assert.deepEqual(await f.transport.markRead({...scope,cursor:cursor(99,1999)}),{status:'ok',cursor:cursor(3)});
  assert.deepEqual(f.writes.map(([,v])=>v),[cursor(2),cursor(2),cursor(3),cursor(3)]);assert.deepEqual((await f.transport.readPersonalState(scope)).cursor,cursor(3));
});
test('cursor and bookmark input cannot refer to invalid identifiers or pre-join timestamps',async()=>{
  const f=fixture();for(const c of [cursor(1,1000),{id:'x',createdAt:2000},{id:id(1),createdAt:NaN}])assert.deepEqual(await f.transport.markRead({...scope,cursor:c}),{status:'invalid'});
  assert.deepEqual(await f.transport.setBookmark({...scope,messageId:'a/b',bookmarked:true}),{status:'invalid'});
  assert.deepEqual(await f.transport.setBookmark({...scope,messageId:id(1),bookmarked:'true'}),{status:'invalid'});
  assert.equal(f.writes.length,0);
});
test('bookmark writes explicit desired state and never toggle on a retry',async()=>{
  const f=fixture(),target={...scope,messageId:id(1)};await f.transport.setBookmark({...target,bookmarked:true});await f.transport.setBookmark({...target,bookmarked:true});
  assert.deepEqual(await f.transport.readBookmark(target),{status:'ok',bookmarked:true});
  assert.deepEqual(await f.transport.readBookmark({...target,personId:q}),{status:'ok',bookmarked:false});
  await f.transport.setBookmark({...target,bookmarked:false});assert.deepEqual(await f.transport.readBookmark(target),{status:'ok',bookmarked:false});
});
test('permission denial is not reported as successful persistence',async()=>{
  const deny=async()=>{const e=Error('Permission denied');e.code='PERMISSION_DENIED';throw e;};
  const f=createMessagingPersonalStateTransport({db:{},ref:(_,p)=>p,get:deny,update:deny,set:deny,runTransaction:deny});
  assert.deepEqual(await f.readPersonalState(scope),{status:'forbidden'});
  assert.deepEqual(await f.setPersonalState({...scope,patch:{muted:true}}),{status:'forbidden'});
  assert.deepEqual(await f.markRead({...scope,cursor:cursor(2)}),{status:'forbidden'});
});

test('a cursor update must be committed, not acknowledged from a cached aborted transaction',async()=>{
  const f=createMessagingPersonalStateTransport({db:{},ref:(_,p)=>p,get:async()=>({val:()=>cursor(5)}),update:async()=>{},set:async()=>{},runTransaction:async()=>({committed:false,snapshot:{val:()=>cursor(5)}})});
  assert.deepEqual(await f.markRead({...scope,cursor:cursor(2)}),{status:'unavailable'});
});
