import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingStore} from '../workspace-messaging-store.js';
const a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),room='roomA';
const c='dm_'+a+'_'+b,d='self_'+a;
const request=i=>'q_'+i.toString(16).padStart(32,'0');
const id=(i,sender=a)=>'msg_'+sender+'_'+request(i);
const message=(i,patch={})=>({id:id(i),senderId:a,createdAt:1000+i,revision:1,body:'m'+i,refs:[],replyTo:null,attachmentIds:[],confirmationRequested:false,...patch});
const bound={status:'bound',roomId:room,personId:a},locked={status:'locked'};
const cursor=m=>({id:m.id,createdAt:m.createdAt});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture({records=Array.from({length:105},(_,i)=>message(i+1)),readHook,sendHook,editHook,removeHook,markReadHook,readPersonalStateHook}={}){
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
  if(readPersonalStateHook)transport.readPersonalState=readPersonalStateHook;
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
test('read cursor sends the bound person and current membership epoch and adopts the committed remote cursor',async()=>{
  const remote=cursor(message(105));const f=fixture({markReadHook:()=>({status:'ok',cursor:remote})});
  await f.store.setActiveConversation(c);
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(message(100)),visible:true}),{status:'ok'});
  assert.deepEqual(f.reads,[{roomId:room,conversationId:c,personId:a,joinedAt:1000,cursor:cursor(message(100))}]);
  assert.deepEqual(f.store.getSnapshot().readCursor,remote);f.store.dispose();
});
test('a remote cursor response cannot regress the requested position or belong to a prior membership',async()=>{
  for(const response of [cursor(message(99)),{id:id(99),createdAt:999}]){
    const f=fixture({markReadHook:()=>({status:'ok',cursor:response})});await f.store.setActiveConversation(c);
    assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(message(100)),visible:true}),{status:'failed'});
    assert.equal(f.store.getSnapshot().readCursor,null);f.store.dispose();
  }
});

const remotePrefs={favorite:false,muted:true,archived:false,pinned:false};
const personalPage=(cursor,preferences=remotePrefs)=>({status:'ok',preferences,cursor});
test('opening a conversation loads the current server cursor and preferences before exposing ready state',async()=>{
  const scopes=[];const f=fixture({readPersonalStateHook:async scope=>{scopes.push(scope);return personalPage(cursor(message(105)));}});
  await f.store.setActiveConversation(c);assert.deepEqual(scopes,[{roomId:room,conversationId:c,personId:a,joinedAt:1000}]);
  assert.deepEqual(f.store.getSnapshot().readCursor,cursor(message(105)));assert.deepEqual(f.store.getSnapshot().preferences,remotePrefs);
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(message(100)),visible:true}),{status:'ignored'});
  assert.equal(f.reads.length,0);f.store.dispose();
});
test('a stale remote preference response after switching conversations cannot reintroduce the old cursor',async()=>{
  const pending=deferred();const f=fixture({readPersonalStateHook:scope=>scope.conversationId===c?pending.promise:personalPage(null)});
  const opening=f.store.setActiveConversation(c);await flush();await f.store.setActiveConversation(d);pending.resolve(personalPage(cursor(message(105)),{...remotePrefs,favorite:true}));await opening;
  assert.equal(f.store.getSnapshot().conversationId,d);assert.equal(f.store.getSnapshot().readCursor,null);assert.deepEqual(f.store.getSnapshot().preferences,remotePrefs);f.store.dispose();
});
test('the previous membership state is cleared while fetching the new personal state',async()=>{
  let epoch=1000;const pending=deferred();const f=fixture({readHook:()=>({status:'ok',joinedAt:epoch,messages:epoch===1000?[message(1),message(3)]:[message(3)],hasMore:false,nextCursor:null}),readPersonalStateHook:scope=>scope.joinedAt===1000?personalPage(cursor(message(1)),{...remotePrefs,favorite:true}):pending.promise});
  await f.store.setActiveConversation(c);f.store.setDraft('old draft');epoch=1002;const refreshing=f.store.refreshLatest();await flush();
  const interim=f.store.getSnapshot();assert.equal(interim.status,'loading');assert.deepEqual(interim.messages,[]);assert.equal(interim.readCursor,null);assert.equal(interim.preferences,null);assert.equal(interim.draft,'');
  pending.resolve(personalPage(null));await refreshing;assert.equal(f.store.getSnapshot().status,'ready');assert.equal(f.store.getSnapshot().preferences.favorite,false);assert.deepEqual(f.store.getSnapshot().messages.map(m=>m.id),[id(3)]);f.store.dispose();
});
test('a denied personal state read locks the conversation instead of exposing the loaded history',async()=>{
  const f=fixture({readPersonalStateHook:async()=>({status:'forbidden'})});
  assert.deepEqual(await f.store.setActiveConversation(c),{status:'forbidden'});assert.equal(f.store.getSnapshot().status,'forbidden');assert.deepEqual(f.store.getSnapshot().messages,[]);assert.equal(f.store.getSnapshot().preferences,null);f.store.dispose();
});

test('a send denial hides the draft until the same membership is reauthorized',async()=>{
  const f=fixture({sendHook:async()=>({status:'forbidden'})});
  await f.store.setActiveConversation(c);
  f.store.setDraft('synthetic draft');
  const composer=f.store.getComposer();
  composer.attempt={payload:{body:'immutable retry'}};
  assert.equal((await f.store.send({conversationId:c,requestId:'q_'+'7'.repeat(32),input:{body:'synthetic draft'}})).status,'locked');
  assert.equal(f.store.getSnapshot().draft,'');
  assert.equal(f.store.getComposer(),null);
  await f.store.setActiveConversation(c);
  assert.equal(f.store.getSnapshot().draft,'synthetic draft');
  assert.equal(f.store.getComposer().attempt.payload.body,'immutable retry');
  f.store.dispose();
});
test('a jump shows one bounded window with an explicit gap; activity never replaces it and reads never cross it',async()=>{
  const records=Array.from({length:5200},(_,i)=>message(i+1));
  const windowOf=index=>{const older=records.slice(Math.max(0,index-25),index),newer=records.slice(index+1,index+27);
    const list=[...older.slice(-24),records[index],...newer.slice(0,25)];
    return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasMore:older.length>24,nextCursor:older.length>24?cursor(list[0]):null,hasNewer:newer.length>25,newerCursor:newer.length>25?cursor(list.at(-1)):null};};
  const reads=[];
  const f=fixture({records,readHook(q){
    if(q.around){const index=records.findIndex(m=>m.id===q.around);return index<0?{status:'missing'}:windowOf(index);}
    if(q.from){const next=records.filter(m=>m.createdAt>q.from.createdAt||m.createdAt===q.from.createdAt&&m.id>=q.from.id).slice(0,q.limit+1),list=next.slice(0,q.limit);return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasNewer:next.length>q.limit,newerCursor:next.length>q.limit?cursor(list.at(-1)):null};}
    if(q.after){const index=records.findIndex(m=>m.id===q.after.id),next=records.slice(index+1,index+q.limit+2),list=next.slice(0,q.limit);
      return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasNewer:next.length>q.limit,newerCursor:next.length>q.limit?cursor(list.at(-1)):null};}
    const matches=records.filter(m=>!q.before||m.createdAt<q.before.createdAt).slice(-q.limit);
    return {status:'ok',joinedAt:1000,messages:structuredClone(matches),hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null};
  },markReadHook(q){reads.push(q);return {status:'ok',cursor:q.cursor};}});
  await f.store.setActiveConversation(c);
  assert.deepEqual(await f.store.loadAround(id(99999)),{status:'missing'});
  for(const distance of [300,301,4950]){
    await f.store.refreshLatest();
    const target=records[records.length-1-distance],before=f.calls.length;
    assert.deepEqual(await f.store.loadAround(target.id),{status:'ok'});
    assert.equal(f.calls.length-before,1);
    const snap=f.store.getSnapshot();
    assert.ok(snap.messages.length<=50);assert.equal(snap.messages.some(m=>m.id===target.id),true);
    assert.equal(snap.hasNewer,true);assert.equal(snap.hasMore,true);
  }
  // Live activity re-verifies the shown window in place (one bounded range read
  // from its first row, never the latest page); marking read across the gap is refused.
  const shown=f.store.getSnapshot().messages,calls=f.calls.length;
  f.watches.at(-1).changed();for(let i=0;i<6;i++)await flush();
  assert.equal(f.calls.length,calls+1);assert.deepEqual(f.calls.at(-1).from,cursor(shown[0]));
  assert.deepEqual(f.store.getSnapshot().messages.map(m=>m.id),shown.map(m=>m.id));assert.equal(f.store.getSnapshot().hasNewer,true);
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(shown.at(-1)),visible:true}),{status:'ignored'});
  assert.equal(reads.length,0);
  // Older and newer pages extend the window around the target.
  await f.store.loadOlder();assert.equal(f.store.getSnapshot().messages.length,100);
  await f.store.loadNewer();assert.equal(f.store.getSnapshot().messages.length,150);assert.equal(f.store.getSnapshot().hasNewer,true);
  // Returning to the latest closes the gap; reading works again.
  await f.store.refreshLatest();
  const latest=f.store.getSnapshot();
  assert.equal(latest.hasNewer,false);assert.equal(latest.messages.at(-1).id,records.at(-1).id);assert.equal(latest.messages.length,50);
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(latest.messages.at(-1)),visible:true}),{status:'ok'});
  // An already loaded target needs no request.
  const count=f.calls.length;assert.deepEqual(await f.store.loadAround(latest.messages[10].id),{status:'ok'});assert.equal(f.calls.length,count);
  // A window near the latest closes its gap with the last newer page.
  await f.store.loadAround(records.at(-60).id);
  assert.equal(f.store.getSnapshot().hasNewer,true);
  await f.store.loadNewer();await flush();
  assert.equal(f.store.getSnapshot().hasNewer,false);assert.equal(f.store.getSnapshot().messages.at(-1).id,records.at(-1).id);
  f.store.dispose();
});
test('a window response without its target or with inconsistent cursors is rejected',async()=>{
  const records=Array.from({length:120},(_,i)=>message(i+1));
  let lie='target';
  const f=fixture({records,readHook(q){
    if(q.around){
      const list=records.slice(10,20);
      if(lie==='target')return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasMore:true,nextCursor:cursor(list[0]),hasNewer:true,newerCursor:cursor(list.at(-1))};
      return {status:'ok',joinedAt:1000,messages:structuredClone(records.slice(40,50)),hasMore:true,nextCursor:cursor(records[40]),hasNewer:true,newerCursor:null};
    }
    const matches=records.filter(m=>!q.before||m.createdAt<q.before.createdAt).slice(-q.limit);
    return {status:'ok',joinedAt:1000,messages:structuredClone(matches),hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null};
  }});
  await f.store.setActiveConversation(c);
  assert.deepEqual(await f.store.loadAround(id(45)),{status:'unavailable'});
  lie='cursor';
  assert.deepEqual(await f.store.loadAround(id(45)),{status:'unavailable'});
  assert.equal(f.store.getSnapshot().hasNewer,false);
  f.store.dispose();
});
test('an older window reflects deletions and edits by others in place, keeps its gap and never marks read',async()=>{
  const records=Array.from({length:400},(_,i)=>message(i+1));
  const windowOf=index=>{const older=records.slice(Math.max(0,index-25),index),newer=records.slice(index+1,index+27);
    const list=[...older.slice(-24),records[index],...newer.slice(0,25)];
    return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasMore:older.length>24,nextCursor:older.length>24?cursor(list[0]):null,hasNewer:newer.length>25,newerCursor:newer.length>25?cursor(list.at(-1)):null};};
  const reads=[];
  const f=fixture({records,readHook(q){
    if(q.around){const index=records.findIndex(m=>m.id===q.around);return index<0||records[index].deletedAt?{status:'missing'}:windowOf(index);}
    if(q.from){const next=records.filter(m=>m.createdAt>q.from.createdAt||m.createdAt===q.from.createdAt&&m.id>=q.from.id).slice(0,q.limit+1),list=next.slice(0,q.limit);return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasNewer:next.length>q.limit,newerCursor:next.length>q.limit?cursor(list.at(-1)):null};}
    const matches=records.filter(m=>!q.before||m.createdAt<q.before.createdAt).slice(-q.limit);
    return {status:'ok',joinedAt:1000,messages:structuredClone(matches),hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null};
  },markReadHook(q){reads.push(q);return {status:'ok',cursor:q.cursor};}});
  await f.store.setActiveConversation(c);
  const anchor=records[100];
  assert.deepEqual(await f.store.loadAround(anchor.id),{status:'ok'});
  // Another member deletes one message and edits another inside the window.
  records[95]={...records[95],revision:2,deletedAt:7000,body:undefined};
  records[105]={...records[105],revision:2,body:'edited elsewhere',editedAt:7000};
  const before=f.calls.length;
  f.watches.at(-1).changed();await flush();await flush();
  const snap=f.store.getSnapshot();
  assert.equal(f.calls.length-before,1);assert.ok(f.calls.at(-1).from,'a range read, not an anchor read');
  assert.equal(snap.messages.find(m=>m.id===records[95].id).deletedAt,7000);
  assert.equal(snap.messages.find(m=>m.id===records[105].id).body,'edited elsewhere');
  assert.equal(snap.hasNewer,true);assert.equal(snap.messages.some(m=>m.id===records.at(-1).id),false);
  assert.deepEqual(await f.store.markRead({conversationId:c,cursor:cursor(snap.messages.at(-1)),visible:true}),{status:'ignored'});
  // The jump target itself is deleted: the range read reflects it with no extra request.
  records[100]={...records[100],revision:2,deletedAt:8000,body:undefined};
  const beforeTarget=f.calls.length;
  f.watches.at(-1).changed();for(let i=0;i<6;i++)await flush();
  assert.equal(f.calls.length-beforeTarget,1);
  const after=f.store.getSnapshot();
  assert.equal(after.messages.find(m=>m.id===anchor.id).deletedAt,8000);
  assert.equal(after.hasNewer,true);
  assert.equal(reads.length,0);
  f.store.dispose();
});
test('window refresh races: activity during a jump, cursors after older pages, bursts and a deleted anchor neighbourhood',async()=>{
  const records=Array.from({length:400},(_,i)=>message(i+1));
  let gate=null;
  const windowOf=index=>{const older=records.slice(Math.max(0,index-25),index),newer=records.slice(index+1,index+27);
    const list=[...older.slice(-24),records[index],...newer.slice(0,25)];
    return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasMore:older.length>24,nextCursor:older.length>24?cursor(list[0]):null,hasNewer:newer.length>25,newerCursor:newer.length>25?cursor(list.at(-1)):null};};
  const f=fixture({records,async readHook(q){
    if(gate)await gate.promise;
    if(q.around){const index=records.findIndex(m=>m.id===q.around);return index<0||records[index].deletedAt?{status:'missing'}:windowOf(index);}
    if(q.from){const next=records.filter(m=>m.createdAt>q.from.createdAt||m.createdAt===q.from.createdAt&&m.id>=q.from.id).slice(0,q.limit+1),list=next.slice(0,q.limit);return {status:'ok',joinedAt:1000,messages:structuredClone(list),hasNewer:next.length>q.limit,newerCursor:next.length>q.limit?cursor(list.at(-1)):null};}
    const matches=records.filter(m=>!q.before||m.createdAt<q.before.createdAt).slice(-q.limit);
    return {status:'ok',joinedAt:1000,messages:structuredClone(matches),hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null};
  }});
  await f.store.setActiveConversation(c);
  // Activity arriving while the jump is still loading never moves to the latest page.
  gate=deferred();const jump=f.store.loadAround(records[200].id);await flush();
  f.watches.at(-1).changed();await flush();
  gate.resolve();gate=null;await jump;for(let i=0;i<6;i++)await flush();
  let snap=f.store.getSnapshot();
  assert.equal(snap.hasNewer,true);assert.equal(snap.messages.some(m=>m.id===records.at(-1).id),false);
  // No latest-page read after the jump (only window and range reads).
  assert.equal(f.calls.slice(1).some(q=>!q.around&&!q.before&&!q.from&&!q.after),false);
  // After an older page, a refresh keeps both cursors and the loaded range.
  await f.store.loadOlder();
  snap=f.store.getSnapshot();const kept={next:snap.nextCursor,newer:snap.newerCursor,ids:snap.messages.map(m=>m.id)};
  f.watches.at(-1).changed();for(let i=0;i<6;i++)await flush();
  snap=f.store.getSnapshot();
  assert.deepEqual(snap.nextCursor,kept.next);assert.deepEqual(snap.newerCursor,kept.newer);assert.deepEqual(snap.messages.map(m=>m.id),kept.ids);
  // A burst of activity is coalesced into at most two passes (each pass reads
  // the shown rows in pages of 50).
  const before=f.calls.length;gate=deferred();
  for(let i=0;i<10;i++)f.watches.at(-1).changed();
  await flush();gate.resolve();gate=null;for(let i=0;i<10;i++)await flush();
  assert.ok(f.calls.length-before<=2*Math.ceil(kept.ids.length/50),'requests: '+(f.calls.length-before));
  // The jump target and every neighbour are deleted: one pass, no chained reads.
  records[200]={...records[200],revision:2,deletedAt:9000,body:undefined};
  for(let i=0;i<400;i++)if(i!==200&&!records[i].deletedAt)records[i]={...records[i],revision:2,deletedAt:9000,body:undefined};
  const start=f.calls.length;
  f.watches.at(-1).changed();for(let i=0;i<10;i++)await flush();
  assert.ok(f.calls.length-start<=Math.ceil(kept.ids.length/50),'requests: '+(f.calls.length-start));
  assert.deepEqual(f.store.getSnapshot().messages.map(m=>m.id),kept.ids);
  assert.equal(f.store.getSnapshot().messages.every(m=>m.deletedAt!=null),true);assert.equal(f.store.getSnapshot().hasNewer,true);
  f.store.dispose();
});
// Review 5: shown rows are re-verified as a bounded range (no anchor), at most
// 150 rows are kept, and refresh passes never chain.
function rangeFixture({total=400}={}){
  const records=Array.from({length:total},(_,i)=>message(i+1));
  let gate=null,fail=null,failCall=null;
  const cmp=(m,c0)=>m.createdAt-c0.createdAt||(m.id<c0.id?-1:m.id>c0.id?1:0);
  const page=(list,{hasMore,nextCursor,hasNewer,newerCursor})=>({status:'ok',joinedAt:1000,messages:structuredClone(list),...(hasMore!==undefined?{hasMore,nextCursor}:{}),...(hasNewer!==undefined?{hasNewer,newerCursor}:{})});
  const f=fixture({records,async readHook(q){
    if(gate)await gate.promise;
    if(fail){const status=fail;fail=null;return {status};}
    if(failCall!==null&&f.calls.length===failCall){failCall=null;return {status:'unavailable'};}
    if(q.around){const i=records.findIndex(m=>m.id===q.around);if(i<0||records[i].deletedAt)return {status:'missing'};
      const older=records.slice(Math.max(0,i-25),i),newer=records.slice(i+1,i+27),list=[...older.slice(-24),records[i],...newer.slice(0,25)];
      return page(list,{hasMore:older.length>24,nextCursor:older.length>24?cursor(list[0]):null,hasNewer:newer.length>25,newerCursor:newer.length>25?cursor(list.at(-1)):null});}
    if(q.from||q.after){const c0=q.from??q.after,next=records.filter(m=>q.from?cmp(m,c0)>=0:cmp(m,c0)>0).slice(0,q.limit+1),list=next.slice(0,q.limit);
      return page(list,{hasNewer:next.length>q.limit,newerCursor:next.length>q.limit?cursor(list.at(-1)):null});}
    const matches=records.filter(m=>!q.before||cmp(m,q.before)<0).slice(-q.limit);
    return page(matches,{hasMore:matches.length===q.limit,nextCursor:matches.length===q.limit?cursor(matches[0]):null});
  }});
  const del=i=>{records[i]={...records[i],revision:records[i].revision+1,deletedAt:9000,body:undefined};};
  const edit=(i,body)=>{records[i]={...records[i],revision:records[i].revision+1,body,editedAt:9000};};
  const notify=()=>f.watches.at(-1).changed();
  const settle=async()=>{for(let i=0;i<30;i++)await flush();};
  return {f,records,del,edit,notify,settle,pause(){gate=deferred();return gate;},release(){const g=gate;gate=null;g?.resolve();},failNext(status){fail=status;},failCallAfter(k){failCall=f.calls.length+k;}};
}
test('review5: deletions and edits in added older pages are reflected (window), within three requests per pass',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);
  await r.f.store.loadAround(r.records[250].id);await r.f.store.loadOlder();await r.f.store.loadOlder();
  const before=r.f.store.getSnapshot();
  assert.equal(before.messages.length,150);assert.equal(before.hasNewer,true);
  const oldest=r.records.findIndex(m=>m.id===before.messages[0].id);
  r.del(oldest+3);r.edit(oldest+70,'edited in the middle page');r.del(oldest+140);
  const start=r.f.calls.length;r.notify();await r.settle();
  const snap=r.f.store.getSnapshot(),row=i=>snap.messages.find(m=>m.id===r.records[i].id);
  assert.equal(row(oldest+3).deletedAt,9000);assert.equal(row(oldest+70).body,'edited in the middle page');assert.equal(row(oldest+140).deletedAt,9000);
  assert.ok(r.f.calls.length-start<=3,'requests: '+(r.f.calls.length-start));
  assert.equal(r.f.calls.slice(start).some(q=>q.around),false,'no anchor re-read');
  assert.deepEqual(snap.messages.map(m=>m.id),before.messages.map(m=>m.id));
  assert.deepEqual(snap.nextCursor,before.nextCursor);assert.deepEqual(snap.newerCursor,before.newerCursor);assert.equal(snap.hasNewer,true);
  assert.deepEqual(await r.f.store.markRead({conversationId:c,cursor:cursor(snap.messages.at(-1)),visible:true}),{status:'ignored'});
  r.f.store.dispose();
});
test('review5: an older page added in the normal view is re-verified too',async()=>{
  const r=rangeFixture({total:120});
  await r.f.store.setActiveConversation(c);await r.f.store.loadOlder();
  const snap0=r.f.store.getSnapshot();assert.equal(snap0.messages.length,100);assert.equal(snap0.hasNewer,false);
  r.del(30);r.edit(90,'edited in the latest page');
  const start=r.f.calls.length;r.notify();await r.settle();
  const snap=r.f.store.getSnapshot();
  assert.equal(snap.messages.find(m=>m.id===r.records[30].id).deletedAt,9000);
  assert.equal(snap.messages.find(m=>m.id===r.records[90].id).body,'edited in the latest page');
  assert.ok(r.f.calls.length-start<=3,'requests: '+(r.f.calls.length-start));
  r.f.store.dispose();
});
test('review5: the anchor and its neighbours deleted under overlapping notifications settle in at most two passes',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[200].id);
  const start=r.f.calls.length;
  r.pause();r.notify();await flush();
  for(const i of [198,199,200,201,202])r.del(i);
  for(let i=0;i<10;i++)r.notify();
  r.release();await r.settle();
  const snap=r.f.store.getSnapshot();
  for(const i of [198,199,200,201,202])assert.equal(snap.messages.find(m=>m.id===r.records[i].id).deletedAt,9000);
  assert.ok(r.f.calls.length-start<=2,'requests: '+(r.f.calls.length-start));
  assert.equal(snap.hasNewer,true);
  r.f.store.dispose();
});
test('review5: at most 150 rows are kept; the far end is trimmed with consistent cursors and gap',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[250].id);
  for(let i=0;i<3;i++)await r.f.store.loadOlder();
  let snap=r.f.store.getSnapshot();
  assert.equal(snap.messages.length,150);assert.equal(snap.hasNewer,true);assert.deepEqual(snap.newerCursor,cursor(snap.messages.at(-1)));
  assert.equal(snap.hasMore,true);assert.deepEqual(snap.nextCursor,cursor(snap.messages[0]));
  for(let i=0;i<3;i++)await r.f.store.loadNewer();
  snap=r.f.store.getSnapshot();
  assert.ok(snap.messages.length<=150);assert.equal(snap.hasMore,true);assert.deepEqual(snap.nextCursor,cursor(snap.messages[0]));
  for(let i=1;i<snap.messages.length;i++)assert.ok(snap.messages[i-1].createdAt<snap.messages[i].createdAt);
  // The normal view becomes a window with a gap once older pages exceed the cap.
  const n=rangeFixture();
  await n.f.store.setActiveConversation(c);for(let i=0;i<3;i++)await n.f.store.loadOlder();
  const normal=n.f.store.getSnapshot();
  assert.equal(normal.messages.length,150);assert.equal(normal.hasNewer,true);assert.deepEqual(normal.newerCursor,cursor(normal.messages.at(-1)));
  r.f.store.dispose();n.f.store.dispose();
});
test('review5: a failed refresh keeps the display without retrying; the next notification recovers',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[200].id);
  r.del(205);r.failNext('unavailable');
  const start=r.f.calls.length;r.notify();await r.settle();
  assert.equal(r.f.calls.length-start,1,'no retry after a failure');
  assert.equal(r.f.store.getSnapshot().messages.find(m=>m.id===r.records[205].id).deletedAt??null,null);
  assert.equal(r.f.store.getSnapshot().status,'ready');
  r.notify();await r.settle();
  assert.equal(r.f.store.getSnapshot().messages.find(m=>m.id===r.records[205].id).deletedAt,9000);
  r.f.store.dispose();
});
test('review5: revocation during a refresh locks the conversation and shows no history',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[200].id);
  r.failNext('forbidden');r.notify();await r.settle();
  const snap=r.f.store.getSnapshot();
  assert.equal(snap.status,'forbidden');assert.equal(snap.messages.length,0);
  r.f.store.dispose();
});
test('review5: rows at every page boundary of a 150-row window are re-verified (no gaps between range reads)',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);
  await r.f.store.loadAround(r.records[250].id);await r.f.store.loadOlder();await r.f.store.loadOlder();
  const shown=r.f.store.getSnapshot().messages,base=r.records.findIndex(m=>m.id===shown[0].id);
  const offsets=[0,49,50,99,100,149];
  for(const o of offsets)r.del(base+o);
  const start=r.f.calls.length;r.notify();await r.settle();
  const snap=r.f.store.getSnapshot();
  for(const o of offsets)assert.equal(snap.messages.find(m=>m.id===r.records[base+o].id).deletedAt,9000,'offset '+o);
  assert.equal(r.f.calls.length-start,3);
  r.f.store.dispose();
});
test('review5: normal view at the cap with new messages and a deletion keeps 150 rows and verifies all of them',async()=>{
  const r=rangeFixture({total:300});
  await r.f.store.setActiveConversation(c);await r.f.store.loadOlder();await r.f.store.loadOlder();
  let snap=r.f.store.getSnapshot();assert.equal(snap.messages.length,150);assert.equal(snap.hasNewer,false);
  // Ten new messages arrive and an older shown row is deleted.
  for(let i=0;i<10;i++)r.records.push(message(301+i));
  const oldest=r.records.findIndex(m=>m.id===snap.messages[0].id);
  r.del(oldest+20);
  const start=r.f.calls.length;r.notify();await r.settle();
  snap=r.f.store.getSnapshot();
  assert.equal(snap.messages.length,150);assert.equal(snap.hasNewer,false);
  assert.equal(snap.messages.at(-1).id,r.records.at(-1).id);
  assert.equal(snap.hasMore,true);assert.deepEqual(snap.nextCursor,cursor(snap.messages[0]));
  assert.equal(snap.messages.find(m=>m.id===r.records[oldest+20].id).deletedAt,9000);
  assert.ok(r.f.calls.length-start<=3,'requests: '+(r.f.calls.length-start));
  r.f.store.dispose();
});
test('review5: a user action during a pass wins; the pass stops, nothing trimmed comes back, and it runs again once',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[250].id);await r.f.store.loadOlder();
  r.del(r.records.findIndex(m=>m.id===r.f.store.getSnapshot().messages[60].id));
  r.pause();r.notify();await flush();
  // The person adds another older page while the pass waits on the network.
  const older=r.f.store.loadOlder();
  r.release();await older;await r.settle();
  const snap=r.f.store.getSnapshot();
  assert.equal(snap.messages.length,150);
  for(let i=1;i<snap.messages.length;i++)assert.ok(snap.messages[i-1].createdAt<snap.messages[i].createdAt);
  assert.equal(snap.messages.filter(m=>m.deletedAt===9000).length,1,'the deletion is reflected after the rerun');
  // Switching conversation during a pass sends nothing for the old conversation afterwards.
  r.pause();r.notify();await flush();
  const switched=r.f.store.setActiveConversation(d);
  const callsAtSwitch=r.f.calls.length;
  r.release();await switched;await r.settle();
  assert.equal(r.f.calls.slice(callsAtSwitch).some(q=>q.conversationId===c),false);
  r.f.store.dispose();
});
test('review5: a pass that meets a new join time reads the latest page once; a mid-pass failure keeps what was merged',async()=>{
  // First range page succeeds, the second fails: the first page's change stays, no retry.
  const g=rangeFixture();
  await g.f.store.setActiveConversation(c);await g.f.store.loadAround(g.records[250].id);await g.f.store.loadOlder();
  const rows=g.f.store.getSnapshot().messages,b0=g.records.findIndex(m=>m.id===rows[0].id);
  g.del(b0+5);g.del(b0+75);
  const s0=g.f.calls.length;
  g.failCallAfter(2);g.notify();await g.settle();
  const after=g.f.store.getSnapshot();
  assert.equal(after.messages.find(m=>m.id===g.records[b0+5].id).deletedAt,9000);
  assert.equal(after.messages.find(m=>m.id===g.records[b0+75].id).deletedAt??null,null);
  assert.equal(g.f.calls.length-s0,2,'no retry after the failed second read');
  assert.equal(after.status,'ready');
  // A new join time seen mid-pass: the pass reads the latest page exactly once.
  g.failNext('missing');
  const s1=g.f.calls.length;g.notify();await g.settle();
  const tail=g.f.calls.slice(s1);
  assert.equal(tail.filter(q=>!q.from&&!q.before&&!q.around&&!q.after).length,1);
  g.f.store.dispose();
});
test('review5: after trimming, loading newer pages continues seamlessly from the trimmed edge',async()=>{
  const r=rangeFixture();
  await r.f.store.setActiveConversation(c);await r.f.store.loadAround(r.records[250].id);
  for(let i=0;i<3;i++)await r.f.store.loadOlder();
  const trimmedEdge=r.f.store.getSnapshot().messages.at(-1);
  await r.f.store.loadNewer();
  const snap=r.f.store.getSnapshot(),i0=snap.messages.findIndex(m=>m.id===trimmedEdge.id);
  assert.ok(i0>=0);
  const ids=snap.messages.map(m=>m.id),expected=r.records.slice(r.records.findIndex(m=>m.id===ids[0]),r.records.findIndex(m=>m.id===ids[0])+ids.length).map(m=>m.id);
  assert.deepEqual(ids,expected,'contiguous with the records');
  r.f.store.dispose();
});
