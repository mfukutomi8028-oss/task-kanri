// Exercise the record-origin service with the real Firebase Admin Auth + RTDB SDK
// in the isolated demo project. Never run this against a production project.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase,ServerValue} from 'firebase-admin/database';
import {createFirebaseMessagingRecordOriginService,isIssuedRecordId,RECORD_ORIGIN_OPEN_MAX,RECORD_ORIGIN_TTL_MS} from '../security/messaging-record-origin-service.mjs';

const projectId='demo-task-kanri-messaging',authHost='127.0.0.1:9098',dbHost='127.0.0.1:9002';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost||process.env.FIREBASE_DATABASE_EMULATOR_HOST!==dbHost)throw new Error('Record origin test requires both isolated loopback emulators');
const app=initializeApp({projectId,databaseURL:'https://'+projectId+'.firebaseio.com'},'messaging-record-origin-demo');
try{
  const auth=getAuth(app),db=getDatabase(app);
  let now=Date.now();
  const service=createFirebaseMessagingRecordOriginService({auth,database:db,serverTimestamp:ServerValue.TIMESTAMP,clock:()=>now});
  await db.ref('messagingControlV1/enabled').set(true);
  async function account(){
    const response=await fetch('http://'+authHost+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
    assert.equal(response.ok,true);return response.json();
  }
  const alice=await account(),aliceNew=await account(),bob=await account(),pending=await account(),carol=await account();
  const p='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),c3='p_'+'c'.repeat(32),room='roomOrigin';
  const group='group_g_'+'e'.repeat(32),otherGroup='group_g_'+'f'.repeat(32);
  const root='messagingV1/'+room,access='messagingAccessV1/'+room,control=root+'/control/'+group;
  const binding=(user,personId,approved=true)=>({uid:user.localId,roomId:room,personId,displayName:'Synthetic',approved,active:true});
  const msg=i=>'msg_'+p+'_q_'+i.toString(16).padStart(32,'0');
  const rid=i=>'q_'+i.toString(16).padStart(32,'0');
  await db.ref(access).set({[alice.localId]:binding(alice,p),[aliceNew.localId]:binding(aliceNew,p),[bob.localId]:binding(bob,other),[pending.localId]:binding(pending,p,false),[carol.localId]:binding(carol,c3)});
  await db.ref(root).set({
    control:{[group]:{kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1000,role:'member'},[c3]:{active:true,joinedAt:1000,role:'member'}}},
      [otherGroup]:{kind:'group',status:'active',members:{[other]:{active:true,joinedAt:1000,role:'member'}}}},
    messages:{[group]:{[msg(1)]:{senderId:p,createdAt:1500,revision:1,body:'Synthetic'},[msg(2)]:{senderId:p,createdAt:900,revision:1,body:'Before join'},[msg(3)]:{senderId:p,createdAt:1600,revision:1,deletedAt:1700}},
      [otherGroup]:{[msg(4)]:{senderId:other,createdAt:1500,revision:1,body:'Elsewhere'}}}
  });
  await db.ref('rooms/'+room+'/tasks/task-existing').set({title:'Existing synthetic task',createdBy:'Synthetic'});
  const base={token:alice.idToken,expectedPersonId:p,roomId:room,conversationId:group,messageId:msg(1)};
  const linksOf=async type=>Object.keys((await db.ref(root+'/recordLinks/'+type).get()).val()||{});

  // A single task: fresh issued id, link written by the server only for it.
  const task=await service.reserve({...base,requestId:rid(1),recordType:'task',count:1});
  assert.equal(task.status,'ok');assert.equal(task.ids.length,1);assert.equal(isIssuedRecordId(task.ids[0]),true);
  const stored=(await db.ref(root+'/recordLinks/task/'+task.ids[0]).get()).val();
  assert.equal(stored.conversationId,group);assert.equal(stored.messageId,msg(1));assert.equal(stored.createdBy,p);assert.equal(typeof stored.createdAt,'number');
  // An unrelated existing record can never be named: there is no such field.
  assert.deepEqual(await service.reserve({...base,requestId:rid(2),recordType:'task',count:1,recordId:'task-existing'}),{status:'invalid'});
  assert.deepEqual(await service.reserve({...base,requestId:rid(2),recordType:'task',count:1,ids:['task-existing']}),{status:'invalid'});
  assert.equal((await linksOf('task')).includes('task-existing'),false);
  // Retries (an unknown save result) return the same ids and write nothing new,
  // also from the same person's new device (UID change keeps the personId).
  const linkCount=(await linksOf('task')).length;
  assert.deepEqual(await service.reserve({...base,requestId:rid(1),recordType:'task',count:1}),task);
  assert.deepEqual(await service.reserve({...base,token:aliceNew.idToken,requestId:rid(1),recordType:'task',count:1}),task);
  assert.equal((await linksOf('task')).length,linkCount);
  // The same request id cannot be reused for another message, type or count.
  assert.deepEqual(await service.reserve({...base,requestId:rid(1),recordType:'schedule',count:1}),{status:'conflict'});
  // Single schedule and a multi-day batch: one link per issued id.
  const single=await service.reserve({...base,requestId:rid(3),recordType:'schedule',count:1});
  const batch=await service.reserve({...base,requestId:rid(4),recordType:'schedule',count:3});
  assert.equal(single.status,'ok');assert.equal(batch.ids.length,3);
  const scheduleLinks=await linksOf('schedule');
  for(const id of [...single.ids,...batch.ids])assert.equal(scheduleLinks.includes(id),true);
  const large=await service.reserve({...base,requestId:rid(5),recordType:'schedule',count:200});
  assert.equal(large.status,'ok');assert.equal(new Set(large.ids).size,200);
  for(const bad of [{recordType:'schedule',count:201},{recordType:'task',count:2},{recordType:'memo',count:1},{recordType:'task',count:0}])
    assert.deepEqual(await service.reserve({...base,requestId:rid(6),...bad}),{status:'invalid'});
  // Concurrent retries of one request agree on one set of ids.
  const parallel=await Promise.all(Array.from({length:5},()=>service.reserve({...base,requestId:rid(7),recordType:'schedule',count:2})));
  assert.equal(parallel.every(r=>r.status==='ok'&&JSON.stringify(r.ids)===JSON.stringify(parallel[0].ids)),true);
  const entry=(await db.ref(root+'/recordOrigins/'+p+'/'+rid(7)).get()).val();
  assert.deepEqual(entry.ids,parallel[0].ids);
  // Authorization: non-member, unapproved device, wrong person, pre-join,
  // deleted and foreign messages are refused and issue nothing.
  const before=(await linksOf('task')).length;
  for(const request of [
    {...base,token:bob.idToken,expectedPersonId:other},
    {...base,token:pending.idToken},
    {...base,expectedPersonId:other},
    {...base,messageId:msg(2)},
    {...base,messageId:msg(3)},
    {...base,messageId:msg(9)},
    {...base,conversationId:otherGroup,messageId:msg(4)},
    {...base,token:'not-a-token'}
  ])assert.deepEqual(await service.reserve({...request,requestId:rid(8),recordType:'task',count:1}),{status:'forbidden'});
  assert.equal((await linksOf('task')).length,before);
  // Leaving, rejoining after the message, device revocation and emergency-free
  // retries: no new ids, and a retry of an old request is refused too.
  await db.ref(control+'/members/'+p+'/active').set(false);
  assert.deepEqual(await service.reserve({...base,requestId:rid(1),recordType:'task',count:1}),{status:'forbidden'});
  await db.ref(control+'/members/'+p).set({active:true,joinedAt:1550,role:'member'});
  assert.deepEqual(await service.reserve({...base,requestId:rid(9),recordType:'task',count:1}),{status:'forbidden'});
  await db.ref(control+'/members/'+p).set({active:true,joinedAt:1000,role:'member'});
  await db.ref(access+'/'+alice.localId+'/active').set(false);
  assert.deepEqual(await service.reserve({...base,requestId:rid(1),recordType:'task',count:1}),{status:'forbidden'});
  await db.ref(access+'/'+alice.localId+'/active').set(true);
  // Another member (carol) keeps her own reservations; alice's are not shared.
  const carolTask=await service.reserve({...base,token:carol.idToken,expectedPersonId:c3,requestId:rid(1),recordType:'task',count:1});
  assert.equal(carolTask.status,'ok');assert.notDeepEqual(carolTask.ids,task.ids);
  // At most RECORD_ORIGIN_OPEN_MAX live reservations per person; expired ones are pruned.
  const open=Object.keys((await db.ref(root+'/recordOrigins/'+p).get()).val()).length;
  for(let i=0;i<RECORD_ORIGIN_OPEN_MAX-open;i++)assert.equal((await service.reserve({...base,requestId:rid(100+i),recordType:'task',count:1})).status,'ok');
  assert.deepEqual(await service.reserve({...base,requestId:rid(999),recordType:'task',count:1}),{status:'full'});
  now+=RECORD_ORIGIN_TTL_MS+1;
  const afterExpiry=await service.reserve({...base,requestId:rid(999),recordType:'task',count:1});
  assert.equal(afterExpiry.status,'ok');
  assert.deepEqual(Object.keys((await db.ref(root+'/recordOrigins/'+p).get()).val()),[rid(999)]);
  console.log('MESSAGING_RECORD_ORIGIN_EMULATOR_OK');
}finally{await deleteApp(app);}
