import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardPersonalStickyStore, userKeyFromDisplayName } from '../personal-sticky-store-v659.js';

function memoryStorage() {
  const records=new Map();
  return {
    getItem:key=>records.get(key)??null,
    setItem:(key,value)=>records.set(key,String(value)),
    removeItem:key=>records.delete(key),
    size:()=>records.size
  };
}
function fakeRealtimeDatabase() {
  const records=new Map(),listeners=new Map();
  let writes=0;
  const clone=v=>v==null?null:structuredClone(v);
  const notify=path=>{
    for(const [target,fns] of listeners) {
      if(!path.startsWith(target+'/')&&path!==target)continue;
      const prefix=target+'/';
      const result=Object.fromEntries([...records].filter(([key])=>key.startsWith(prefix)&&!key.slice(prefix.length).includes('/'))
        .map(([key,v])=>[key.slice(prefix.length),clone(v)]));
      for(const fn of fns)fn({val:()=>clone(result)});
    }
  };
  const db={};
  const firebase={
    ref:(_db,path)=>path,
    onValue:(target,fn)=>{
      if(!listeners.has(target))listeners.set(target,new Set());
      listeners.get(target).add(fn);
      const prefix=target+'/';
      const values=Object.fromEntries([...records].filter(([key])=>key.startsWith(prefix)&&!key.slice(prefix.length).includes('/'))
        .map(([key,value])=>[key.slice(prefix.length),clone(value)]));
      fn({val:()=>clone(values)});
      return()=>listeners.get(target)?.delete(fn);
    },
    runTransaction:async(path,update)=>{
      writes++;
      const next=update(clone(records.get(path)));
      if(next===undefined)return {committed:false,snapshot:{val:()=>clone(records.get(path))}};
      if(next===null)records.delete(path);else records.set(path,clone(next));
      notify(path);
      return {committed:true,snapshot:{val:()=>clone(next)}};
    }
  };
  return {db,firebase,records,writes:()=>writes,notify};
}
const roomId='test-room';
const local=storage=>createBoardPersonalStickyStore({roomId,storage});
const connectLocal=(store,user)=>store.setContext({user,mode:'local-only'});
const connectRemote=(store,user,db,firebase)=>store.setContext({user,mode:'remote-online',database:db,firebase});
function ownerCommand(store,type,rest={}) {
  const {ownerUid,ownerRoom}=store.readSnapshot();
  return {type,ownerUid,ownerRoom,...rest};
}

test('user name is only a stable display partition, never an authentication identity',()=>{
  assert.equal(userKeyFromDisplayName(' Ａ さん '),userKeyFromDisplayName('Aさん'));
  assert.notEqual(userKeyFromDisplayName('Aさん'),userKeyFromDisplayName('Bさん'));
  assert.match(userKeyFromDisplayName('福冨'),/^[A-Za-z0-9_-]{1,128}$/);
  assert.equal(userKeyFromDisplayName(''), '');
});

test('local-only notes are editable, persist across reload, and follow selected user',async()=>{
  const storage=memoryStorage(),a=local(storage);
  connectLocal(a,'福冨');
  assert.equal(a.readSnapshot().status,'ready');
  const created=await a.dispatch(ownerCommand(a,'sticky.create'));
  assert.equal(created.ok,true);
  assert.equal((await a.dispatch(ownerCommand(a,'sticky.content',{
    id:created.id,expectedRevision:1,values:{text:'次の院内会議の準備'}
  }))).ok,true);
  assert.equal(a.readSnapshot().notes[0].content.text,'次の院内会議の準備');
  connectLocal(a,'森井');
  assert.equal(a.readSnapshot().notes.length,0);
  connectLocal(a,'福冨');
  assert.equal(a.readSnapshot().notes[0].content.text,'次の院内会議の準備');
  a.destroy();
  const reloaded=local(storage);connectLocal(reloaded,'福冨');
  assert.equal(reloaded.readSnapshot().notes[0].content.text,'次の院内会議の準備');
  reloaded.destroy();
});

test('same display name synchronizes across clients; a different name is displayed separately',async()=>{
  const {db,firebase,records}=fakeRealtimeDatabase();
  const a=createBoardPersonalStickyStore({roomId}), b=createBoardPersonalStickyStore({roomId});
  connectRemote(a,'福冨',db,firebase);
  connectRemote(b,'福冨',db,firebase);
  const item=await a.dispatch(ownerCommand(a,'sticky.create'));
  assert.equal(item.ok,true);
  assert.equal((await a.dispatch(ownerCommand(a,'sticky.content',{
    id:item.id,expectedRevision:1,values:{text:'共有される付箋'}
  }))).ok,true);
  assert.equal(b.readSnapshot().notes[0].content.text,'共有される付箋');
  assert.ok([...records.keys()].every(path=>path.startsWith('rooms/test-room/personalStickyNotes/')));
  connectRemote(b,'森井',db,firebase);
  assert.equal(b.readSnapshot().notes.length,0);
  assert.equal((await b.dispatch(ownerCommand(a,'sticky.create'))).ok,false,
    'stale user command must not write into a different selected partition');
  a.destroy();b.destroy();
});

test('concurrent edits reject stale revisions and mobile moves retain canvas coordinates',async()=>{
  const {db,firebase}=fakeRealtimeDatabase(),a=createBoardPersonalStickyStore({roomId});
  connectRemote(a,'福冨',db,firebase);
  const n1=await a.dispatch(ownerCommand(a,'sticky.create'));
  const n2=await a.dispatch(ownerCommand(a,'sticky.create'));
  assert.equal(n1.ok,true);assert.equal(n2.ok,true);
  assert.notDeepEqual([n1.note.layout.x,n1.note.layout.y],[n2.note.layout.x,n2.note.layout.y]);
  const command=ownerCommand(a,'sticky.content',{id:n1.id,expectedRevision:1,values:{text:'最初の変更'}});
  assert.equal((await a.dispatch(command)).ok,true);
  assert.equal((await a.dispatch(command)).error,'conflict');
  const moved=await a.dispatch(ownerCommand(a,'sticky.mobileMove',{id:n2.id,direction:'up'}));
  assert.equal(moved.ok,true);
  assert.ok(moved.note.mobile.order<n1.note.mobile.order);
  assert.equal(moved.note.layout.x,n2.note.layout.x);
  a.destroy();
});

test('connection degradation forbids writes without silently creating a second local copy',async()=>{
  const storage=memoryStorage(),{db,firebase}=fakeRealtimeDatabase(),a=local(storage);
  connectRemote(a,'福冨',db,firebase);
  const item=await a.dispatch(ownerCommand(a,'sticky.create'));
  assert.equal(item.ok,true);
  a.setContext({user:'福冨',mode:'remote-degraded',database:db,firebase});
  assert.equal(a.readSnapshot().status,'error');
  assert.equal(a.readSnapshot().notes.length,0);
  const result=await a.dispatch(ownerCommand(a,'sticky.create'));
  assert.equal(result.ok,false);
  assert.equal(storage.size(),0,'remote failures must not copy notes into browser storage');
  a.destroy();
});

test('login-free store accepts existing Japanese room names without breaking app startup',async()=>{
 const s=createBoardPersonalStickyStore({roomId:'病院業務 2026',storage:memoryStorage()});
 s.setContext({user:'福冨',mode:'local-only'});
 assert.equal(s.readSnapshot().status,'ready');
 const result=await s.dispatch({type:'sticky.create',ownerUid:s.readSnapshot().ownerUid,ownerRoom:'病院業務 2026'});
 assert.equal(result.ok,true);
 s.destroy();
});


test('create and move notes across five synced pages without changing legacy contents',async()=>{
 const storage=memoryStorage(),store=local(storage);
 connectLocal(store,'福冨');
 const legacy=await store.dispatch(ownerCommand(store,'sticky.create'));
 const third=await store.dispatch(ownerCommand(store,'sticky.create',{page:3}));
 assert.equal(legacy.ok,true);assert.equal(third.ok,true);
 assert.equal(legacy.note.layout.page,1);
 assert.equal(third.note.layout.page,3);
 assert.deepEqual([legacy.note.layout.x,legacy.note.layout.y],[third.note.layout.x,third.note.layout.y]);
 assert.equal((await store.dispatch(ownerCommand(store,'sticky.layout',{
   id:legacy.id,expectedRevision:1,values:{page:5}
 }))).ok,true);
 assert.equal(store.readSnapshot().notes.find(x=>x.id===legacy.id).layout.page,5);
 assert.equal((await store.dispatch(ownerCommand(store,'sticky.create',{page:0}))).ok,false);
 store.destroy();
});
