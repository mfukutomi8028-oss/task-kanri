// Exercise the real Firebase Admin Auth + RTDB SDK in the isolated demo project.
// Never run this script against a production project or production credential.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createFirebaseMessagingHistoryService} from '../security/messaging-history-service.mjs';

const projectId='demo-task-kanri-messaging',authHost='127.0.0.1:9098',dbHost='127.0.0.1:9002';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost||process.env.FIREBASE_DATABASE_EMULATOR_HOST!==dbHost){
  throw new Error('History test requires both isolated loopback emulators');
}
const app=initializeApp({projectId,databaseURL:'https://'+projectId+'.firebaseio.com'},'messaging-history-demo');
try{
  const auth=getAuth(app),db=getDatabase(app),service=createFirebaseMessagingHistoryService({auth,database:db});
  async function anonymousAccount(){
    const response=await fetch('http://'+authHost+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})
    });
    assert.equal(response.ok,true);
    const data=await response.json();assert.equal(typeof data.localId,'string');assert.equal(typeof data.idToken,'string');return data;
  }
  const alice=await anonymousAccount(),bob=await anonymousAccount(),unknown=await anonymousAccount();
  const p='p_'+'a'.repeat(32),other='p_'+'b'.repeat(32),group='group_g_'+'c'.repeat(32),room='roomHistory';
  const root='messagingV1/'+room,access='messagingAccessV1/'+room,control=root+'/control/'+group;
  const binding=(user,personId,approved=true)=>({uid:user.localId,roomId:room,personId,displayName:'Synthetic',approved,active:true});
  const msgId=i=>'msg_'+p+'_q_'+i.toString(16).padStart(32,'0');
  const messages={};
  for(let i=0;i<57;i++)messages[msgId(i)]={senderId:p,createdAt:i<=1?1000:1050,revision:1,body:'Synthetic message '+i};
  messages[msgId(55)]={...messages[msgId(55)],deletedAt:1100,body:'Removed text',refs:[{title:'Removed title'}]};
  await db.ref(access).set({[alice.localId]:binding(alice,p),[bob.localId]:binding(bob,other),[unknown.localId]:binding(unknown,'p_'+'d'.repeat(32),false)});
  await db.ref(root).set({control:{[group]:{kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1000,role:'member'}}}},messages:{[group]:messages}});
  const call={token:alice.idToken,roomId:room,conversationId:group};
  const newest=await service.readHistory(call);
  assert.equal(newest.status,'ok');assert.equal(newest.joinedAt,1000);assert.equal(newest.messages.length,50);
  assert.equal(newest.messages[0].id,msgId(7));assert.equal(newest.messages.at(-1).id,msgId(56));
  assert.deepEqual(newest.nextCursor,{id:msgId(7),createdAt:1050});
  assert.equal(newest.hasMore,true);
  const older=await service.readHistory({...call,before:newest.nextCursor});
  assert.equal(older.status,'ok');assert.equal(older.hasMore,false);
  assert.deepEqual(older.messages.map(m=>m.id),[2,3,4,5,6].map(msgId));
  assert.equal(JSON.stringify(newest).includes('Removed text'),false);
  assert.equal(JSON.stringify(newest).includes('Removed title'),false);
  assert.deepEqual(newest.messages.find(m=>m.id===msgId(55)),{id:msgId(55),senderId:p,createdAt:1050,revision:1,deletedAt:1100});
  for(const patch of [{token:bob.idToken},{token:unknown.idToken},{token:'forged'},{roomId:'other'}]){
    assert.deepEqual(await service.readHistory({...call,...patch}),{status:'forbidden'});
  }
  await db.ref(control+'/members/'+p+'/active').set(false);
  assert.deepEqual(await service.readHistory(call),{status:'forbidden'});
  await db.ref(control+'/members/'+p).set({active:true,joinedAt:1050,role:'member'});
  assert.deepEqual(await service.readHistory(call),{status:'ok',joinedAt:1050,messages:[],nextCursor:null,hasMore:false});
  await db.ref(control+'/members/'+p+'/joinedAt').set(1000);
  await db.ref(access+'/'+alice.localId+'/active').set(false);
  assert.deepEqual(await service.readHistory(call),{status:'forbidden'});
  await db.ref(access+'/'+alice.localId+'/active').set(true);
  await auth.updateUser(alice.localId,{disabled:true});
  assert.deepEqual(await service.readHistory(call),{status:'forbidden'});
  console.log('MESSAGING_ADMIN_HISTORY_EMULATOR_OK');
}finally{await deleteApp(app);}
