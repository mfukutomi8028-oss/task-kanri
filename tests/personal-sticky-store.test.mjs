import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalStickyStore } from '../personal-sticky-store-v659.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(approved=true) {
 const auth={currentUser:null};
 let authListener=()=>{}, dataListener=()=>{}, dbError=()=>{};
 let counts={reads:0,writes:0,stops:0};
 const records=new Map();
 const firebase={
   ref:(_db,path)=>path,
   onAuthStateChanged:(_auth,fn)=>{authListener=fn;queueMicrotask(()=>fn(auth.currentUser));return ()=>{};},
   onValue:(path,fn,onError)=>{counts.reads++;dataListener=fn;dbError=onError;fn({val:()=>Object.fromEntries(records)});return ()=>{counts.stops++;};},
   runTransaction:async (path,updater)=>{
     counts.writes++;
     const id=path.split('/').at(-1);
     const next=updater(records.get(id)||null);
     if(next===undefined)return {committed:false,snapshot:{val:()=>records.get(id)||null}};
     if(next===null)records.delete(id); else records.set(id,next);
     dataListener({val:()=>Object.fromEntries(records)});
     return {committed:true,snapshot:{val:()=>next}};
   }
 };
 const store=createPersonalStickyStore({auth,database:{},roomId:'room_a',firebase,approvedMember:async()=>approved});
 return {store,auth,counts,records,
   login:async(uid='user_a')=>{auth.currentUser={uid};authListener(auth.currentUser);await flush();},
   logout:async()=>{auth.currentUser=null;authListener(null);await flush();},
   dbError:()=>dbError(new Error('permission-denied'))};
}
test('denies all commands without verified Auth, with no database subscription',async()=>{
 const h=harness();
 const res=await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'});
 assert.equal(res.error,'auth-required');
 assert.equal(h.counts.writes,0);
 assert.equal(h.counts.reads,0);
 h.store.destroy();
});
test('denies membership rejection and never subscribes',async()=>{
 const h=harness(false);await h.login();
 assert.equal(h.store.readSnapshot().status,'locked');
 assert.equal(h.counts.reads,0);
 h.store.destroy();
});
test('authenticated owner can create, edit and re-read',async()=>{
 const h=harness();await h.login();
 const create=await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'});
 assert.equal(create.ok,true);
 const res=await h.store.dispatch({type:'sticky.content',ownerRoom:'room_a',ownerUid:'user_a',
   id:create.id,expectedRevision:1,values:{text:'作業用付箋'}});
 assert.equal(res.ok,true);
 assert.equal(h.store.readSnapshot().notes[0].content.text,'作業用付箋');
 h.store.destroy();
});
test('wrong owner and stale content change are rejected',async()=>{
 const h=harness();await h.login();
 const created=await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'});
 assert.equal((await h.store.dispatch({type:'sticky.content',ownerRoom:'room_a',ownerUid:'user_b',id:created.id,
   expectedRevision:1,values:{text:'hack'}})).error,'auth-required');
 const cmd={type:'sticky.content',ownerRoom:'room_a',ownerUid:'user_a',id:created.id,
   expectedRevision:1,values:{text:'new'}};
 assert.equal((await h.store.dispatch(cmd)).ok,true);
 assert.equal((await h.store.dispatch(cmd)).error,'conflict');
 h.store.destroy();
});
test('signout clears personal content, unsubscribes and blocks subsequent writes',async()=>{
 const h=harness();await h.login();
 await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'});
 assert.equal(h.store.readSnapshot().notes.length,1);
 await h.logout();
 assert.equal(h.store.readSnapshot().notes.length,0);
 assert.equal(h.store.readSnapshot().ownerUid,'');
 assert.ok(h.counts.stops>=1);
 assert.equal((await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'})).ok,false);
 h.store.destroy();
});
test('rules error clears notes immediately instead of retaining stale data',async()=>{
 const h=harness();await h.login();
 await h.store.dispatch({type:'sticky.create',ownerRoom:'room_a',ownerUid:'user_a'});
 h.dbError();
 assert.equal(h.store.readSnapshot().status,'error');
 assert.equal(h.store.readSnapshot().notes.length,0);
 h.store.destroy();
});
