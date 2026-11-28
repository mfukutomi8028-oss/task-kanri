import test from 'node:test';
import assert from 'node:assert/strict';
import * as live from '../workspace-messaging-live-commands.js';
const roomId='roomA',p='p_'+'a'.repeat(32),peer='p_'+'b'.repeat(32),self='self_'+p,direct='dm_'+p+'_'+peer,group='group_g_'+'c'.repeat(32),incoming='msg_'+peer+'_q_'+'d'.repeat(32);
const member=(id,extra)=>({id,kind:'self',status:'active',role:'member',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000,...extra});
function fixture({unreadSync}={}){
  let identity={status:'bound',roomId,personId:p},listener,active=direct,disposed=false,unread={status:'ok',roomId,personId:p,conversationId:direct,joinedAt:1000,unread:2,muted:false,complete:true,latestIncoming:{id:incoming,createdAt:2000}},result=null;
  const calls=[],rows=[member(self),member(direct,{kind:'direct',peerId:peer,memberCount:2})],invites=[{conversationId:group,title:'Team',invitedBy:peer,invitedAt:2000,revision:3}];
  const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
  const directory={async refresh(){calls.push(['directory']);return {status:'ok'};},getSnapshot(){return {status:'ready',roomId,personId:p,conversations:rows,invites,complete:true,nextCursor:null};}};
  const api={async readPeople(scope){calls.push(['people',scope]);return {status:'ok',roomId,personId:p,people:[{personId:p,displayName:'Me'},{personId:peer,displayName:'Peer'}]};},async readUnread(scope){calls.push(['unread',scope]);return unread;},async executeConversation(scope){calls.push(['command',scope]);return result??{status:'ok',conversationId:scope.conversationId,revision:4,indexPending:false};}};
  const personal={async readPersonalState(scope){calls.push(['preferences',scope]);return {status:'ok',preferences:{favorite:true,muted:false,pinned:false,archived:false},cursor:null};}};
  const commands=live.createMessagingLiveCommands({session,directory,api,personal,activeConversation:()=>active,makeGroupId:()=> 'g_'+'e'.repeat(32),...(unreadSync?{unreadSync}:{})});
  return {commands,calls,rows,invites,api,change(value){identity=value;listener?.(value);},setActive(id){active=id;},setUnread(value){unread=value;},setResult(value){result=value;},dispose(){commands.dispose();disposed=true;}};
}
test('real directory rows are labelled, and only the selected conversation has its unread and preferences fetched',async()=>{
  const f=fixture(),result=await f.commands.list();assert.equal(result.status,'ok');assert.equal(result.conversations[0].title,'\u81ea\u5206\u5b9b\u3066\u30e1\u30c3\u30bb\u30fc\u30b8');assert.equal(result.conversations[1].title,'Peer');assert.equal(result.conversations[0].unread,null);assert.equal(result.conversations[1].unread,2);assert.equal(result.conversations[1].favorite,true);assert.equal(result.complete,false);assert.equal(result.directoryComplete,true);assert.equal(result.invites[0].title,'Team');assert.deepEqual(f.calls.filter(x=>x[0]==='unread'),[['unread',{roomId,conversationId:direct}]]);assert.equal(f.calls.filter(x=>x[0]==='preferences').length,1);f.dispose();
});
test('an incomplete or wrong-epoch unread result is never reported as zero or complete',async()=>{
  for(const patch of [{unread:0,complete:false,latestIncoming:null},{joinedAt:999},{personId:peer}]){const f=fixture();f.setUnread({status:'ok',roomId,personId:p,conversationId:direct,joinedAt:1000,unread:2,muted:false,complete:true,latestIncoming:{id:incoming,createdAt:2000},...patch});const result=await f.commands.list();assert.equal(result.conversations[1].unread,null);assert.equal(result.complete,false);f.dispose();}
});
test('invitation response uses the last authorized revision, not a caller-provided identity',async()=>{
  const f=fixture();assert.equal((await f.commands.respondInvite(group,true)).status,'invalid');await f.commands.list();let changes=0;f.commands.subscribe(()=>changes++);assert.equal((await f.commands.respondInvite(group,true)).status,'ok');assert.deepEqual(f.calls.at(-1),['command',{roomId,conversationId:group,command:{type:'respondInvite',accept:true,expectedRevision:3}}]);assert.equal(changes,1);f.dispose();
});
test('direct and self conversations use deterministic IDs and approved people only',async()=>{
  const f=fixture();await f.commands.users();assert.equal((await f.commands.openDirect('p_'+'f'.repeat(32))).status,'invalid');assert.equal((await f.commands.openDirect(peer)).conversationId,direct);assert.equal((await f.commands.openSelf()).conversationId,self);assert.deepEqual(f.calls.filter(x=>x[0]==='command').map(x=>x[1].conversationId),[direct,self]);f.dispose();
});
test('uncertain group creation retains the group ID and does not issue a second create for a changed payload',async()=>{
  const f=fixture();await f.commands.users();f.setResult({status:'unavailable'});assert.equal((await f.commands.createGroup({title:'Team',invitees:[peer]})).status,'unavailable');assert.equal((await f.commands.createGroup({title:'Other',invitees:[peer]})).status,'conflict');await f.commands.createGroup({title:'Team',invitees:[peer]});const ids=f.calls.filter(x=>x[0]==='command').map(x=>x[1].conversationId);assert.deepEqual(ids,['group_g_'+'e'.repeat(32),'group_g_'+'e'.repeat(32)]);f.dispose();
});
test('late response after identity switch cannot expose old roster, rows or issue an old invitation',async()=>{
  const f=fixture();let release,start;const pending=new Promise(r=>release=r),started=new Promise(r=>start=r);const read=f.api.readPeople;f.api.readPeople=async args=>{start();await pending;return read(args);};const old=f.commands.list();await started;f.change({status:'locked'});release();assert.equal((await old).status,'locked');assert.equal(f.commands.resolvePerson(peer),null);assert.equal((await f.commands.respondInvite(group,true)).status,'locked');f.dispose();
});
test('a revoked selected membership is removed rather than shown with stale preferences',async()=>{
  const f=fixture();f.setUnread({status:'forbidden'});const result=await f.commands.list();assert.deepEqual(result.conversations.map(r=>r.id),[self]);assert.equal(result.complete,false);assert.equal(result.directoryComplete,false);f.dispose();
});

function syncFixture(){
  const summaries=new Map();let listener,scopes=[];
  return {scopes,read:(id,epoch)=>summaries.get(id+'/'+epoch)??null,setDirectory:(snapshot,selected,options)=>scopes.push({snapshot,selected,options}),subscribe(fn){listener=fn;return ()=>{listener=null;};},set(id,value,epoch=1000){summaries.set(id+'/'+epoch,value);listener?.();}};
}
test('all known unread summaries are projected without repeating directory, roster or history requests',async()=>{
 const sync=syncFixture(),f=fixture({unreadSync:sync});let updates=[];f.commands.subscribe(options=>updates.push(options));
 const first=await f.commands.list();assert.equal(first.conversations.every(r=>r.unread===null),true);assert.equal(f.calls.filter(c=>c[0]==='unread').length,0);assert.equal(sync.scopes.length,1);assert.equal(sync.scopes[0].selected,direct);
 sync.set(self,{status:'ok',unread:0,muted:false,latestIncoming:null});sync.set(direct,{status:'ok',unread:2,muted:true,latestIncoming:{id:incoming,createdAt:2000}});await new Promise(r=>setImmediate(r));
 assert.equal(updates.length,1);assert.deepEqual(updates[0],{cached:true});const second=await f.commands.list(updates[0]);assert.deepEqual(second.conversations.map(r=>r.unread),[0,2]);assert.equal(second.conversations[1].favorite,true);assert.equal(second.conversations[1].muted,true);assert.equal(second.complete,true);assert.equal(f.calls.length,3);
 sync.set(direct,{status:'forbidden'});const revoked=await f.commands.list({cached:true});assert.deepEqual(revoked.conversations.map(r=>r.id),[self]);assert.equal(revoked.complete,false);f.change({status:'locked'});assert.equal((await f.commands.list({cached:true})).status,'locked');f.dispose();
});

test('directory preferences survive selecting another conversation and closing the workspace',async()=>{
  const f=fixture();
  const saved={favorite:true,pinned:true,archived:true,muted:true};
  f.rows[1].preferences=saved;
  for(const active of [self,null]){
    f.setActive(active);
    const result=await f.commands.list();
    const row=result.conversations.find(value=>value.id===direct);
    assert.deepEqual(Object.fromEntries(Object.keys(saved).map(key=>[key,row[key]])),saved);
  }
  f.dispose();
});

test('the saved mute preference takes precedence over an old unread projection',async()=>{
  const sync=syncFixture(),f=fixture({unreadSync:sync});
  f.rows[1].preferences={favorite:false,pinned:false,archived:false,muted:true};
  sync.set(direct,{status:'ok',unread:2,muted:false,latestIncoming:{id:incoming,createdAt:2000}});
  try{
    const result=await f.commands.list();
    assert.equal(result.conversations[1].unread,2);
    assert.equal(result.conversations[1].muted,true);
  }finally{f.dispose();}
});
