// Read-boundary spike for messaging. Synthetic data and loopback emulator only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {get,ref,set,update,runTransaction,serverTimestamp,query,orderByChild,orderByKey,startAt,endBefore,limitToLast} from 'firebase/database';
import {createMessagingPersonalStateTransport} from '../workspace-messaging-personal.js';
import {createMessagingConfirmationTransport} from '../workspace-messaging-confirmations.js';
import {createMessagingSharedTransport} from '../workspace-messaging-shared.js';

const host='127.0.0.1:9002';
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!==host) throw new Error('Messaging rules require the isolated loopback emulator: '+host);
const candidate=JSON.parse(readFileSync(new URL('../security/database.rules.messaging.candidate.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('../firebase-rules.json',import.meta.url),'utf8'));
assert.equal(candidate.rules['.read'],false);
assert.equal(candidate.rules['.write'],false);
assert.equal(candidate.rules.rooms,undefined);
// Preserve the real legacy root in the emulator to prove its broad permissions
// cannot leak into the independent messaging namespace. Never deploy this merge.
candidate.rules.rooms=legacy.rules.rooms;
const env=await initializeTestEnvironment({
  projectId:'demo-task-kanri-messaging',
  database:{host:'127.0.0.1',port:9002,rules:JSON.stringify(candidate)}
});
const p='p_'+'a'.repeat(32), other='p_'+'b'.repeat(32), denied='p_'+'d'.repeat(32);
const group='group_g_'+'c'.repeat(32);
const room='roomA', root='messagingV1/'+room, control=root+'/control/'+group, history=root+'/messages/'+group;
const access='messagingAccessV1/'+room;
const binding=(uid,personId,approved=true)=>({uid,roomId:room,personId,displayName:'Synthetic '+uid,approved,active:true});
const messages={before:{createdAt:999,body:'before',nested:{createdAt:1002,secret:'prejoin nested value'}},atJoin:{createdAt:1000,body:'at join'}};
for(let i=1;i<=55;i++) messages['m'+String(i).padStart(3,'0')]={createdAt:1000+i,body:'message '+i};
messages.m055.createdAt=1054;
const path=(context,key)=>ref(context.database(),key);
const latest=(context,min=1001,count=50)=>query(path(context,history),orderByChild('createdAt'),startAt(min),limitToLast(count));
const values=snapshot=>{const keys=[];snapshot.forEach(child=>{keys.push(child.key)});return keys;};
const deny=(operation)=>assertFails(operation);

try {
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,'/'),{
      messagingControlV1:{enabled:true},
      rooms:{[room]:{meta:{users:['Synthetic uidA']}}},
      messagingAccessV1:{[room]:{
        uidA:binding('uidA',p),uidB:binding('uidB',other),uidDenied:binding('uidDenied',denied,false)
      }},
      messagingV1:{[room]:{
        control:{[group]:{kind:'group',status:'active',members:{
          [p]:{active:true,joinedAt:1000,role:'member'},
          [denied]:{active:true,joinedAt:1000,role:'member'}
        }}},
        messages:{[group]:messages}
      }}
    });
  });
  const anon=env.unauthenticatedContext(), member=env.authenticatedContext('uidA'),
    nonmember=env.authenticatedContext('uidB'), unapproved=env.authenticatedContext('uidDenied'),
    unknown=env.authenticatedContext('unknown');
  // First assert denied paths even under the legacy room-wide allow.
  await assertSucceeds(get(path(anon,'rooms/'+room+'/meta')));
  for(const ctx of [anon,nonmember,unapproved,unknown]){
    await deny(get(latest(ctx)));
    await deny(get(path(ctx,history+'/m055')));
    await deny(get(path(ctx,control)));
  }
  for(const key of ['messagingV1',root,root+'/messages',root+'/control','messagingAccessV1',access]){
    await deny(get(path(member,key)));
  }
  await deny(get(path(member,access+'/uidB')));
  await deny(set(path(member,access+'/uidA/approved'),true));
  await deny(set(path(nonmember,control+'/members/'+other),{active:true,joinedAt:0,role:'owner'}));
  await deny(get(path(member,history)));
  await deny(get(query(path(member,history),orderByChild('createdAt'),limitToLast(50))));
  await deny(get(latest(member,1000)));
  await deny(get(latest(member,1002)));
  await deny(get(latest(member,1001,51)));
  await deny(get(query(path(member,history),orderByKey(),startAt('m001'),limitToLast(50))));
  await deny(get(path(member,history+'/before')));
  await deny(get(path(member,history+'/atJoin')));
  // A constrained query at a descendant must not inherit a list-read grant.
  for(const target of [history+'/before',history+'/before/body',history+'/before/nested']){
    await deny(get(query(path(member,target),orderByChild('createdAt'),startAt(1001),limitToLast(50))));
  }
  await deny(get(latest(member,'1001')));
  await deny(get(latest(member,true)));
  await deny(get(path(member,'messagingV1/roomB/messages/'+group+'/m055')));
  await deny(set(path(member,history+'/unsafe'),{createdAt:1055,body:'write not implemented'}));
  console.log('MESSAGING_READ_DENIALS_OK');
  // The direct list boundary is deliberately denied, including a query with
  // the correct lower limit. Per-message reads retain the membership check.
  await deny(get(latest(member)));
  const self=await assertSucceeds(get(path(member,access+'/uidA')));
  assert.equal(self.val().personId,p);
  await assertSucceeds(get(path(member,control)));
  await assertSucceeds(get(path(member,history+'/m001')));
  await assertSucceeds(get(path(member,history+'/m055')));
  // Verify the underlying paginated query with the trusted emulator fixture.
  // This is NOT a test of a completed server API or its authorization.
  // No client-side read permission is granted to make the query pass.
  await env.withSecurityRulesDisabled(async admin=>{
    const page=await get(latest(admin));
    const keys=values(page);
    assert.equal(keys.length,50);
    assert.equal(keys[0],'m006');
    assert.deepEqual(keys.slice(-2),['m054','m055']);
    assert.equal(keys.includes('before'),false);
    assert.equal(keys.includes('atJoin'),false);
    const older=await get(query(path(admin,history),orderByChild('createdAt'),startAt(1001),endBefore(1006,'m006'),limitToLast(50)));
    assert.deepEqual(values(older),['m001','m002','m003','m004','m005']);
    const tie=await get(query(path(admin,history),orderByChild('createdAt'),startAt(1001),endBefore(1054,'m055'),limitToLast(50)));
    assert.equal(values(tie).at(-1),'m054');
    assert.equal(values(tie).includes('m055'),false);
  });
  console.log('MESSAGING_TRUSTED_QUERY_SHAPE_OK');
  // Two real authenticated SDK clients, including a second approved UID for
  // the same person, exercise the personal state transport and Rules together.
  const personalGroup='group_g_'+'e'.repeat(32),pc=root+'/control/'+personalGroup;
  const msg=n=>'msg_'+other+'_q_'+n.toString(16).padStart(32,'0');
  const cursor=(n,createdAt=2000)=>({id:msg(n),createdAt});
  const message=(n,createdAt=2000)=>({id:msg(n),senderId:other,createdAt,revision:1,body:'Synthetic message'});
  const scope={roomId:room,personId:p,conversationId:personalGroup,joinedAt:1000};
  const otherScope={...scope,personId:other};
  const personalPath=root+'/personal/'+p+'/'+personalGroup+'/1000';
  const adapter=ctx=>createMessagingPersonalStateTransport({db:ctx.database(),ref,get,update,set,runTransaction});
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,access+'/uidA2'),binding('uidA2',p));
    await set(path(admin,pc),{kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1000,role:'member'},[other]:{active:true,joinedAt:1000,role:'member'}}});
    await set(path(admin,root+'/messages/'+personalGroup),{[msg(0)]:message(0,999),[msg(1)]:message(1),[msg(2)]:message(2),[msg(3)]:message(3,2100),[msg(4)]:{...message(4,2200),deletedAt:2300}});
  });
  const first=adapter(member),second=adapter(env.authenticatedContext('uidA2')),bob=adapter(nonmember);
  assert.deepEqual(await first.setPersonalState({...scope,patch:{favorite:true,muted:true}}),{status:'ok'});
  assert.deepEqual(await second.setPersonalState({...scope,patch:{archived:true}}),{status:'ok'});
  assert.deepEqual((await first.readPersonalState(scope)).preferences,{favorite:true,muted:true,archived:true,pinned:false});
  assert.deepEqual((await bob.readPersonalState(otherScope)).preferences,{favorite:false,muted:false,archived:false,pinned:false});
  for(const ctx of [anon,unknown,unapproved,nonmember]){
    assert.deepEqual(await adapter(ctx).readPersonalState(scope),{status:'forbidden'});
    assert.deepEqual(await adapter(ctx).setPersonalState({...scope,patch:{favorite:false}}),{status:'forbidden'});
  }
  await deny(get(path(member,root+'/personal')));
  await deny(get(path(member,personalPath)));
  await deny(update(path(member,personalPath+'/preferences'),{favorite:false,unknown:true}));
  await deny(set(path(member,personalPath+'/preferences/muted'),'true'));
  assert.equal((await first.readPersonalState(scope)).preferences.favorite,true);
  assert.deepEqual(await first.markRead({...scope,cursor:cursor(2)}),{status:'ok',cursor:cursor(2)});
  assert.deepEqual(await second.markRead({...scope,cursor:cursor(1)}),{status:'ok',cursor:cursor(2)});
  await deny(set(path(member,personalPath+'/readCursor'),cursor(1)));
  await deny(set(path(member,personalPath+'/readCursor'),cursor(2,2001)));
  await deny(set(path(member,personalPath+'/readCursor'),null));
  await deny(set(path(member,personalPath+'/readCursor'),{...cursor(2),extra:true}));
  assert.deepEqual(await second.markRead({...scope,cursor:cursor(3,2100)}),{status:'ok',cursor:cursor(3,2100)});
  const mark={...scope,messageId:msg(1),bookmarked:true};
  assert.deepEqual(await first.setBookmark(mark),{status:'ok'});
  assert.deepEqual(await second.setBookmark(mark),{status:'ok'});
  assert.deepEqual(await second.readBookmark(mark),{status:'ok',bookmarked:true});
  assert.deepEqual(await bob.readBookmark({...mark,personId:other}),{status:'ok',bookmarked:false});
  for(const n of [0,4,5])assert.deepEqual(await first.setBookmark({...mark,messageId:msg(n)}),{status:'forbidden'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,root+'/messages/'+personalGroup+'/'+msg(1)+'/deletedAt'),2400));
  assert.deepEqual(await first.readBookmark(mark),{status:'forbidden'});
  assert.deepEqual(await first.setBookmark({...mark,bookmarked:false}),{status:'ok'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,pc+'/members/'+p+'/active'),false));
  assert.deepEqual(await first.readPersonalState(scope),{status:'forbidden'});
  assert.deepEqual(await first.setPersonalState({...scope,patch:{pinned:true}}),{status:'forbidden'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,pc+'/members/'+p),{active:true,joinedAt:2050,role:'member'}));
  assert.deepEqual(await second.readPersonalState(scope),{status:'forbidden'});
  assert.deepEqual(await first.readPersonalState({...scope,joinedAt:2050}),{status:'ok',preferences:{favorite:false,muted:false,archived:false,pinned:false},cursor:null});
  assert.deepEqual(await first.markRead({...scope,joinedAt:2050,cursor:cursor(3,2100)}),{status:'ok',cursor:cursor(3,2100)});
  console.log('MESSAGING_PERSONAL_STATE_EMULATOR_OK');
  // Permanent record links: personId-keyed, member-only, post-join, non-deleted, immutable target.
  {
    const linkPath=root+'/recordLinks/'+p+'/task/task-1',link=n=>({conversationId:personalGroup,messageId:msg(n),createdAt:serverTimestamp()});
    // State left by the personal-state section: p rejoined at 2050, msg(1) deleted.
    await env.withSecurityRulesDisabled(admin=>set(path(admin,root+'/messages/'+personalGroup+'/'+msg(5)),message(5,2200)));
    await assertSucceeds(set(path(member,linkPath),link(3)));
    await deny(set(path(env.authenticatedContext('uidA2'),linkPath),link(3)));
    await assertSucceeds(get(path(env.authenticatedContext('uidA2'),linkPath)));
    await deny(set(path(member,linkPath),link(5)));
    await deny(get(path(nonmember,linkPath)));
    await deny(set(path(nonmember,root+'/recordLinks/'+p+'/task/task-2'),link(3)));
    await deny(set(path(member,root+'/recordLinks/'+other+'/task/task-2'),link(3)));
    for(const ctx of [anon,unknown,unapproved])await deny(get(path(ctx,linkPath)));
    await deny(set(path(member,root+'/recordLinks/'+p+'/task/pre-join'),link(2)));
    await deny(set(path(member,root+'/recordLinks/'+p+'/task/deleted'),link(4)));
    await deny(set(path(member,root+'/recordLinks/'+p+'/memo/m1'),link(3)));
    await deny(set(path(member,root+'/recordLinks/'+p+'/task/extra'),{...link(3),body:'copied'}));
    await deny(set(path(member,root+'/recordLinks/'+p+'/schedule/s1'),{...link(3),createdAt:5}));
    await assertSucceeds(set(path(member,root+'/recordLinks/'+p+'/schedule/s1'),link(5)));
    await env.withSecurityRulesDisabled(admin=>set(path(admin,'messagingControlV1/enabled'),false));
    await deny(get(path(member,linkPath)));
    await env.withSecurityRulesDisabled(admin=>set(path(admin,'messagingControlV1/enabled'),true));
    await env.withSecurityRulesDisabled(admin=>set(path(admin,pc+'/members/'+p+'/active'),false));
    await deny(set(path(member,root+'/recordLinks/'+p+'/task/after-leave'),link(5)));
    await assertSucceeds(get(path(member,linkPath)));
    await env.withSecurityRulesDisabled(admin=>set(path(admin,pc+'/members/'+p+'/active'),true));
    console.log('MESSAGING_RECORD_LINK_RULES_OK');
  }
  // A separate fixture keeps receipt authorization independent of cursor tests.
  const cg='group_g_'+'f'.repeat(32),confirmControl=root+'/control/'+cg,confirmId='msg_'+p+'_q_'+'e'.repeat(32);
  const confirmMessage=root+'/messages/'+cg+'/'+confirmId,receiptRoot=root+'/confirmationReceipts/'+cg+'/'+confirmId;
  const confirmationScope={roomId:room,conversationId:cg,messageId:confirmId,round:1,personId:other};
  const senderScope={...confirmationScope,personId:p};
  const receipts=ctx=>createMessagingConfirmationTransport({db:ctx.database(),ref,get,runTransaction,serverTimestamp});
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,confirmControl),{status:'active',revision:1,members:{[p]:{active:true,joinedAt:1000,role:'owner'},[other]:{active:true,joinedAt:1200,role:'member'},[denied]:{active:true,joinedAt:1300,role:'member'}}});
    await set(path(admin,confirmMessage),{id:confirmId,senderId:p,createdAt:2000,revision:1,body:'Confirm this',confirmationRequested:true,confirmation:{round:1,targets:{[other]:1200}}});
  });
  const receiver=receipts(nonmember),sender=receipts(member);
  assert.deepEqual(await receiver.readOwnConfirmation(confirmationScope),{status:'ok',confirmedAt:null});
  assert.deepEqual(await sender.readReceipts(senderScope),{status:'ok',receipts:{}});
  for(const ctx of [anon,unknown,unapproved,member])assert.deepEqual(await receipts(ctx).confirm(confirmationScope),{status:'forbidden'});
  assert.deepEqual(await receiver.confirm({...confirmationScope,personId:p}),{status:'forbidden'});
  assert.deepEqual(await receiver.readReceipts(confirmationScope),{status:'forbidden'});
  await deny(get(path(member,root+'/confirmationReceipts')));
  await deny(get(path(member,receiptRoot)));
  await deny(set(path(nonmember,receiptRoot+'/1/'+other),1000));
  const acknowledged=await receiver.confirm(confirmationScope);
  assert.equal(acknowledged.status,'ok');assert.ok(acknowledged.confirmedAt>=2000);
  assert.deepEqual(await receiver.confirm(confirmationScope),acknowledged);
  assert.deepEqual(await sender.readReceipts(senderScope),{status:'ok',receipts:{[other]:acknowledged.confirmedAt}});
  await deny(set(path(nonmember,receiptRoot+'/1/'+other),null));
  await deny(set(path(nonmember,receiptRoot+'/1/'+other),acknowledged.confirmedAt+1));
  // The sender's read cursors and receipt round are independent.
  await env.withSecurityRulesDisabled(async admin=>{
    await update(path(admin,confirmMessage),{revision:2,editedAt:3000,confirmation:{round:2,targets:{[other]:1200}}});
  });
  assert.deepEqual(await receiver.confirm(confirmationScope),{status:'forbidden'});
  assert.deepEqual(await sender.readReceipts(senderScope),{status:'forbidden'});
  assert.deepEqual(await sender.readReceipts({...senderScope,round:2}),{status:'ok',receipts:{}});
  assert.equal((await receiver.confirm({...confirmationScope,round:2})).status,'ok');
  await env.withSecurityRulesDisabled(admin=>set(path(admin,confirmControl+'/members/'+other+'/active'),false));
  assert.deepEqual(await receiver.readOwnConfirmation({...confirmationScope,round:2}),{status:'forbidden'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,confirmControl+'/members/'+other),{active:true,joinedAt:4000,role:'member'}));
  assert.deepEqual(await receiver.confirm({...confirmationScope,round:2}),{status:'forbidden'});
  await env.withSecurityRulesDisabled(admin=>update(path(admin,confirmMessage),{deletedAt:5000,confirmation:null,confirmationRequested:null,body:null,revision:3}));
  assert.deepEqual(await sender.readReceipts({...senderScope,round:2}),{status:'forbidden'});
  console.log('MESSAGING_CONFIRMATION_RECEIPTS_EMULATOR_OK');
  // Per-message shared state inherits the same current membership and history boundary.
  const sg='group_g_'+'1'.repeat(32),sc=root+'/control/'+sg,sharedId='msg_'+p+'_q_'+'1'.repeat(32);
  const sharedMessage=root+'/messages/'+sg+'/'+sharedId;
  const sharedScope={roomId:room,conversationId:sg,messageId:sharedId,personId:other};
  const ownerScope={...sharedScope,personId:p};
  const decoration=ctx=>createMessagingSharedTransport({db:ctx.database(),ref,get,set});
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,sc),{kind:'group',status:'active',members:{[p]:{active:true,joinedAt:1000,role:'owner'},[other]:{active:true,joinedAt:1200,role:'member'},[denied]:{active:true,joinedAt:1300,role:'member'}}});
    await set(path(admin,sharedMessage),{id:sharedId,senderId:p,createdAt:2000,revision:1,body:'Shared message'});
  });
  const ownerDecor=decoration(member),memberDecor=decoration(nonmember);
  assert.deepEqual(await memberDecor.readReactions(sharedScope),{status:'ok',reactions:{}});
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:'like'}),{status:'ok'});
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:'like'}),{status:'ok'});
  assert.deepEqual(await ownerDecor.readReactions(ownerScope),{status:'ok',reactions:{[other]:'like'}});
  assert.deepEqual(await memberDecor.setReaction({...ownerScope,reaction:'thanks'}),{status:'forbidden'});
  for(const ctx of [anon,unknown,unapproved]){
    assert.deepEqual(await decoration(ctx).readReactions(sharedScope),{status:'forbidden'});
    assert.deepEqual(await decoration(ctx).setReaction({...sharedScope,reaction:'like'}),{status:'forbidden'});
  }
  const reactionRoot=root+'/reactions/'+sg+'/'+sharedId;
  await deny(get(path(member,root+'/reactions/'+sg)));
  await deny(set(path(nonmember,reactionRoot+'/'+other),'unknown'));
  await deny(set(path(nonmember,reactionRoot),{[p]:'like'}));
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:'thanks'}),{status:'ok'});
  assert.deepEqual(await ownerDecor.readReactions(ownerScope),{status:'ok',reactions:{[other]:'thanks'}});
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:null}),{status:'ok'});
  assert.deepEqual(await ownerDecor.readReactions(ownerScope),{status:'ok',reactions:{}});
  assert.deepEqual(await memberDecor.setSharedPin({...sharedScope,pinned:true}),{status:'forbidden'});
  assert.deepEqual(await ownerDecor.setSharedPin({...ownerScope,pinned:true}),{status:'ok'});
  assert.deepEqual(await memberDecor.readSharedPin(sharedScope),{status:'ok',pinned:true});
  assert.deepEqual(await memberDecor.setSharedPin({...sharedScope,pinned:false}),{status:'forbidden'});
  await deny(get(path(member,root+'/sharedPins/'+sg)));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,sc+'/status'),'archived'));
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:'like'}),{status:'forbidden'});
  assert.deepEqual(await ownerDecor.setSharedPin({...ownerScope,pinned:false}),{status:'forbidden'});
  assert.deepEqual(await ownerDecor.readSharedPin(ownerScope),{status:'ok',pinned:true});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,sc+'/status'),'active'));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,sc+'/members/'+other+'/active'),false));
  assert.deepEqual(await memberDecor.readReactions(sharedScope),{status:'forbidden'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,sc+'/members/'+other),{active:true,joinedAt:2100,role:'member'}));
  assert.deepEqual(await memberDecor.readSharedPin(sharedScope),{status:'forbidden'});
  assert.deepEqual(await memberDecor.setReaction({...sharedScope,reaction:'like'}),{status:'forbidden'});
  assert.deepEqual(await ownerDecor.setSharedPin({...ownerScope,pinned:false}),{status:'ok'});
  await env.withSecurityRulesDisabled(admin=>set(path(admin,sharedMessage+'/deletedAt'),2200));
  assert.deepEqual(await ownerDecor.readReactions(ownerScope),{status:'forbidden'});
  assert.deepEqual(await ownerDecor.setSharedPin({...ownerScope,pinned:true}),{status:'forbidden'});
  console.log('MESSAGING_SHARED_STATE_EMULATOR_OK');
  // Index and invitation roster are trusted server metadata, never client grants.
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,'messagingRosterV1/'+room),{revision:1,people:{[p]:{displayName:'Synthetic A'},[other]:{displayName:'Synthetic B'}}});
    await set(path(admin,root+'/directoryIndex/'+p+'/'+group),{revision:1,state:'member'});
  });
  for(const ctx of [member,nonmember,anon,unknown,unapproved]){
    await deny(get(path(ctx,'messagingRosterV1/'+room)));
    await deny(get(path(ctx,root+'/directoryIndex/'+p)));
    await deny(set(path(ctx,root+'/directoryIndex/'+p+'/'+group),{revision:99,state:'member'}));
    await deny(set(path(ctx,'messagingRosterV1/'+room+'/revision'),2));
    await deny(set(path(ctx,control+'/title'),'Client rename'));
  }
  console.log('MESSAGING_DIRECTORY_CLIENT_DENIALS_OK');
  // A fresh context after a server-side membership change cannot use old grants.
  await env.withSecurityRulesDisabled(admin=>set(path(admin,control+'/members/'+p+'/active'),false));
  const left=env.authenticatedContext('uidA');
  await deny(get(latest(left)));
  await deny(get(path(left,history+'/m055')));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,control+'/members/'+p),{active:true,joinedAt:1053,role:'member'}));
  const rejoined=env.authenticatedContext('uidA');
  await deny(get(latest(rejoined,1001)));
  await deny(get(path(rejoined,history+'/m053')));
  await deny(get(latest(rejoined,1054)));
  await assertSucceeds(get(path(rejoined,history+'/m054')));
  await assertSucceeds(get(path(rejoined,history+'/m055')));
  await deny(set(path(rejoined,'messagingControlV1/enabled'),false));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,'messagingControlV1/enabled'),false));
  await deny(get(path(rejoined,history+'/m055')));
  await deny(get(path(rejoined,access+'/uidA')));
  const stoppedPersonal=root+'/personal/'+p+'/'+group+'/1053/preferences';
  await deny(set(path(rejoined,stoppedPersonal+'/favorite'),true));
  await deny(get(path(rejoined,stoppedPersonal)));
  await assertSucceeds(get(path(rejoined,'messagingControlV1/enabled')));
  await assertSucceeds(set(path(anon,'rooms/'+room+'/meta/reviewMarker'),'synthetic'));
  await assertSucceeds(get(path(anon,'rooms/'+room+'/meta/reviewMarker')));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,'messagingControlV1/enabled'),'invalid'));
  await deny(get(path(rejoined,history+'/m055')));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,'messagingControlV1/enabled'),true));
  await assertSucceeds(get(path(rejoined,history+'/m055')));
  console.log('MESSAGING_EMERGENCY_STOP_AND_LEGACY_COMPATIBILITY_OK');
  await env.withSecurityRulesDisabled(admin=>set(path(admin,access+'/uidA/active'),false));
  const revoked=env.authenticatedContext('uidA');
  await deny(get(latest(revoked,1054)));
  await deny(get(path(revoked,history+'/m055')));
  console.log('MESSAGING_DIRECT_READ_BOUNDARY_OK');
} finally {
  await env.cleanup();
}
