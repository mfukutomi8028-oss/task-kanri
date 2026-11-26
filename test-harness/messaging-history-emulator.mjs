// Exercise the real Firebase Admin Auth + RTDB SDK in the isolated demo project.
// Never run this script against a production project or production credential.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createFirebaseMessagingHistoryService} from '../security/messaging-history-service.mjs';
import {applyConversationCommand} from '../security/messaging-conversation-commands.mjs';

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
  // Exercise the real stored control schema and transaction retries with
  // synthetic members. This test helper is not an authorization endpoint.
  const lifecycle='group_g_'+'e'.repeat(32),lifecycleRef=db.ref(root+'/control/'+lifecycle);
  const lifecycleHistory=db.ref(root+'/messages/'+lifecycle);
  const lifecycleCall={...call,conversationId:lifecycle};
  const bobCall={...lifecycleCall,token:bob.idToken};
  async function changeControl(command,personId,now){
    let decision;
    const observer=()=>{};
    lifecycleRef.on('value',observer);
    try{
      await lifecycleRef.once('value');
      const transaction=await lifecycleRef.transaction(current=>{
        decision=applyConversationCommand(current,command,{personId,roomId:room,conversationId:lifecycle,now,approvedPersonIds:[p,other]});
        return decision.status==='ok'&&decision.changed?decision.control:undefined;
      },undefined,false);
      return {status:decision?.status,committed:transaction.committed};
    }finally{lifecycleRef.off('value',observer);}
  }
  assert.deepEqual(await changeControl({type:'createGroup',title:'Synthetic project',invitees:[other]},p,2000),{status:'ok',committed:true});
  assert.deepEqual(await service.readHistory(bobCall),{status:'forbidden'});
  await lifecycleHistory.child(msgId(101)).set({senderId:p,createdAt:2100,revision:1,body:'Before joining'});
  assert.deepEqual(await changeControl({type:'respondInvite',accept:true,expectedRevision:1},other,2200),{status:'ok',committed:true});
  await lifecycleHistory.child(msgId(102)).set({senderId:p,createdAt:2200,revision:1,body:'At join'});
  await lifecycleHistory.child(msgId(103)).set({senderId:p,createdAt:2300,revision:1,body:'After joining'});
  assert.deepEqual((await service.readHistory(bobCall)).messages.map(m=>m.id),[msgId(103)]);
  const parallel=await Promise.all([
    changeControl({type:'rename',title:'First change',expectedRevision:2},p,2400),
    changeControl({type:'rename',title:'Second change',expectedRevision:2},p,2400)
  ]);
  assert.equal(parallel.filter(x=>x.committed).length,1);
  assert.equal(parallel.filter(x=>x.status==='conflict').length,1);
  assert.equal((await lifecycleRef.child('revision').get()).val(),3);
  assert.deepEqual(await changeControl({type:'removeMember',personId:other,expectedRevision:3},p,2500),{status:'ok',committed:true});
  assert.deepEqual(await service.readHistory(bobCall),{status:'forbidden'});
  assert.deepEqual(await changeControl({type:'invite',personIds:[other],expectedRevision:4},p,2600),{status:'ok',committed:true});
  assert.deepEqual(await service.readHistory(bobCall),{status:'forbidden'});
  assert.deepEqual(await changeControl({type:'respondInvite',accept:true,expectedRevision:5},other,2700),{status:'ok',committed:true});
  await lifecycleHistory.child(msgId(104)).set({senderId:p,createdAt:2800,revision:1,body:'After rejoining'});
  assert.deepEqual((await service.readHistory(bobCall)).messages.map(m=>m.id),[msgId(104)]);
  assert.deepEqual((await service.readHistory(lifecycleCall)).messages.map(m=>m.id),[101,102,103,104].map(msgId));
  console.log('MESSAGING_GROUP_LIFECYCLE_EMULATOR_OK');
  await auth.updateUser(alice.localId,{disabled:true});
  assert.deepEqual(await service.readHistory(call),{status:'forbidden'});
  console.log('MESSAGING_ADMIN_HISTORY_EMULATOR_OK');
}finally{await deleteApp(app);}
