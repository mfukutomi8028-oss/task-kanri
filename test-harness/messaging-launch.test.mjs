import test from 'node:test';
import assert from 'node:assert/strict';
import * as launch from '../origin-messaging-launcher.js';
const endpoint='https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging';
const config={enabled:true,endpoint,attachmentsEnabled:false};
const snapshot={roomId:'roomA',currentUser:'Alice',connectionMode:'remote-online'};
function fixture({configuration=config,connect}={}){
  let board={...snapshot}; const calls=[];
  const handle={dispose(){calls.push('dispose');}};
  const controller=launch.createOriginMessagingLauncher({readConfig:()=>configuration,readBoard:()=>board,connect:connect??(async()=>{calls.push('connect');return {auth:{},sdk:{}};}),mount:()=>{calls.push('mount');return handle;}});
  return {controller,calls,handle,board:patch=>{board={...board,...patch};}};
}
test('disabled and untrusted endpoints do not initialize authentication',async()=>{
 for(const configuration of [null,{...config,enabled:false},{...config,endpoint:'https://other.example.test/functions/v1/workboard-messaging'},{...config,endpoint:endpoint+'?token=foo'},{...config,endpoint:endpoint+'/extra'}]){const f=fixture({configuration});assert.equal((await f.controller.open()).status,'disabled');assert.deepEqual(f.calls,[]);}
});
test('no cloud auth starts while legacy data is offline',async()=>{const f=fixture();f.board({connectionMode:'local-only'});assert.equal((await f.controller.open()).status,'unavailable');assert.deepEqual(f.calls,[]);});
test('concurrent open coalesces, close disposes, and reopen mounts once',async()=>{const f=fixture();const a=f.controller.open(),b=f.controller.open();assert.equal(a,b);assert.equal((await a).status,'opened');assert.deepEqual(f.calls,['connect','mount']);assert.equal((await f.controller.open()).status,'opened');f.controller.close();assert.deepEqual(f.calls,['connect','mount','dispose']);await f.controller.open();assert.deepEqual(f.calls,['connect','mount','dispose','connect','mount']);});
test('late auth result after close or a board identity change cannot mount',async()=>{for(const close of [true,false]){let release;const f=fixture({connect:()=>new Promise(r=>release=r)});const opening=f.controller.open();await Promise.resolve();if(close)f.controller.close();else f.board({currentUser:'Bob'});release({});assert.equal((await opening).status,'cancelled');assert.deepEqual(f.calls,[]);}});
test('a connection failure is retryable and never mounts',async()=>{let fail=true;const f=fixture({connect:async()=>{if(fail)throw Error('secret');return {};}});assert.deepEqual(await f.controller.open(),{status:'unavailable'});assert.deepEqual(f.calls,[]);fail=false;assert.equal((await f.controller.open()).status,'opened');});
test('auth waits for restoration and does not replace an existing user',async()=>{let calls=[];const user={uid:'existing',getIdToken:async()=> 'existing-token'};const app={},auth={currentUser:null,async authStateReady(){calls.push('ready');this.currentUser=user;}};const sdk={getAuth:arg=>{assert.equal(arg,app);return auth;},signInAnonymously:async()=>{calls.push('new');throw Error('unexpected sign in');},onAuthStateChanged:(a,cb)=>{assert.equal(a,auth);cb(user);return ()=>{};}};const adapter=await launch.connectFirebaseMessagingAuth({app,authSdk:sdk});assert.deepEqual(calls,['ready']);assert.equal(adapter.getUid(),'existing');assert.equal(await adapter.getToken(),'existing-token');});
test('first use creates anonymous identity only after restoration and stale token is discarded',async()=>{let resolveToken,calls=[];const user={uid:'anon',getIdToken:()=>new Promise(r=>resolveToken=r)};const app={},auth={currentUser:null,async authStateReady(){calls.push('ready');}};const sdk={getAuth:()=>auth,async signInAnonymously(a){calls.push('sign-in');a.currentUser=user;return {user};},onAuthStateChanged:()=>()=>{}};const adapter=await launch.connectFirebaseMessagingAuth({app,authSdk:sdk});assert.deepEqual(calls,['ready','sign-in']);assert.equal(adapter.getUid(),'anon');const token=adapter.getToken();auth.currentUser={uid:'different'};resolveToken('old');assert.equal(await token,null);});
