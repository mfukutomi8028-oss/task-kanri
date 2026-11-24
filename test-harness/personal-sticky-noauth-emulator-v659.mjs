// Real Realtime Database SDK integration using synthetic data and the DB emulator only.
// No Firebase Auth user is created or required; no production data or URLs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initializeApp,deleteApp} from 'firebase/app';
import {getDatabase,connectDatabaseEmulator,ref,onValue,runTransaction,get,set} from 'firebase/database';
import {createBoardPersonalStickyStore} from '../personal-sticky-store-v659.js';

const projectId='demo-task-kanri';
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if(host!=='127.0.0.1:9000'||!projectId.startsWith('demo-')){
  throw Error('Database emulator required: refusing to use a production endpoint');
}
const opts={apiKey:'demo-not-a-key',projectId,databaseURL:'https://demo-task-kanri-default-rtdb.firebaseio.com'};
const aApp=initializeApp(opts,'sticky-noauth-a-v659');
const bApp=initializeApp(opts,'sticky-noauth-b-v659');
const aDb=getDatabase(aApp),bDb=getDatabase(bApp);
connectDatabaseEmulator(aDb,'127.0.0.1',9000);
connectDatabaseEmulator(bDb,'127.0.0.1',9000);
const roomId='test-sticky-v659';
const path='rooms/'+roomId;
const sdk={ref,onValue,runTransaction};
const alice=createBoardPersonalStickyStore({roomId});
const secondDevice=createBoardPersonalStickyStore({roomId});
async function waitFor(label,fn,timeoutMs=16000){
 const start=Date.now();
 while(Date.now()-start<timeoutMs){
   if(fn())return;
   await new Promise(resolve=>setTimeout(resolve,60));
 }
 throw new Error('Timeout waiting for '+label);
}
try{
  await set(ref(aDb,path+'/personalStickyNotes'),null);
  await set(ref(aDb,path+'/tasks/untouched'),{title:'従来の架空タスク'});
  const aa={user:'福冨',mode:'remote-online',database:aDb,firebase:sdk};
  const bb={user:'福冨',mode:'remote-online',database:bDb,firebase:sdk};
  alice.setContext(aa);secondDevice.setContext(bb);
  await waitFor('both devices ready',()=>alice.readSnapshot().status==='ready'
    && secondDevice.readSnapshot().status==='ready');
  const ctx=()=>({ownerRoom:roomId,ownerUid:alice.readSnapshot().ownerUid});
  const created=await alice.dispatch({type:'sticky.create',...ctx()});
  assert.equal(created.ok,true,'create without sign-in');
  assert.equal((await alice.dispatch({type:'sticky.content',...ctx(),id:created.id,
    expectedRevision:1,values:{text:'架空の業務付箋'}})).ok,true);
  await waitFor('second device sees same note',()=>secondDevice.readSnapshot().notes[0]?.content.text==='架空の業務付箋');
  const text='架空の業務付箋';
  const format={text,runs:[{start:0,end:2,flags:1,color:'red'}]};
  const formatted=await alice.dispatch({type:'sticky.content',...ctx(),id:created.id,
    expectedRevision:2,values:{text,format}});
  assert.equal(formatted.ok,true,'formatted content uses the existing transaction');
  await waitFor('format sync with matching canonical content revision',()=>{
    const content=secondDevice.readSnapshot().notes[0]?.content;
    return content?.revision===3 && content?.text===text && content?.format?.runs?.[0]?.flags===1;
  });
  const savedFormat=secondDevice.readSnapshot().notes[0].content.format;
  assert.deepEqual(savedFormat,{revision:3,runs:format.runs});
  const stale=await secondDevice.dispatch({type:'sticky.content',...ctx(),id:created.id,
    expectedRevision:2,values:{text:'競合する編集'}});
  assert.equal(stale.error,'conflict','format-only edit also advances the content revision');
  const legacyWrite=await secondDevice.dispatch({type:'sticky.content',...ctx(),id:created.id,
    expectedRevision:3,values:{text:'別の架空の業務付箋'}});
  assert.equal(legacyWrite.ok,true);
  await waitFor('an unformatted edit clears stale ranges on the other device',()=>{
    const content=alice.readSnapshot().notes[0]?.content;
    return content?.revision===4 && content?.text==='別の架空の業務付箋' && !('format' in content);
  });
  secondDevice.setContext({...bb,user:'森井'});
  await waitFor('different selected user has different display',()=>
    secondDevice.readSnapshot().status==='ready'&&secondDevice.readSnapshot().notes.length===0);
  const alternate=await secondDevice.dispatch({
    type:'sticky.create',ownerRoom:roomId,ownerUid:secondDevice.readSnapshot().ownerUid
  });
  assert.equal(alternate.ok,true);
  secondDevice.setContext(bb);
  await waitFor('switching back shows original note',()=>
    secondDevice.readSnapshot().notes.some(note=>note.id===created.id));
  assert.equal((await get(ref(aDb,path+'/tasks/untouched'))).val().title,
    '従来の架空タスク','sticky writes cannot change existing tasks');
  const original=alice.readSnapshot().notes[0];
  const deleted=await alice.dispatch({type:'sticky.delete',...ctx(),id:created.id,
    expectedRevisions:{
      content:original.content.revision,appearance:original.appearance.revision,
      layout:original.layout.revision,mobile:original.mobile.revision
    }
  });
  assert.equal(deleted.ok,true);
  await waitFor('deleted note disappears remotely',()=>secondDevice.readSnapshot().notes.length===0);
  // Page metadata remains in the same login-free shared collection.
  const page3=await alice.dispatch({type:'sticky.create',...ctx(),page:3});
  assert.equal(page3.ok,true);
  await waitFor('page 3 sync',()=>secondDevice.readSnapshot().notes.some(note=>
    note.id===page3.id&&note.layout.page===3));
  const moved=await alice.dispatch({type:'sticky.layout',...ctx(),id:page3.id,
    expectedRevision:page3.note.layout.revision,values:{page:5}});
  assert.equal(moved.ok,true);
  await waitFor('page move sync',()=>secondDevice.readSnapshot().notes.some(note=>
    note.id===page3.id&&note.layout.page===5));
  // Exercise the existing memo CAS writer against the same isolated emulator.
  // Check the independent client observes both fields together and an old
  // revision cannot replace the data just committed.
  const memoHost={};
  runInNewContext(readFileSync(new URL('../workspace-memo-v539.js',import.meta.url),'utf8'),{window:memoHost});
  const canonicalMemo=memoHost.WorkBoardMemoPersistenceV539.create({
    getFeatureState:()=>({roomId,db:aDb,online:true,memos:{}}),
    ensureFirebase:async()=>{},
    firebaseModules:sdk,
    finiteRevision:value=>Number.isSafeInteger(value)&&value>=0?value:0,
    persistLocalMemos:()=>{},
    renderMemoView:()=>{}
  });
  const memoId='memo-format-roundtrip-v671',memoBody='締切と期限';
  const codec=globalThis.WorkBoardNoteTextFormatV671;
  const memoFormat=codec.apply(memoBody,null,0,2,{flags:1,color:'red',size:'large'});
  const memo={id:memoId,title:'架空の業務メモ',body:memoBody,bodyFormat:memoFormat};
  const memoRef=ref(bDb,path+'/businessMemos/'+memoId);
  assert.equal(await canonicalMemo.commit(memo,0),true);
  const reader=(await get(memoRef)).val();
  assert.equal(reader.body,memoBody);
  assert.equal(reader.revision,1);
  assert.deepEqual(codec.read(reader.body,reader.bodyFormat),memoFormat.runs);
  assert.equal(await canonicalMemo.commit({...memo,body:'古いフォームの本文'},0),false);
  assert.deepEqual((await get(memoRef)).val().bodyFormat,reader.bodyFormat);
  await set(ref(bDb,path+'/businessMemos/'+memoId+'/body'),'他の端末が本文を変更');
  const legacy=(await get(memoRef)).val();
  assert.deepEqual(codec.read(legacy.body,legacy.bodyFormat),[], 'stale markers cannot style other text');
  console.log('MEMO_V671_FORMAT_REALTIME_ROUNDTRIP_PASSED: synthetic room only');
  console.log('STICKY_V659_LOGIN_FREE_REALTIME_SYNC_PASSED: synthetic rooms only');
}finally{
  alice.destroy();secondDevice.destroy();
  await set(ref(aDb,path),null);
  await deleteApp(aApp);await deleteApp(bApp);
}
