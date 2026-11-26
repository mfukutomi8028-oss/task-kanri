import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingStore} from './messaging-preview/workspace-messaging-store.js';
const a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),room='roomA';
const c='dm_'+a+'_'+b,d='self_'+a;
const request=i=>'q_'+i.toString(16).padStart(32,'0');
const id=(i,sender=a)=>'msg_'+sender+'_'+request(i);
const message=(i,patch={})=>({id:id(i),senderId:a,createdAt:1000+i,revision:1,body:'m'+i,refs:[],replyTo:null,attachmentIds:[],confirmationRequested:false,...patch});
const bound={status:'bound',roomId:room,personId:a},locked={status:'locked'};
const cursor=m=>({id:m.id,createdAt:m.createdAt});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture({records=Array.from({length:105},(_,i)=>message(i+1)),readHook,sendHook,editHook,removeHook,markReadHook}={}){
  let identity=bound,listener;const watches=[],calls=[],sent=new Map(),reads=[],updates=[];
  const byConversation=new Map([[c,records],[d,[]]]);
  const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
  const transport={
    async readHistory(q){
      calls.push(q);if(readHook)return readHook(q);
      const list=byConversation.get(q.conversationId)||[];
      const matches=list.filter(m=>!q.before||m.createdAt<q.before.createdAt||m.createdAt===q.before.createdAt&&m.id<q.before.id).slice(-q.limit);
      return {status:'ok',joinedAt:1000,messages:structuredClone(matches),hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null};
    },
    observeActivity(target,changed,failed){const watch={target,changed,failed,closed:false};watches.push(watch);return ()=>{watch.closed=true;};},
    async send(q){
      updates.push(q);if(sendHook)return sendHook(q);
      const key=q.conversationId+'/'+q.requestId;
      if(sent.has(key))return sent.get(key).result;
      const msg={...message(1000),...q.input,id:'msg_'+a+'_'+q.requestId};
      byConversation.get(q.conversationId).push(msg);const result={status:'sent',id:msg.id};sent.set(key,{result,msg});return result;
    },
    async edit(q){
      if(editHook)return editHook(q);
      const list=byConversation.get(q.conversationId),i=list.findIndex(m=>m.id===q.messageId),old=list[i];
      if(old.revision!==q.expectedRevision)return {status:'conflict'};
      list[i]={...old,...q.input,revision:old.revision+1,editedAt:2000};return {status:'ok',message:structuredClone(list[i])};
    },
    async remove(q){
      if(removeHook)return removeHook(q);
      const list=byConversation.get(q.conversationId),i=list.findIndex(m=>m.id===q.messageId),old=list[i];
      if(old.revision!==q.expectedRevision)return {status:'conflict'};
      list[i]={id:old.id,senderId:old.senderId,createdAt:old.createdAt,revision:old.revision+1,deletedAt:2000};return {status:'ok',message:structuredClone(list[i])};
    },
    async markRead(q){reads.push(q);return markReadHook?markReadHook(q):{status:'ok'};}
  };
  const store=createMessagingStore({session,transport});
  return {store,calls,watches,byConversation,sent,reads,updates,identity(next){identity=next;listener?.(next);}};
}

test('active conversation loads at most 50 and older pages preserve ordered history',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);
  assert.equal(f.store.getSnapshot().messages.length,50);
  assert.equal(f.store.getSnapshot().messages[0].id,id(56));
  await f.store.loadOlder();assert.equal(f.store.getSnapshot().messages.length,100);
  await f.store.loadOlder();assert.deepEqual(f.store.getSnapshot().messages.map(m=>m.id),Array.from({length:105},(_,i)=>id(i+1)));
  assert.equal(f.store.getSnapshot().hasMore,false);
  assert.deepEqual(f.calls.map(q=>q.limit),[50,50,50]);
  assert.equal(f.watches.filter(w=>!w.closed).length,1);
  f.store.dispose();assert.ok(f.watches.every(w=>w.closed));
});
test('switching conversation ignores prior response and unsubscribes old activity',async()=>{
  const old=deferred();const f=fixture({readHook:q=>q.conversationId===c?old.promise:{status:'ok',joinedAt:1000,messages:[],hasMore:false,nextCursor:null}});
  const first=f.store.setActiveConversation(c);await flush();assert.equal(f.calls.length,1);await f.store.setActiveConversation(d);
  old.resolve({status:'ok',joinedAt:1000,messages:[message(1)],hasMore:false,nextCursor:null});await first;
  f.watches[0].changed();await flush();
  assert.equal(f.store.getSnapshot().conversationId,d);assert.deepEqual(f.store.getSnapshot().messages,[]);
  assert.equal(f.watches[0].closed,true);assert.equal(f.calls.length,2);f.store.dispose();
});
test('activity refresh merges overlapping history without duplicates',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);await f.store.loadOlder();
  f.byConversation.get(c).push(message(106));f.watches[0].changed();await flush();
  assert.equal(f.store.getSnapshot().messages.length,101);assert.equal(f.store.getSnapshot().messages.at(-1).id,id(106));
  assert.equal(new Set(f.store.getSnapshot().messages.map(m=>m.id)).size,101);f.store.dispose();
});
test('non-overlapping new history resets to a bounded page and does not pretend there is no gap',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);
  f.byConversation.get(c).push(...Array.from({length:51},(_,i)=>message(106+i)));
  await f.store.refreshLatest();const s=f.store.getSnapshot();
  assert.equal(s.messages.length,50);assert.equal(s.messages[0].id,id(107));assert.equal(s.hasMore,true);assert.equal(s.historyReset,true);
  await f.store.loadOlder();assert.equal(f.store.getSnapshot().messages[0].id,id(57));f.store.dispose();
});
test('drafts belong to a conversation and disappear when the identity is lost',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);f.store.setDraft('draft one');
  await f.store.setActiveConversation(d);assert.equal(f.store.getSnapshot().draft,'');f.store.setDraft('self draft');
  await f.store.setActiveConversation(c);assert.equal(f.store.getSnapshot().draft,'draft one');
  f.identity(locked);assert.equal(f.store.getSnapshot().status,'locked');assert.equal(f.store.getSnapshot().draft,'');
  assert.deepEqual(f.store.getSnapshot().messages,[]);assert.ok(f.watches.every(w=>w.closed));
  f.identity(bound);await f.store.setActiveConversation(c);assert.equal(f.store.getSnapshot().draft,'');f.store.dispose();
});
test('a failed send keeps its draft and duplicate in-flight request is coalesced',async()=>{
  let pending=deferred();const f=fixture({sendHook:()=>pending.promise});await f.store.setActiveConversation(c);f.store.setDraft('report');
  const command={conversationId:c,requestId:request(2000),input:{body:'report'}};
  const first=f.store.send(command),second=f.store.send(command);
  assert.deepEqual(await f.store.send({...command,input:{body:'changed'}}),{status:'conflict'});
  pending.resolve({status:'failed'});assert.deepEqual(await first,{status:'failed'});assert.deepEqual(await second,{status:'failed'});
  assert.equal(f.updates.length,1);assert.equal(f.store.getSnapshot().draft,'report');
  pending=deferred();const retry=f.store.send(command);pending.resolve({status:'sent',id:id(2000)});
  assert.deepEqual(await retry,{status:'sent',id:id(2000)});assert.equal(f.updates.length,2);assert.equal(f.store.getSnapshot().draft,'');
  f.store.dispose();
});
test('a successful send does not overwrite a new draft or act in a changed identity',async()=>{
  const pending=deferred(),f=fixture({sendHook:()=>pending.promise});await f.store.setActiveConversation(c);f.store.setDraft('old');
  const sent=f.store.send({conversationId:c,requestId:request(2001),input:{body:'old'}});
  f.store.setDraft('new');pending.resolve({status:'sent',id:id(2001)});await sent;
  assert.equal(f.store.getSnapshot().draft,'new');
  f.identity(locked);assert.deepEqual(await f.store.send({conversationId:c,requestId:request(2002),input:{body:'test'}}),{status:'locked'});f.store.dispose();
});
test('cross-room references and invalid input never reach send transport',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);
  for(const input of [{body:' '},{body:'x',refs:[{roomId:'other',type:'memo',recordId:'m'}]},{body:'x',attachmentIds:['pending']}]){
    assert.deepEqual(await f.store.send({conversationId:c,requestId:request(2000),input}),{status:'invalid'});
  }
  assert.equal(f.updates.length,0);f.store.dispose();
});
test('edit and remove update one owned record and reject stale revisions',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);
  const key=id(100);assert.deepEqual(await f.store.edit({conversationId:c,messageId:key,expectedRevision:1,input:{body:'edited'}}),{status:'ok'});
  let m=f.store.getSnapshot().messages.find(m=>m.id===key);assert.equal(m.body,'edited');assert.equal(m.revision,2);
  assert.deepEqual(await f.store.edit({conversationId:c,messageId:key,expectedRevision:1,input:{body:'stale'}}),{status:'conflict'});
  assert.deepEqual(await f.store.remove({conversationId:c,messageId:key,expectedRevision:2}),{status:'ok'});
  m=f.store.getSnapshot().messages.find(m=>m.id===key);assert.equal(m.deletedAt,2000);assert.equal(m.body,undefined);assert.equal(m.revision,3);f.store.dispose();
});
test('read state advances only for visible loaded messages and cannot regress',async()=>{
  const f=fixture();await f.store.setActiveConversation(c);
  const visible=cursor(message(105));assert.deepEqual(await f.store.markRead({conversationId:c,cursor:visible,visible:false}),{status:'ignored'});
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(message(1)),visible:true}),{status:'invalid'});
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:visible,visible:true}),{status:'ok'});
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(message(100)),visible:true}),{status:'ignored'});
  assert.equal(f.reads.length,1);assert.deepEqual(f.store.getSnapshot().readCursor,visible);f.store.dispose();
});
test('forbidden refresh clears prior private messages and closes the subscription',async()=>{
  let forbidden=false;const f=fixture({readHook:()=>forbidden?{status:'forbidden'}:{status:'ok',joinedAt:1000,messages:[message(2)],hasMore:false,nextCursor:null}});
  await f.store.setActiveConversation(c);f.store.setDraft('private draft');forbidden=true;await f.store.refreshLatest();
  assert.deepEqual(f.store.getSnapshot().messages,[]);assert.equal(f.store.getSnapshot().draft,'');assert.equal(f.store.getSnapshot().status,'forbidden');assert.equal(f.watches[0].closed,true);f.store.dispose();
});

test('a new membership boundary resets old history and its draft even if latest records overlap',async()=>{
  let joinedAt=1000;const f=fixture({readHook:()=>({status:'ok',joinedAt,messages:joinedAt===1000?[message(1),message(2),message(3)]:[message(3)],hasMore:false,nextCursor:null})});
  await f.store.setActiveConversation(c);f.store.setDraft('old membership draft');
  joinedAt=1002;await f.store.refreshLatest();
  assert.deepEqual(f.store.getSnapshot().messages.map(m=>m.id),[id(3)]);
  assert.equal(f.store.getSnapshot().draft,'');f.store.dispose();
});

test('returning to a rejoined conversation never restores a previous membership draft',async()=>{
  let joinedAt=1000;const f=fixture({readHook:q=>({status:'ok',joinedAt:q.conversationId===c?joinedAt:1000,messages:q.conversationId===c?[message(3)]:[],hasMore:false,nextCursor:null})});
  await f.store.setActiveConversation(c);f.store.setDraft('previous membership');await f.store.setActiveConversation(d);
  joinedAt=1002;const opening=f.store.setActiveConversation(c);assert.equal(f.store.getSnapshot().draft,'');await opening;
  assert.equal(f.store.getSnapshot().draft,'');f.store.dispose();
});
test('an older membership read receipt cannot repopulate the new membership state',async()=>{
  let joinedAt=1000;const pending=deferred(),f=fixture({markReadHook:()=>pending.promise,readHook:()=>({status:'ok',joinedAt,messages:joinedAt===1000?[message(1),message(2),message(3)]:[message(3)],hasMore:false,nextCursor:null})});
  await f.store.setActiveConversation(c);const marking=f.store.markRead({conversationId:c,cursor:cursor(message(2)),visible:true});
  joinedAt=1002;await f.store.refreshLatest();pending.resolve({status:'ok'});
  assert.deepEqual(await marking,{status:'locked'});assert.equal(f.store.getSnapshot().readCursor,null);f.store.dispose();
});
test('10,000 stored messages still require only the bounded initial page and one activity subscription',async()=>{
  const f=fixture({records:Array.from({length:10000},(_,i)=>message(i+1))});
  await f.store.setActiveConversation(c);assert.equal(f.store.getSnapshot().messages.length,50);
  assert.equal(f.store.getSnapshot().messages[0].id,id(9951));assert.equal(f.calls.length,1);assert.equal(f.calls[0].limit,50);
  assert.equal(f.watches.filter(w=>!w.closed).length,1);await f.store.loadOlder();assert.equal(f.store.getSnapshot().messages.length,100);
  assert.equal(f.store.getSnapshot().messages[0].id,id(9901));assert.equal(f.calls.length,2);f.store.dispose();
});
