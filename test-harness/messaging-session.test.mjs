import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMessagingIdentity, createMessagingSession } from './messaging-preview/workspace-messaging-session.js';

const a = 'p_'+'a'.repeat(32), b = 'p_'+'b'.repeat(32);
const context = {uid:'uidA',roomId:'r',selectedDisplayName:'staff A'};
const binding = {uid:'uidA',roomId:'r',personId:a,displayName:'staff A',approved:true,active:true};
const locked = {status:'locked'};
const bound = {status:'bound',personId:a,roomId:'r'};
const bindingB = {...binding,uid:'uidB',personId:b,displayName:'staff B'};
const contextB = {roomId:'r',selectedDisplayName:'staff B'};
function deferred(){let resolve;let reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
function fixture(){
  let uid='uidA', authListener;const reads=[],watches=[];let locks=0,authClosed=false;
  const session=createMessagingSession({
    getAuthUid:()=>uid,
    readBinding(ctx){const d=deferred();reads.push({ctx,...d});return d.promise;},
    observeAuth(listener){authListener=listener;return ()=>{authClosed=true;};},
    observeBinding(ctx,onValue,onError){const watch={ctx,onValue,onError,closed:false};watches.push(watch);return ()=>{watch.closed=true;};},
    onLock(){locks++;}
  });
  return {session,reads,watches,changeUid(value){uid=value;authListener();},get locks(){return locks;},get authClosed(){return authClosed;}};
}

test('only a matching active and approved identity binding unlocks the UI',()=>{
  assert.deepEqual(resolveMessagingIdentity(context,binding),bound);
  for(const candidate of [null,{}, {...binding,approved:false},{...binding,active:false},{...binding,uid:'uidB'},{...binding,roomId:'other'},{...binding,personId:'staff A'},{...binding,displayName:'staff B'}]) {
    assert.deepEqual(resolveMessagingIdentity(context,candidate),locked);
  }
});
test('display label equality never makes another UID the same person',()=>{
  assert.deepEqual(resolveMessagingIdentity({...context,uid:'uidB'},binding),locked);
  assert.deepEqual(resolveMessagingIdentity({...context,selectedDisplayName:'Staff A'},binding),locked);
});
test('new sessions remain locked until the authoritative binding arrives',async()=>{
  const f=fixture();assert.deepEqual(f.session.getSnapshot(),locked);
  const ready=f.session.setContext(context);
  assert.deepEqual(f.session.getSnapshot(),locked);
  assert.deepEqual(f.reads[0].ctx,{uid:'uidA',roomId:'r',selectedDisplayName:'staff A'});
  f.reads[0].resolve(binding);await ready;
  assert.deepEqual(f.session.getSnapshot(),bound);f.session.dispose();
});
test('revoked live binding wins over a stale approved initial read',async()=>{
  const f=fixture();const ready=f.session.setContext(context);
  f.watches[0].onValue({...binding,active:false});f.reads[0].resolve(binding);await ready;
  assert.deepEqual(f.session.getSnapshot(),locked);f.session.dispose();
});
test('watch errors clear private state and cannot be undone by late callbacks',async()=>{
  const f=fixture();const ready=f.session.setContext(context);f.reads[0].resolve(binding);await ready;
  const before=f.locks;f.watches[0].onError(new Error('offline'));
  assert.deepEqual(f.session.getSnapshot(),locked);assert.ok(f.locks>before);assert.equal(f.watches[0].closed,true);
  f.watches[0].onValue(binding);assert.deepEqual(f.session.getSnapshot(),locked);f.session.dispose();
});
test('failed initial read cannot unlock until context is explicitly refreshed',async()=>{
  const f=fixture();const ready=f.session.setContext(context);f.reads[0].reject(new Error('offline'));await ready;
  assert.deepEqual(f.session.getSnapshot(),locked);assert.equal(f.watches[0].closed,true);
  f.watches[0].onValue(binding);assert.deepEqual(f.session.getSnapshot(),locked);f.session.dispose();
});
test('changing account and display user ignores old asynchronous reads and events',async()=>{
  const f=fixture();const old=f.session.setContext(context);f.changeUid('uidB');
  const next=f.session.setContext(contextB);assert.deepEqual(f.session.getSnapshot(),locked);
  assert.equal(f.watches[0].closed,true);const index=f.reads.length-1;
  f.reads[index].resolve(bindingB);await next;f.reads[0].resolve(binding);await old;
  f.watches[0].onValue(binding);assert.deepEqual(f.session.getSnapshot(),{status:'bound',personId:b,roomId:'r'});f.session.dispose();
});
test('sign-out immediately locks and unsubscribes, dispose ignores pending events',async()=>{
  const f=fixture();const seen=[];const off=f.session.subscribe(s=>seen.push(s));
  const ready=f.session.setContext(context);f.reads[0].resolve(binding);await ready;
  f.changeUid(null);assert.deepEqual(f.session.getSnapshot(),locked);assert.equal(f.watches[0].closed,true);
  f.watches[0].onValue(binding);assert.deepEqual(seen.at(-1),locked);
  off();f.session.dispose();assert.equal(f.authClosed,true);assert.deepEqual(f.session.getSnapshot(),locked);
});
test('a subscriber switching rooms cannot publish the previous identity to other subscribers',async()=>{
  const f=fixture();let switched=false;const later=[];
  f.session.subscribe(s=>{if(s.status==='bound'&&!switched){switched=true;void f.session.setContext({roomId:'other',selectedDisplayName:'staff A'});}});
  f.session.subscribe(s=>later.push(s));
  const ready=f.session.setContext(context);f.reads[0].resolve(binding);await ready;
  assert.deepEqual(f.session.getSnapshot(),locked);
  assert.equal(later.some(s=>s.status==='bound'&&s.roomId==='r'),false);
  f.session.dispose();
});
