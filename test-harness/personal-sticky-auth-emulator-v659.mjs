// Real Firebase Auth + Realtime Database SDK integration, demo Emulators ONLY.
// This test MUST never use production connections, users, data or credentials.
import assert from 'node:assert/strict';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator,
  signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, get, onValue, runTransaction } from 'firebase/database';
import * as sticky from '../personal-sticky-store-v659.js';

const authHost='127.0.0.1:9099', dbHost='127.0.0.1:9001';
const projectId='demo-task-kanri-sticky-v659';
const roomId='roomA';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost
  || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== dbHost
  || !projectId.startsWith('demo-')) {
  throw Error('DEMO EMULATORS REQUIRED: refusing live Auth/Database connections');
}
assert.equal(typeof sticky.createVerifiedPersonalStickyStore,'function',
  'a verified Auth UID -> authorized room membership connector is required');
const admin=initializeAdmin({
  projectId,
  databaseURL:'http://'+dbHost+'?ns='+projectId+'-default-rtdb'
},'sticky-v659-admin');
const clients=[];
const stores=[];
const firebase={ref,get,onValue,runTransaction,onAuthStateChanged};
function makeClient(label){
  const app=initializeClient({
    apiKey:'demo-only-sticky-key',projectId,
    authDomain:projectId+'.firebaseapp.com',
    databaseURL:'https://'+projectId+'-default-rtdb.firebaseio.com'
  },'sticky-v659-'+label);
  clients.push(app);
  const auth=initializeAuth(app,{persistence:inMemoryPersistence});
  connectAuthEmulator(auth,'http://'+authHost,{disableWarnings:true});
  const db=getDatabase(app);
  connectDatabaseEmulator(db,'127.0.0.1',9001);
  return {auth,db};
}
async function waitFor(label,check,timeoutMs=12000){
  const end=Date.now()+timeoutMs;
  while(Date.now()<end){
    if(check())return;
    await new Promise(resolve=>setTimeout(resolve,60));
  }
  throw Error('Timed out waiting for '+label);
}
const alice=makeClient('alice'),bob=makeClient('bob');
try{
  const credentials=[
    {uid:'alice',email:'alice@example.invalid',password:'Emulator-Only-A!659'},
    {uid:'bob',email:'bob@example.invalid',password:'Emulator-Only-B!659'}
  ];
  for(const user of credentials)await getAdminAuth(admin).createUser(user);
  await getAdminDatabase(admin).ref('roomsV2/'+roomId).set({
    access:{members:{alice:'editor',bob:'viewer'}},
    internal:{identities:{alice:{approved:true},bob:{approved:true}}},
    shared:{tasks:{example:{title:'架空の業務タスク'}}}
  });
  const authConfig={roomId,firebase,accessCheckIntervalMs:300};
  const aStore=sticky.createVerifiedPersonalStickyStore({
    auth:alice.auth,database:alice.db,...authConfig
  });
  const bStore=sticky.createVerifiedPersonalStickyStore({
    auth:bob.auth,database:bob.db,...authConfig
  });
  stores.push(aStore,bStore);
  const initial=await aStore.dispatch({type:'sticky.create',ownerRoom:roomId,ownerUid:'alice'});
  assert.deepEqual(initial,{ok:false,error:'auth-required'},'no anonymous writes');
  assert.deepEqual(aStore.readSnapshot().notes,[],'no anonymous reads');

  await signInWithEmailAndPassword(alice.auth,credentials[0].email,credentials[0].password);
  await waitFor('authorized Alice',()=>aStore.readSnapshot().status==='ready');
  const created=await aStore.dispatch({type:'sticky.create',ownerRoom:roomId,ownerUid:'alice'});
  assert.equal(created.ok,true,'the verified owner can create a private note');
  const content=await aStore.dispatch({type:'sticky.content',ownerRoom:roomId,ownerUid:'alice',
    id:created.id,expectedRevision:1,values:{text:'架空の日本語メモ'}});
  assert.equal(content.ok,true,'the verified owner can save content');
  assert.equal((await getAdminDatabase(admin).ref('roomsV2/'+roomId
    +'/personal/alice/stickyNotes/'+created.id+'/content/text').get()).val(),'架空の日本語メモ');
  await waitFor('visible Alice data',()=>aStore.readSnapshot().notes.length===1);

  await signInWithEmailAndPassword(bob.auth,credentials[1].email,credentials[1].password);
  await waitFor('authorized Bob',()=>bStore.readSnapshot().status==='ready');
  assert.equal(bStore.readSnapshot().notes.length,0,
    'another authenticated user must never see Alice notes in his snapshot');
  await assert.rejects(get(ref(bob.db,'roomsV2/'+roomId+'/personal/alice/stickyNotes')),
    'Bob must be denied direct reads of Alice notes by Firebase Rules');
  assert.equal((await bStore.dispatch({type:'sticky.content',ownerRoom:roomId,ownerUid:'alice',
    id:created.id,expectedRevision:2,values:{text:'侵入'}})).error,'auth-required');
  const bobOwn=await bStore.dispatch({type:'sticky.create',ownerRoom:roomId,ownerUid:'bob'});
  assert.equal(bobOwn.ok,true,'viewer may write only his personal sticky notes');

  // A revoked room role must clear previously visible data on the next
  // server-verified access recheck, even without a sign-out or tab reload.
  await getAdminDatabase(admin).ref('roomsV2/'+roomId+'/access/members/alice').remove();
  await waitFor('role revocation clears private notes',()=>{
    const snap=aStore.readSnapshot();
    return snap.status==='locked' && snap.notes.length===0 && snap.ownerUid==='';
  });
  assert.equal((await aStore.dispatch({type:'sticky.create',ownerRoom:roomId,ownerUid:'alice'})).error,
    'auth-required','revoked user cannot create');

  // Explicit approval revocation must also lock a user with a valid Auth token.
  await getAdminDatabase(admin).ref('roomsV2/'+roomId+'/internal/identities/bob/approved').set(false);
  await waitFor('approval revocation clears private notes',()=>{
    const snap=bStore.readSnapshot();
    return snap.status==='locked' && snap.notes.length===0;
  });
  assert.equal((await bStore.dispatch({type:'sticky.create',ownerRoom:roomId,ownerUid:'bob'})).error,
    'auth-required');

  await signOut(alice.auth);
  await signOut(bob.auth);
  assert.equal(aStore.readSnapshot().notes.length,0);
  assert.equal(bStore.readSnapshot().notes.length,0);
  console.log('STICKY_V659_REAL_AUTH_RTDATABASE_EMULATOR_PASSED: synthetic identities only');
}finally{
  for(const store of stores)store.destroy();
  for(const app of clients)await deleteClient(app);
  await deleteAdmin(admin);
}
