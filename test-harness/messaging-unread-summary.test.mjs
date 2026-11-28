import test from 'node:test';
import assert from 'node:assert/strict';
import {readUnreadForMember} from '../security/messaging-unread-summary.mjs';
const personId='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),roomId='roomA',conversationId='group_g_'+'c'.repeat(32);
const scope={roomId,conversationId,personId,joinedAt:1000};
const msg=(n,senderId=other,createdAt=2000+n,patch={})=>({id:'msg_'+senderId+'_q_'+n.toString(16).padStart(32,'0'),senderId,createdAt,...patch});
const cursorOf=({id,createdAt})=>({id,createdAt});
function fixture(rows=[],states=[{cursor:null,muted:null}]){
  const queries=[];let reads=0;
  return {queries,run:()=>readUnreadForMember({scope,readPersonal:async s=>{assert.deepEqual(s,scope);return states[Math.min(reads++,states.length-1)];},readUnreadPage:async q=>{queries.push(q);return rows;}})};
}
test('counts only nondeleted incoming messages, returns no content and keeps mute state',async()=>{
  const latest=msg(3,other,2003,{body:'private',sendDigest:'secret'}),f=fixture([msg(1),msg(2,personId),latest,msg(4,other,2004,{deletedAt:2100})],[{cursor:null,muted:true}]);
  assert.deepEqual(await f.run(),{status:'ok',...scope,unread:2,latestIncoming:cursorOf(latest),muted:true,complete:true});
  assert.deepEqual(f.queries,[{...scope,after:null,limit:101}]);
});
test('uses the exact read cursor including its message ID at the same timestamp',async()=>{
  const cursor=cursorOf(msg(1,other,2100)),later=msg(2,other,2100),f=fixture([later],[{cursor,muted:false}]);
  assert.deepEqual(await f.run(),{status:'ok',...scope,unread:1,latestIncoming:cursorOf(later),muted:false,complete:true});
  assert.deepEqual(f.queries,[{...scope,after:cursor,limit:101}]);
});
test('empty bounded query represents a genuine zero',async()=>{
  assert.deepEqual(await fixture().run(),{status:'ok',...scope,unread:0,latestIncoming:null,muted:false,complete:true});
});
test('caps large incoming counts at 100 and proves the display threshold',async()=>{
  const rows=Array.from({length:101},(_,i)=>msg(i+1));const result=await fixture(rows).run();
  assert.equal(result.unread,100);assert.equal(result.complete,true);assert.deepEqual(result.latestIncoming,cursorOf(rows.at(-1)));
});
test('own sends or deletions can hide older unread messages; a full scan budget is not an exact zero',async()=>{
  const rows=Array.from({length:101},(_,i)=>msg(i+1,personId));const result=await fixture(rows).run();
  assert.equal(result.unread,0);assert.equal(result.complete,false);assert.equal(result.latestIncoming,null);
});
test('rejects rows outside membership or cursor boundary, unordered rows and malformed sender identity',async()=>{
  for(const rows of [[msg(1,other,1000)],[msg(2),msg(1)],[msg(1),msg(1)],[msg(1,other,2001,{senderId:personId})],[msg(1,other,2001,{deletedAt:2000})],Array.from({length:102},(_,i)=>msg(i+1))])assert.deepEqual(await fixture(rows).run(),{status:'unavailable'});
  const cursor=cursorOf(msg(1));assert.deepEqual(await fixture([msg(1)],[{cursor,muted:false}]).run(),{status:'unavailable'});
});
test('rejects malformed personal state and does not query history',async()=>{
  for(const state of [{cursor:cursorOf(msg(1,other,1000)),muted:false},{cursor:null,muted:'true'},null]){
    const f=fixture([],[state]);assert.deepEqual(await f.run(),{status:'unavailable'});assert.deepEqual(f.queries,[]);
  }
});
test('a cursor advance or mute change during the read invalidates the result',async()=>{
  const first={cursor:null,muted:false};for(const next of [{cursor:cursorOf(msg(1)),muted:false},{cursor:null,muted:true}])assert.deepEqual(await fixture([msg(1)],[first,next]).run(),{status:'stale'});
});
