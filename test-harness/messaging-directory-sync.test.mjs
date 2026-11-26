import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingDirectorySync} from '../workspace-messaging-directory-sync.js';
const roomId='roomA',a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32);
const group=n=>'group_g_'+n.toString(16).padStart(32,'0');
const member=(id,patch={})=>({id,kind:'group',status:'active',title:'Project',role:'owner',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000,...patch});
const invite=id=>({conversationId:id,title:'Invite',invitedBy:b,invitedAt:1000,revision:1});
const bound=personId=>({status:'bound',roomId,personId});
const page=(conversations=[],invites=[],nextCursor=null,personId=a)=>({status:'ok',roomId,personId,conversations,invites,hasMore:nextCursor!==null,nextCursor});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(read){
  let identity=bound(a),listener,signal,error,stopped=0;const requests=[];
  const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
  const transport={async readDirectory(request){requests.push(request);return read(request,requests.length);}};
  assert.equal(typeof createMessagingDirectorySync,'function','directory synchronization must be implemented');
  const store=createMessagingDirectorySync({session,transport,observeChanges(scope,changed,failed){assert.equal(scope.roomId,roomId);signal=changed;error=failed;return ()=>{stopped++;};}});
  return {store,requests,get stopped(){return stopped;},change(next){identity=next;listener?.(next);},signal:()=>signal,error:()=>error};
}
test('loads authorized member and invite pages without exposing partial results or raw fields',async()=>{
  const f=fixture(({after})=>after===null?page([member(group(1),{secret:'not public'})],[],group(2)):page([],[invite(group(3))]));
  assert.equal(f.store.getSnapshot().status,'hidden');assert.equal(f.requests.length,0);
  f.store.setVisible(true);await tick();const result=f.store.getSnapshot();
  assert.equal(result.status,'ready');assert.equal(result.complete,true);assert.deepEqual(result.conversations,[member(group(1))]);assert.deepEqual(result.invites,[invite(group(3))]);
  assert.deepEqual(f.requests,[{roomId,after:null,limit:100},{roomId,after:group(2),limit:100}]);assert.ok(Object.isFrozen(result.conversations[0]));f.store.dispose();
});
test('a superseded request cannot publish another persons conversations',async()=>{
  let release;const old=new Promise(resolve=>{release=resolve;});const f=fixture((_,n)=>n===1?old:page([member(group(2))],[],null,b));
  f.store.setVisible(true);await tick();const previousSignal=f.signal();f.change(bound(b));await tick();
  release(page([member(group(1))]));previousSignal();await tick();
  assert.equal(f.store.getSnapshot().personId,b);assert.deepEqual(f.store.getSnapshot().conversations.map(x=>x.id),[group(2)]);assert.equal(f.requests.length,2);assert.equal(f.stopped,1);f.store.dispose();
});
test('change bursts coalesce into one refresh and suppress superseded pages',async()=>{
  let release;const first=new Promise(resolve=>{release=resolve;});const f=fixture((_,n)=>n===1?first:page([member(group(2))]));const seen=[];f.store.subscribe(s=>{if(s.status==='ready')seen.push(s.conversations.map(x=>x.id));});
  f.store.setVisible(true);await tick();f.signal()();f.signal()();f.signal()();release(page([member(group(1))]));await tick();
  assert.equal(f.requests.length,2);assert.deepEqual(seen,[[group(2)]]);f.store.dispose();
});
test('observer failure and hidden state purge data and ignore late signals',async()=>{
  const f=fixture(()=>page([member(group(1))]));f.store.setVisible(true);await tick();const oldSignal=f.signal();f.error()();
  assert.equal(f.store.getSnapshot().status,'unavailable');assert.deepEqual(f.store.getSnapshot().conversations,[]);oldSignal();await tick();assert.equal(f.requests.length,1);
  f.store.setVisible(false);assert.equal(f.store.getSnapshot().status,'hidden');assert.equal(f.stopped,1);f.store.dispose();
});
test('denied or malformed subsequent page clears the entire directory',async()=>{
  for(const second of [{status:'forbidden'},page([member(group(1))]),page([],[invite(group(3))],group(2)),page([],[],null,b)]){
    const f=fixture(({after})=>after===null?page([member(group(1))],[],group(2)):second);f.store.setVisible(true);await tick();
    const snapshot=f.store.getSnapshot();assert.equal(snapshot.status,second.status==='forbidden'?'locked':'unavailable');assert.deepEqual(snapshot.conversations,[]);assert.deepEqual(snapshot.invites,[]);f.store.dispose();
  }
});
test('bounded page budget cannot claim a complete directory',async()=>{
  const f=fixture((_,n)=>page([member(group(n))],[],group(n)));f.store.setVisible(true);await tick();const s=f.store.getSnapshot();
  assert.equal(f.requests.length,10);assert.equal(s.status,'ready');assert.equal(s.complete,false);assert.equal(s.conversations.length,10);f.store.dispose();
});
test('hidden view cancels pending work and does not resubscribe until visible',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});const f=fixture(()=>pending);f.store.setVisible(true);await tick();const oldSignal=f.signal();f.store.setVisible(false);release(page([member(group(1))]));oldSignal();await tick();
  assert.equal(f.store.getSnapshot().status,'hidden');assert.deepEqual(f.store.getSnapshot().conversations,[]);assert.equal(f.requests.length,1);assert.equal(f.stopped,1);f.store.dispose();
});
