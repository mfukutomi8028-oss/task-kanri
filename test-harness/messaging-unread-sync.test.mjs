import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingUnreadSync} from '../workspace-messaging-unread-sync.js';
const roomId='roomA',personId='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32);
const ids=Array.from({length:5},(_,i)=>'group_g_'+String(i+1).padStart(32,'0'));
const actor={status:'bound',roomId,personId};
const directory=(indexes=[0,1,2],joinedAt=1000)=>({roomId,personId,conversations:indexes.map(i=>({id:ids[i],joinedAt}))});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const result=(conversationId,unread=2,joinedAt=1000)=>({status:'ok',roomId,personId,conversationId,joinedAt,unread,muted:false,complete:true,latestIncoming:unread?{id:'msg_'+other+'_q_'+'d'.repeat(32),createdAt:joinedAt+1}:null});
function fixture(opts={}){
 let identity=actor,listener;const observers=new Map(),calls=[],pending=[],changes=[];let running=0,peak=0;
 const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
 const service=createMessagingUnreadSync({session,maxWatched:opts.maxWatched??100,parallel:opts.parallel??4,
 observeActivity(scope,changed,error){const row={scope,changed,error};observers.set(scope.conversationId,row);return ()=>{if(observers.get(scope.conversationId)===row)observers.delete(scope.conversationId);};},
 async readUnread(scope){calls.push(scope);running++;peak=Math.max(peak,running);try{if(opts.defer)return await new Promise(resolve=>pending.push({scope,resolve}));return result(scope.conversationId);}finally{running--;}}});
 service.subscribe(()=>changes.push('changed'));
 return {service,observers,calls,pending,changes,peak:()=>peak,signal:id=>observers.get(id).changed(),error:id=>observers.get(id).error(),setIdentity(value){identity=value;listener?.(value);}};
}
test('initial watches are bounded, unknown is not zero, and only changed conversations are read',async()=>{
 const f=fixture({maxWatched:2});f.service.setDirectory(directory(),ids[2]);assert.deepEqual([...f.observers.keys()],[ids[2],ids[0]]);assert.equal(f.service.read(ids[1],1000),null);assert.equal(f.service.read(ids[0],1000),null);
 f.signal(ids[0]);f.signal(ids[2]);await turn();assert.equal(f.calls.length,2);assert.equal(f.service.read(ids[0],1000).unread,2);assert.equal(f.service.read(ids[2],1000).unread,2);
 f.signal(ids[0]);f.signal(ids[0]);await turn();assert.deepEqual(f.calls.map(v=>v.conversationId),[ids[0],ids[2],ids[0]]);f.service.setDirectory(directory(),ids[2]);await turn();assert.equal(f.calls.length,3);f.service.dispose();assert.equal(f.observers.size,0);
});
test('bounded concurrency and a signal during an in-flight request discard the old result',async()=>{
 const f=fixture({defer:true,parallel:2});f.service.setDirectory(directory());for(const id of ids.slice(0,3))f.signal(id);await turn();assert.equal(f.calls.length,2);assert.equal(f.peak(),2);f.signal(ids[0]);f.pending[0].resolve(result(ids[0],9));await turn();assert.equal(f.service.read(ids[0],1000),null);assert.equal(f.calls.length,3);
 f.pending[1].resolve(result(ids[1],0));await turn();assert.equal(f.service.read(ids[1],1000).unread,0);assert.equal(f.calls.length,4);f.pending[2].resolve(result(ids[2],3));f.pending[3].resolve(result(ids[0],1));await turn();assert.equal(f.service.read(ids[0],1000).unread,1);assert.equal(f.peak(),2);f.service.dispose();
});
test('removal, changed membership epoch and identity loss erase cached and pending results',async()=>{
 const f=fixture({defer:true});f.service.setDirectory(directory([0,1]));const late=f.observers.get(ids[0]);f.signal(ids[0]);f.signal(ids[1]);await turn();f.pending[1].resolve(result(ids[1]));await turn();assert.equal(f.service.read(ids[1],1000).unread,2);f.service.setDirectory(directory([0],2000));assert.equal(f.service.read(ids[1],1000),null);f.pending[0].resolve(result(ids[0]));late.changed();await turn();assert.equal(f.service.read(ids[0],2000),null);assert.equal(f.calls.length,2);
 f.signal(ids[0]);await turn();f.setIdentity({status:'locked'});f.pending[2].resolve(result(ids[0],7,2000));await turn();assert.equal(f.service.read(ids[0],2000),null);assert.equal(f.observers.size,0);f.service.dispose();
});
test('permission failure clears known unread, failed watch can be reattached explicitly',async()=>{
 const f=fixture();f.service.setDirectory(directory([0]));f.signal(ids[0]);await turn();assert.equal(f.service.read(ids[0],1000).unread,2);f.error(ids[0]);await turn();assert.equal(f.service.read(ids[0],1000),null);assert.equal(f.observers.size,0);f.service.setDirectory(directory([0]));assert.equal(f.observers.size,0);f.service.setDirectory(directory([0]),null,{retryFailed:true});assert.equal(f.observers.size,1);f.service.dispose();
});
test('forged identity, wrong epoch and incomplete unread are never projected as known',async()=>{
 for(const reply of [{...result(ids[0]),personId:other},{...result(ids[0]),joinedAt:999},{...result(ids[0]),complete:false},{...result(ids[0]),conversationId:ids[1]},{status:'forbidden'}]){const f=fixture({defer:true});f.service.setDirectory(directory([0]));f.signal(ids[0]);await turn();f.pending[0].resolve(reply);await turn();assert.deepEqual(f.service.read(ids[0],1000),reply.status==='forbidden'?{status:'forbidden'}:null);f.service.dispose();}
});

test('explicit refresh rechecks existing summaries even without a new activity signal',async()=>{
 const f=fixture();f.service.setDirectory(directory([0]));f.signal(ids[0]);await turn();assert.equal(f.service.read(ids[0],1000).unread,2);f.service.setDirectory(directory([0]),null,{retryFailed:true,refresh:true});await turn();assert.equal(f.calls.length,2);assert.equal(f.service.read(ids[0],1000).unread,2);f.service.dispose();
});
