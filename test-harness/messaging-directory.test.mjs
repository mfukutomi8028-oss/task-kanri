import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConversationCommand} from '../security/messaging-conversation-commands.mjs';
import {createMessagingDirectoryService,createMessagingIndexReconciler} from '../security/messaging-directory-service.mjs';

const roomId='roomA',a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),c='p_'+'c'.repeat(32);
const g='group_g_'+'1'.repeat(32),g2='group_g_'+'2'.repeat(32),dm='dm_'+a+'_'+b,self='self_'+a;
const ctx=(conversationId,personId=a,now=1000)=>({roomId,conversationId,personId,now,approvedPersonIds:[a,b,c]});
const create=(id,invitees=[b])=>applyConversationCommand(null,{type:'createGroup',title:'Project',invitees},ctx(id)).control;
const change=(row,command,actor=a,now=2000)=>applyConversationCommand(row,{...command,expectedRevision:row.revision},ctx(row.id,actor,now)).control;
function fixture(){
  const bindings=new Map([['uidA',{uid:'uidA',roomId,personId:a,approved:true,active:true}],['uidB',{uid:'uidB',roomId,personId:b,approved:true,active:true}],['uidC',{uid:'uidC',roomId,personId:c,approved:false,active:true}]]);
  const controls=new Map(),indexes=new Map(),reads=[];let controlHook=()=>{},writeHook=()=>{};
  const key=(person,id)=>person+'/'+id;
  const adapters={
    verifyToken:async token=>({uid:token}),readBinding:async scope=>scope.roomId===roomId?structuredClone(bindings.get(scope.uid)??null):null,
    readControl:async scope=>{assert.equal(scope.roomId,roomId);reads.push(scope.conversationId);await controlHook(scope);return structuredClone(controls.get(scope.conversationId)??null);},
    readIndexPage:async({personId,after,limit,roomId:requestedRoom})=>{assert.equal(requestedRoom,roomId);assert.ok(limit<=101);return [...indexes].filter(([k])=>k.startsWith(personId+'/')).map(([k,value])=>({id:k.slice(personId.length+1),...value})).sort((x,y)=>x.id<y.id?-1:x.id>y.id?1:0).filter(row=>after===null||row.id>after).slice(0,limit);},
    writeIndexRow:async({personId,conversationId,roomId:requestedRoom},next)=>{assert.equal(requestedRoom,roomId);await writeHook({personId,conversationId,next});const k=key(personId,conversationId),old=indexes.get(k);if(!old||old.revision<next.revision)indexes.set(k,structuredClone(next));else if(old.revision===next.revision)assert.deepEqual(old,next);}
  };
  const service=createMessagingDirectoryService(adapters),repair=createMessagingIndexReconciler(adapters);
  const list=(token='uidA',patch={})=>service.readDirectory({token,roomId,...patch});
  return {bindings,controls,indexes,reads,repair,list,key,setControlHook(fn){controlHook=fn;},setWriteHook(fn){writeHook=fn;},async reconcile(id){return repair.reconcile({roomId,conversationId:id});}};
}

test('the index discovers only current members and pending invitees without returning private control fields',async()=>{
  const f=fixture();f.controls.set(g,create(g));assert.equal((await f.reconcile(g)).status,'ok');
  assert.deepEqual(await f.list(),{status:'ok',roomId,personId:a,conversations:[{id:g,kind:'group',status:'active',title:'Project',role:'owner',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000}],invites:[],hasMore:false,nextCursor:null});
  const invited=await f.list('uidB');assert.deepEqual(invited.conversations,[]);assert.deepEqual(invited.invites,[{conversationId:g,title:'Project',invitedBy:a,invitedAt:1000,revision:1}]);
  assert.deepEqual(await f.list('uidC'),{status:'forbidden'});assert.equal(JSON.stringify(invited).includes('members'),false);
});
test('old index rows cannot expose removed groups or stale invitation details',async()=>{
  const f=fixture();const initial=create(g);f.controls.set(g,initial);await f.reconcile(g);
  const joined=change(initial,{type:'respondInvite',accept:true},b);f.controls.set(g,joined);
  assert.equal((await f.list('uidB')).conversations[0].joinedAt,2000);
  f.controls.set(g,change(joined,{type:'removeMember',personId:b},a,3000));
  const result=await f.list('uidB');assert.deepEqual(result.conversations,[]);assert.deepEqual(result.invites,[]);
  await f.reconcile(g);assert.deepEqual(f.indexes.get(f.key(b,g)),{revision:3,state:'inactive'});
});
test('index repair is idempotent and an old repair cannot replace the newer membership version',async()=>{
  const f=fixture();const initial=create(g);f.controls.set(g,initial);await f.reconcile(g);
  let release,started;const entered=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  f.setWriteHook(async ({personId,next})=>{if(personId===b&&next.revision===2){started();await gate;}});
  const joined=change(initial,{type:'respondInvite',accept:true},b);f.controls.set(g,joined);const slow=f.reconcile(g);await entered;
  f.controls.set(g,change(joined,{type:'removeMember',personId:b},a,3000));await f.reconcile(g);release();await slow;
  assert.deepEqual(f.indexes.get(f.key(b,g)),{revision:3,state:'inactive'});assert.deepEqual((await f.list('uidB')).conversations,[]);
  await f.reconcile(g);assert.equal(f.indexes.size,2);
});
test('pagination is bounded, including inactive entries, and does not scan the room',async()=>{
  const f=fixture();f.controls.set(g,create(g));f.controls.set(g2,create(g2));await f.reconcile(g);await f.reconcile(g2);f.reads.length=0;
  const first=await f.list('uidA',{limit:1});assert.equal(first.hasMore,true);assert.equal(first.nextCursor,g);assert.deepEqual(first.conversations.map(x=>x.id),[g]);assert.deepEqual(f.reads,[g,g]);
  const second=await f.list('uidA',{limit:1,after:first.nextCursor});assert.equal(second.hasMore,false);assert.equal(second.nextCursor,null);assert.deepEqual(second.conversations.map(x=>x.id),[g2]);
});
test('direct and self rows return canonical peer identity, not arbitrary stored titles',async()=>{
  const f=fixture();f.controls.set(dm,applyConversationCommand(null,{type:'openDirect',personId:b},ctx(dm)).control);f.controls.set(self,applyConversationCommand(null,{type:'openSelf'},ctx(self)).control);await f.reconcile(dm);await f.reconcile(self);
  const rows=(await f.list()).conversations;assert.equal(rows[0].peerId,b);assert.equal(rows[0].title,undefined);assert.equal(rows[1].kind,'self');assert.equal(rows[1].peerId,undefined);
});
test('revocation or changed membership while reading does not return old rows',async()=>{
  const f=fixture();f.controls.set(g,create(g));await f.reconcile(g);let count=0;
  f.setControlHook(()=>{if(++count===1)f.bindings.get('uidA').active=false;});assert.deepEqual(await f.list(),{status:'forbidden'});
  f.bindings.get('uidA').active=true;count=0;f.setControlHook(()=>{if(++count===2)f.controls.set(g,change(f.controls.get(g),{type:'rename',title:'New'},a,3000));});assert.deepEqual(await f.list(),{status:'stale'});
});
test('invalid request and forged actor never reach the index',async()=>{
  const f=fixture();for(const patch of [{personId:b},{roomId:'other/path'},{limit:101},{after:'bad'}])assert.deepEqual(await f.list('uidA',patch),{status:'invalid'});assert.deepEqual(f.reads,[]);
});
test('corrupt canonical control is never projected or repaired',async()=>{
  const f=fixture();f.controls.set(g,{...create(g),id:g2});assert.deepEqual(await f.reconcile(g),{status:'unavailable'});f.indexes.set(f.key(a,g),{revision:1,state:'member'});assert.deepEqual(await f.list(),{status:'unavailable'});
});
test('archived pending invite is hidden until reopening',async()=>{
  const f=fixture();const initial=create(g);f.controls.set(g,initial);await f.reconcile(g);
  const archived=change(initial,{type:'setArchived',archived:true});f.controls.set(g,archived);assert.deepEqual((await f.list('uidB')).invites,[]);assert.equal((await f.list()).conversations[0].status,'archived');
  f.controls.set(g,change(archived,{type:'setArchived',archived:false},a,3000));await f.reconcile(g);assert.equal((await f.list('uidB')).invites.length,1);
});

test('maintenance repairs missing index rows in bounded control pages and reports retryable failures',async()=>{
  const f=fixture();f.controls.set(g,create(g));f.controls.set(g2,create(g2));
  const index=f.indexes;
  const worker=createMessagingIndexReconciler({
    readControl:async({conversationId})=>structuredClone(f.controls.get(conversationId)??null),
    readControlPage:async({roomId:room,after,limit})=>{assert.equal(room,roomId);assert.ok(limit<=51);return [...f.controls.keys()].sort().filter(id=>after===null||id>after).slice(0,limit);},
    writeIndexRow:async({personId,conversationId},row)=>{if(conversationId===g2)throw Error('Temporary outage');index.set(f.key(personId,conversationId),row);}
  });
  assert.deepEqual(await worker.reconcilePage({roomId,limit:1}),{status:'ok',processed:1,failed:[],hasMore:true,nextCursor:g});
  assert.equal((await f.list()).conversations[0].id,g);
  assert.deepEqual(await worker.reconcilePage({roomId,limit:1,after:g}),{status:'partial',processed:1,failed:[g2],hasMore:false,nextCursor:null});
  await f.reconcile(g2);assert.deepEqual((await f.list()).conversations.map(x=>x.id),[g,g2]);
});

test('the person bound in the UI must match the verified token for directory discovery',async()=>{
  const f=fixture();f.controls.set(g,create(g));await f.reconcile(g);f.reads.length=0;
  assert.deepEqual(await f.list('uidA',{expectedPersonId:b}),{status:'forbidden'});assert.deepEqual(f.reads,[]);
  assert.equal((await f.list('uidA',{expectedPersonId:a})).status,'ok');
});
