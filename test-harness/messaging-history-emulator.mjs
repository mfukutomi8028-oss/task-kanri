// Exercise the real Firebase Admin Auth + RTDB SDK in the isolated demo project.
// Never run this script against a production project or production credential.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createFirebaseMessagingHistoryService} from '../security/messaging-history-service.mjs';
import {applyConversationCommand} from '../security/messaging-conversation-commands.mjs';
import {createFirebaseMessagingMutationService} from '../security/messaging-mutation-service.mjs';
import {createFirebaseMessagingConversationService} from '../security/messaging-conversation-service.mjs';
import {createFirebaseMessagingDirectoryServices} from '../security/messaging-directory-service.mjs';
import {createMessagingApiHandler} from '../security/messaging-api-handler.mjs';

const projectId='demo-task-kanri-messaging',authHost='127.0.0.1:9098',dbHost='127.0.0.1:9002';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost||process.env.FIREBASE_DATABASE_EMULATOR_HOST!==dbHost){
  throw new Error('History test requires both isolated loopback emulators');
}
const app=initializeApp({projectId,databaseURL:'https://'+projectId+'.firebaseio.com'},'messaging-history-demo');
try{
  const auth=getAuth(app),db=getDatabase(app),service=createFirebaseMessagingHistoryService({auth,database:db});
  await db.ref('messagingControlV1/enabled').set(true);
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
  // Jump to a known message: one bounded window around it, however far it is
  // from the latest message, with tied timestamps at the join boundary.
  const tied=await service.readHistory({...call,around:msgId(3)});
  assert.equal(tied.status,'ok');assert.equal(tied.messages[1].id,msgId(3));
  assert.deepEqual(tied.messages.slice(0,2).map(m=>m.id),[2,3].map(msgId));
  assert.equal(tied.hasMore,false);assert.equal(tied.nextCursor,null);assert.equal(tied.hasNewer,true);
  for(const target of [msgId(0),msgId(55),msgId(999)])assert.deepEqual(await service.readHistory({...call,around:target}),{status:'missing'});
  assert.deepEqual(await service.readHistory({...call,around:msgId(3),token:bob.idToken}),{status:'forbidden'});
  {
    const big='group_g_'+'9'.repeat(32),bigMessages={},total=5200;
    for(let i=0;i<total;i++)bigMessages[msgId(10000+i)]={senderId:p,createdAt:2000+i,revision:1,body:'Long history '+i};
    bigMessages[msgId(10000+total-1-4000)].deletedAt=9000;
    await db.ref(root+'/control/'+big).set({kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1999,role:'member'}}});
    await db.ref(root+'/messages/'+big).set(bigMessages);
    const bigCall={...call,conversationId:big};
    for(const distance of [300,301,4950]){
      const target=msgId(10000+total-1-distance);
      const view=await service.readHistory({...bigCall,around:target});
      assert.equal(view.status,'ok');assert.equal(view.messages.length,50);assert.equal(view.messages[24].id,target);
      assert.equal(view.hasMore,true);assert.equal(view.hasNewer,true);
      assert.deepEqual(view.newerCursor,{id:view.messages.at(-1).id,createdAt:view.messages.at(-1).createdAt});
      const next=await service.readHistory({...bigCall,after:view.newerCursor,limit:50});
      assert.equal(next.status,'ok');assert.equal(next.messages.length,50);assert.equal(next.messages[0].createdAt,view.messages.at(-1).createdAt+1);
      const older=await service.readHistory({...bigCall,before:view.nextCursor});
      assert.equal(older.messages.at(-1).createdAt,view.messages[0].createdAt-1);
    }
    assert.deepEqual(await service.readHistory({...bigCall,around:msgId(10000+total-1-4000)}),{status:'missing'});
    const end=await service.readHistory({...bigCall,after:{id:msgId(10000+total-3),createdAt:2000+total-3},limit:50});
    assert.equal(end.messages.length,2);assert.equal(end.hasNewer,false);assert.equal(end.newerCursor,null);
    const start=await service.readHistory({...bigCall,around:msgId(10000)});
    assert.equal(start.messages[0].id,msgId(10000));assert.equal(start.hasMore,false);
    // Later sections expect only the original fixture conversations.
    await db.ref(root+'/control/'+big).remove();await db.ref(root+'/messages/'+big).remove();
  }
  // Inclusive range reads (review 5): start at the given row among tied
  // timestamps, never before the join time, one page with a probe for more.
  const fromTie=await service.readHistory({...call,from:{id:msgId(5),createdAt:1050},limit:3});
  assert.equal(fromTie.status,'ok');assert.deepEqual(fromTie.messages.map(m=>m.id),[5,6,7].map(msgId));
  assert.equal(fromTie.hasNewer,true);assert.deepEqual(fromTie.newerCursor,{id:msgId(7),createdAt:1050});
  const afterTie=await service.readHistory({...call,after:{id:msgId(5),createdAt:1050},limit:3});
  assert.deepEqual(afterTie.messages.map(m=>m.id),[6,7,8].map(msgId));
  assert.deepEqual(await service.readHistory({...call,from:{id:msgId(0),createdAt:1000},limit:3}),{status:'missing'});
  assert.deepEqual(await service.readHistory({...call,from:{id:msgId(5),createdAt:1050},limit:3,token:bob.idToken}),{status:'forbidden'});
  console.log('MESSAGING_HISTORY_WINDOW_OK');
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
  // Verify the actual limited Admin SDK instance, not just a simulated actor.
  const mutationGroup='group_g_'+'f'.repeat(32),mutationControl=db.ref(root+'/control/'+mutationGroup);
  const mutationHistory=db.ref(root+'/messages/'+mutationGroup);
  await mutationControl.set({kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1000,role:'member'},[other]:{active:true,joinedAt:1000,role:'member'}}});
  let actorSerial=0,mutationNow=3000,preCommit=()=>{},firstScope;
  async function withActorDatabase(override,operation){
    firstScope??=override;
    const scoped=initializeApp({projectId,databaseURL:'https://'+projectId+'.firebaseio.com',databaseAuthVariableOverride:override},'messaging-mutation-'+(++actorSerial));
    try{
      await preCommit();
      return await operation(getDatabase(scoped));
    }finally{await deleteApp(scoped);}
  }
  const writer=createFirebaseMessagingMutationService({auth,database:db,withActorDatabase,digestKey:new Uint8Array(32).fill(7),clock:()=>mutationNow});
  const writeCall={token:alice.idToken,roomId:room,conversationId:mutationGroup};
  const requestId='q_'+'e'.repeat(32),writeId='msg_'+p+'_'+requestId;
  const sent={...writeCall,command:{type:'send',requestId,input:{body:'Synthetic report'}}};
  assert.deepEqual(await writer.mutate(sent),{status:'sent',id:writeId});
  assert.equal((await mutationHistory.child(writeId).get()).val().body,'Synthetic report');
  const activityPath=root+'/activity/'+mutationGroup;
  const firstSignal=(await db.ref(activityPath).get()).val();
  assert.match(firstSignal,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await withActorDatabase({uid:bob.localId,token:{}},async scoped=>{
    assert.equal((await scoped.ref(activityPath).get()).val(),firstSignal);
    await assert.rejects(scoped.ref(root+'/activity').get(),/permission.denied/i);
    await assert.rejects(scoped.ref(activityPath).set(firstSignal),/permission.denied/i);
    await assert.rejects(scoped.ref('messagingV1/otherRoom/activity/'+mutationGroup).get(),/permission.denied/i);
  });
  await withActorDatabase({uid:unknown.localId,token:{}},async scoped=>{
    await assert.rejects(scoped.ref(activityPath).get(),/permission.denied/i);
  });
  await mutationControl.child('members/'+other+'/active').set(false);
  try{
    await withActorDatabase({uid:bob.localId,token:{}},async scoped=>{
      await assert.rejects(scoped.ref(activityPath).get(),/permission.denied/i);
    });
  }finally{await mutationControl.child('members/'+other+'/active').set(true);}
  mutationNow=3100;
  assert.deepEqual(await writer.mutate(sent),{status:'sent',id:writeId});
  const retrySignal=(await db.ref(activityPath).get()).val();
  assert.notEqual(retrySignal,firstSignal);
  assert.deepEqual(await writer.mutate({...sent,command:{...sent.command,input:{body:'Different'}}}),{status:'conflict'});
  assert.equal((await mutationHistory.get()).numChildren(),1);
  assert.equal((await db.ref(activityPath).get()).val(),retrySignal);
  await withActorDatabase(firstScope,async scoped=>{
    await assert.rejects(scoped.ref(root+'/messages/'+mutationGroup+'/'+msgId(999)).set({id:msgId(999),body:'Wrong scoped record'}),/permission.denied/i);
    await assert.rejects(scoped.ref(access+'/'+alice.localId+'/approved').set(false),/permission.denied/i);
  });
  const edit={...writeCall,command:{type:'edit',messageId:writeId,expectedRevision:1,input:{body:'Updated report'}}};
  assert.deepEqual(await writer.mutate({...edit,token:bob.idToken}),{status:'forbidden'});
  const edited=await writer.mutate(edit);assert.equal(edited.status,'ok');assert.equal(edited.message.revision,2);
  const editedSignal=(await db.ref(activityPath).get()).val();assert.notEqual(editedSignal,retrySignal);
  assert.deepEqual(await writer.mutate(edit),{status:'conflict'});
  assert.equal((await db.ref(activityPath).get()).val(),editedSignal);
  mutationNow=3200;
  const removed=await writer.mutate({...writeCall,command:{type:'remove',messageId:writeId,expectedRevision:2}});
  assert.equal(removed.status,'ok');assert.equal(removed.message.deletedAt,3200);
  assert.notEqual((await db.ref(activityPath).get()).val(),editedSignal);
  console.log('MESSAGING_ACTIVITY_RULES_EMULATOR_OK');
  assert.equal((await mutationHistory.child(writeId+'/body').get()).exists(),false);
  assert.deepEqual(await writer.mutate(sent),{status:'sent',id:writeId});
  const nextRequest='q_'+'f'.repeat(32),nextId='msg_'+p+'_'+nextRequest;
  const nextSend={...sent,command:{...sent.command,requestId:nextRequest}};
  preCommit=()=>mutationControl.child('members/'+p+'/active').set(false);
  assert.deepEqual(await writer.mutate(nextSend),{status:'forbidden'});
  assert.equal((await mutationHistory.child(nextId).get()).exists(),false);
  preCommit=()=>{};
  await mutationControl.child('members/'+p).set({active:true,joinedAt:3150,role:'member'});
  assert.deepEqual(await writer.mutate(sent),{status:'forbidden'});
  assert.equal((await service.readHistory(writeCall)).messages.length,0);
  const concurrent=await Promise.all([writer.mutate(nextSend),writer.mutate(nextSend)]);
  assert.deepEqual(concurrent,[{status:'sent',id:nextId},{status:'sent',id:nextId}]);
  assert.equal((await mutationHistory.child(nextId+'/revision').get()).val(),1);
  console.log('MESSAGING_SCOPED_MUTATION_EMULATOR_OK');
  // A request snapshots the current membership revision before writing.
  await mutationControl.child('revision').set(1);
  mutationNow=4000;
  const confirmRequest='q_'+'1'.repeat(32),confirmId='msg_'+p+'_'+confirmRequest;
  const confirmSend={...writeCall,command:{type:'send',requestId:confirmRequest,input:{body:'Please confirm',confirmationRequested:true}}};
  assert.deepEqual(await writer.mutate(confirmSend),{status:'sent',id:confirmId});
  assert.deepEqual((await mutationHistory.child(confirmId+'/confirmation').get()).val(),{round:1,targets:{[other]:1000}});
  const projected=(await service.readHistory(writeCall)).messages.find(m=>m.id===confirmId);
  assert.deepEqual(projected.confirmation,{round:1,targets:{[other]:1000}});
  mutationNow=4500;
  const confirmEdit={...writeCall,command:{type:'edit',messageId:confirmId,expectedRevision:1,input:{body:'Confirm revised report',confirmationRequested:true}}};
  assert.equal((await writer.mutate(confirmEdit)).status,'ok');
  assert.deepEqual((await mutationHistory.child(confirmId+'/confirmation').get()).val(),{round:2,targets:{[other]:1000}});
  // Another membership change must invalidate the captured target snapshot.
  const staleRequest='q_'+'2'.repeat(32),staleId='msg_'+p+'_'+staleRequest;
  preCommit=()=>mutationControl.child('revision').set(2);
  assert.deepEqual(await writer.mutate({...confirmSend,command:{...confirmSend.command,requestId:staleRequest}}),{status:'forbidden'});
  assert.equal((await mutationHistory.child(staleId).get()).exists(),false);
  preCommit=()=>{};
  console.log('MESSAGING_CONFIRMATION_SNAPSHOT_EMULATOR_OK');
  // Directory fixture uses actual canonical controls and the real limited Admin SDK.
  const directoryRoom='roomDirectory',directoryRoot='messagingV1/'+directoryRoom,directoryAccess='messagingAccessV1/'+directoryRoom,rosterPath='messagingRosterV1/'+directoryRoom;
  const directoryGroup='group_g_'+'1'.repeat(32),direct='dm_'+p+'_'+other,personalConversation='self_'+p;
  const directoryBinding=(account,personId,approved=true)=>({...binding(account,personId,approved),roomId:directoryRoom});
  await db.ref(directoryAccess).set({[alice.localId]:directoryBinding(alice,p),[bob.localId]:directoryBinding(bob,other),[unknown.localId]:directoryBinding(unknown,'p_'+'d'.repeat(32),false)});
  const roster={revision:1,people:{[p]:{displayName:'Synthetic A'},[other]:{displayName:'Synthetic B'}}};
  await db.ref(rosterPath).set(roster);
  let directoryNow=10000,controlScope;
  const controlService=createFirebaseMessagingConversationService({auth,database:db,clock:()=>directoryNow,withActorDatabase:(scope,operation)=>{controlScope=scope;return withActorDatabase(scope,operation);}});
  const {directory,index}=createFirebaseMessagingDirectoryServices({auth,database:db});
  const list=(account,patch={})=>directory.readDirectory({token:account.idToken,roomId:directoryRoom,...patch});
  const command=(account,conversationId,command)=>controlService.execute({token:account.idToken,roomId:directoryRoom,conversationId,command});
  const createGroup={type:'createGroup',title:'Synthetic group',invitees:[other]};
  assert.deepEqual(await controlService.readPeople({token:alice.idToken,roomId:directoryRoom}),{status:'ok',roomId:directoryRoom,personId:p,people:[{personId:p,displayName:'Synthetic A'},{personId:other,displayName:'Synthetic B'}]});
  assert.deepEqual(await command(unknown,directoryGroup,createGroup),{status:'forbidden'});
  assert.deepEqual(await command(alice,directoryGroup,createGroup),{status:'ok',conversationId:directoryGroup,revision:1,indexPending:false});
  assert.deepEqual((await list(bob)).invites,[{conversationId:directoryGroup,title:'Synthetic group',invitedBy:p,invitedAt:10000,revision:1}]);
  assert.deepEqual((await list(bob)).conversations,[]);
  assert.deepEqual((await list(alice)).conversations.map(x=>x.id),[directoryGroup]);
  assert.deepEqual(await list(unknown),{status:'forbidden'});
  await withActorDatabase(controlScope,async scoped=>{
    await assert.rejects(scoped.ref(directoryRoot+'/directoryIndex/'+other+'/'+directoryGroup).set({revision:999,state:'member'}),/permission.denied/i);
    await assert.rejects(scoped.ref(directoryRoot+'/control/'+direct).get(),/permission.denied/i);
    await assert.rejects(scoped.ref(directoryAccess+'/'+alice.localId+'/approved').set(false),/permission.denied/i);
  });
  assert.deepEqual(await service.readHistory({token:bob.idToken,roomId:directoryRoom,conversationId:directoryGroup}),{status:'forbidden'});
  directoryNow=11000;
  assert.deepEqual(await command(bob,directoryGroup,{type:'respondInvite',accept:true,expectedRevision:1}),{status:'ok',conversationId:directoryGroup,revision:2,indexPending:false});
  assert.equal((await list(bob)).conversations[0].joinedAt,11000);
  assert.deepEqual((await list(bob)).invites,[]);
  directoryNow=12000;
  const competing=await Promise.all([command(alice,directoryGroup,{type:'rename',title:'First update',expectedRevision:2}),command(alice,directoryGroup,{type:'rename',title:'Second update',expectedRevision:2})]);
  assert.deepEqual(competing.map(x=>x.status).sort(),['conflict','ok']);
  directoryNow=13000;
  assert.equal((await command(alice,directoryGroup,{type:'removeMember',personId:other,expectedRevision:3})).status,'ok');
  // A stale index must never turn into authority, even before a repair.
  const bobIndex=db.ref(directoryRoot+'/directoryIndex/'+other+'/'+directoryGroup);
  await bobIndex.set({revision:2,state:'member'});
  assert.deepEqual((await list(bob)).conversations,[]);
  assert.deepEqual((await list(bob)).invites,[]);
  assert.equal((await index.reconcile({roomId:directoryRoom,conversationId:directoryGroup})).status,'ok');
  assert.deepEqual((await bobIndex.get()).val(),{revision:4,state:'inactive'});
  directoryNow=14000;
  assert.equal((await command(alice,direct,{type:'openDirect',personId:other})).status,'ok');
  assert.equal((await command(bob,direct,{type:'openDirect',personId:p})).revision,1);
  assert.equal((await command(alice,personalConversation,{type:'openSelf'})).status,'ok');
  const firstPage=await list(alice,{limit:1});
  assert.equal(firstPage.hasMore,true);assert.equal(firstPage.nextCursor,direct);
  const secondPage=await list(alice,{after:firstPage.nextCursor,limit:1});
  assert.equal(secondPage.nextCursor,directoryGroup);
  const finalPage=await list(alice,{after:secondPage.nextCursor,limit:1});assert.equal(finalPage.hasMore,false);assert.equal(finalPage.conversations[0].id,personalConversation);
  await db.ref(directoryRoot+'/directoryIndex/'+p+'/'+personalConversation).remove();
  assert.equal((await list(alice)).conversations.length,2);
  const repairPage=await index.reconcilePage({roomId:directoryRoom,after:directoryGroup,limit:1});
  assert.deepEqual(repairPage,{status:'ok',processed:1,failed:[],hasMore:false,nextCursor:null});
  assert.equal((await list(alice)).conversations.length,3);
  // The real HTTP boundary routes verified Firebase ID tokens to these actual
  // Emulator-backed services; the request and origin are synthetic.
  const apiOrigin='https://board.example.test';
  const gate=db.ref('messagingControlV1/enabled');
  const apiHandler=createMessagingApiHandler({allowedOrigins:[apiOrigin],checkAvailable:async()=>(await gate.get()).val()===true,history:service,mutation:writer,directory,conversations:controlService});
  const apiCall=(account,personId,action,payload)=>apiHandler(new Request('https://api.example.test/messaging',{method:'POST',headers:{Origin:apiOrigin,'Content-Type':'application/json',Authorization:'Bearer '+account.idToken},body:JSON.stringify({action,payload:{roomId:directoryRoom,...payload},expectedPersonId:personId})}));
  const directoryResponse=await apiCall(alice,p,'directory',{});
  assert.equal(directoryResponse.status,200);assert.equal((await directoryResponse.json()).conversations.length,3);
  const wrongPerson=await apiCall(bob,p,'directory',{});
  assert.equal(wrongPerson.status,403);assert.deepEqual(await wrongPerson.json(),{status:'forbidden'});
  mutationNow=15000;
  const apiRequest='q_'+'3'.repeat(32),apiId='msg_'+p+'_'+apiRequest;
  const apiPayload={conversationId:personalConversation,command:{type:'send',requestId:apiRequest,input:{body:'HTTP fixture'}}};
  assert.equal((await apiCall(bob,p,'message',apiPayload)).status,403);
  const apiSent=await apiCall(alice,p,'message',apiPayload);assert.equal(apiSent.status,200);assert.deepEqual(await apiSent.json(),{status:'sent',id:apiId});
  const apiHistory=await apiCall(alice,p,'history',{conversationId:personalConversation});
  assert.equal(apiHistory.status,200);assert.deepEqual((await apiHistory.json()).messages.map(m=>m.id),[apiId]);
  assert.equal((await apiCall(alice,other,'history',{conversationId:personalConversation})).status,403);
  // Unread summaries use the canonical joinedAt boundary and personal cursor.
  const unreadPath=directoryRoot+'/messages/'+direct;
  const msgA='msg_'+p+'_q_'+'4'.repeat(32),msgB='msg_'+other+'_q_'+'5'.repeat(32),msgC='msg_'+other+'_q_'+'6'.repeat(32),msgD='msg_'+other+'_q_'+'7'.repeat(32),msgE='msg_'+other+'_q_'+'8'.repeat(32);
  await db.ref(unreadPath).set({
    [msgA]:{id:msgA,senderId:p,createdAt:15000,body:'Own',revision:1},
    [msgB]:{id:msgB,senderId:other,createdAt:14000,body:'Join boundary',revision:1},
    [msgC]:{id:msgC,senderId:other,createdAt:16000,body:'Incoming A',revision:1},
    [msgD]:{id:msgD,senderId:other,createdAt:16000,body:'Incoming B',revision:1},
    [msgE]:{id:msgE,senderId:other,createdAt:17000,deletedAt:18000,revision:2}
  });
  const unreadCall=()=>apiCall(alice,p,'unread',{conversationId:direct});
  const unread=await unreadCall();assert.equal(unread.status,200);
  assert.deepEqual(await unread.json(),{status:'ok',roomId:directoryRoom,conversationId:direct,personId:p,joinedAt:14000,unread:2,latestIncoming:{id:msgD,createdAt:16000},muted:false,complete:true});
  const statePath=directoryRoot+'/personal/'+p+'/'+direct+'/14000';
  await db.ref(statePath+'/readCursor').set({id:msgC,createdAt:16000});
  await db.ref(statePath+'/preferences/muted').set(true);
  const afterRead=await (await unreadCall()).json();
  assert.equal(afterRead.unread,1);assert.equal(afterRead.muted,true);assert.deepEqual(afterRead.latestIncoming,{id:msgD,createdAt:16000});
  assert.equal((await apiCall(bob,p,'unread',{conversationId:direct})).status,403);
  assert.equal((await apiCall(unknown,'p_'+'d'.repeat(32),'unread',{conversationId:direct})).status,403);
  assert.equal((await apiCall(bob,other,'unread',{conversationId:directoryGroup})).status,403);
  assert.equal((await apiCall(alice,p,'unread',{conversationId:direct,personId:other})).status,400);
  console.log('MESSAGING_UNREAD_HTTP_EMULATOR_OK');
  console.log('MESSAGING_HTTP_BOUNDARY_EMULATOR_OK');
  // Stop, snapshot only the synthetic room, and restore its exact keys.
  const scopePaths=[directoryRoot,directoryAccess,rosterPath];
  const snapshot=async()=>Object.fromEntries(await Promise.all(scopePaths.map(async location=>[location,(await db.ref(location).get()).val()])));
  const canonical=value=>value&&typeof value==='object'&&!Array.isArray(value)
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  const legacyPath='rooms/isolatedBackupLegacy/meta/reviewMarker';
  await db.ref(legacyPath).set('isolated sentinel');
  await gate.set(false);
  assert.equal((await apiCall(alice,p,'history',{conversationId:personalConversation})).status,503);
  const before=await snapshot(),backup=JSON.stringify(before),hash=digest(before);
  await db.ref().update(Object.fromEntries(scopePaths.map(location=>[location,null])));
  assert.ok(Object.values(await snapshot()).every(value=>value===null));
  await db.ref().update(JSON.parse(backup));
  assert.equal(digest(await snapshot()),hash);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await db.ref(legacyPath).get()).val(),'isolated sentinel');
  assert.equal((await apiCall(alice,p,'message',apiPayload)).status,503);
  await gate.set(true);
  const restoredHistory=await apiCall(alice,p,'history',{conversationId:personalConversation});
  assert.equal(restoredHistory.status,200);
  assert.deepEqual((await restoredHistory.json()).messages.map(row=>row.id),[apiId]);
  assert.equal((await apiCall(bob,other,'history',{conversationId:personalConversation})).status,403);
  assert.equal((await apiCall(alice,p,'message',apiPayload)).status,200);
  assert.equal((await (await unreadCall()).json()).joinedAt,14000);
  await db.ref(legacyPath).remove();
  console.log('MESSAGING_SYNTHETIC_BACKUP_RESTORE_OK');

  const deniedGroup='group_g_'+'2'.repeat(32);
  preCommit=()=>db.ref(rosterPath+'/revision').set(2);
  assert.deepEqual(await command(alice,deniedGroup,createGroup),{status:'forbidden'});
  assert.equal((await db.ref(directoryRoot+'/control/'+deniedGroup).get()).exists(),false);
  preCommit=()=>db.ref(directoryAccess+'/'+alice.localId+'/active').set(false);
  assert.deepEqual(await command(alice,deniedGroup,createGroup),{status:'forbidden'});
  assert.equal((await db.ref(directoryRoot+'/control/'+deniedGroup).get()).exists(),false);
  assert.deepEqual(await list(alice),{status:'forbidden'});
  preCommit=()=>{};
  console.log('MESSAGING_DIRECTORY_AND_CONTROL_EMULATOR_OK');
  await auth.updateUser(alice.localId,{disabled:true});
  assert.deepEqual(await service.readHistory(call),{status:'forbidden'});
  console.log('MESSAGING_ADMIN_HISTORY_EMULATOR_OK');
}finally{await deleteApp(app);}
