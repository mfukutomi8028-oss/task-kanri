// Read-boundary spike for messaging. Synthetic data and loopback emulator only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {get,ref,set,query,orderByChild,orderByKey,startAt,endBefore,limitToLast} from 'firebase/database';

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
const messages={before:{createdAt:999,body:'before'},atJoin:{createdAt:1000,body:'at join'}};
for(let i=1;i<=55;i++) messages['m'+String(i).padStart(3,'0')]={createdAt:1000+i,body:'message '+i};
messages.m055.createdAt=1054;
const path=(context,key)=>ref(context.database(),key);
const latest=(context,min=1001,count=50)=>query(path(context,history),orderByChild('createdAt'),startAt(min),limitToLast(count));
const values=snapshot=>{const keys=[];snapshot.forEach(child=>{keys.push(child.key)});return keys;};
const deny=(operation)=>assertFails(operation);
try {
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,'/'),{
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
  await deny(get(latest(member,1001,51)));
  await deny(get(query(path(member,history),orderByKey(),startAt('m001'),limitToLast(50))));
  await deny(get(path(member,history+'/before')));
  await deny(get(path(member,history+'/atJoin')));
  await deny(get(path(member,'messagingV1/roomB/messages/'+group+'/m055')));
  await deny(set(path(member,history+'/unsafe'),{createdAt:1055,body:'write not implemented'}));
  console.log('MESSAGING_READ_DENIALS_OK');
  // RED on the deny-only rules: the valid self binding and bounded history
  // must become readable without granting any unrestricted parent read.
  const self=await assertSucceeds(get(path(member,access+'/uidA')));
  assert.equal(self.val().personId,p);
  await assertSucceeds(get(path(member,control)));
  const page=await assertSucceeds(get(latest(member)));
  const keys=values(page);
  assert.equal(keys.length,50);
  assert.equal(keys[0],'m006');
  assert.deepEqual(keys.slice(-2),['m054','m055']);
  assert.equal(keys.includes('before'),false);
  assert.equal(keys.includes('atJoin'),false);
  const older=await assertSucceeds(get(query(path(member,history),orderByChild('createdAt'),startAt(1001),endBefore(1006,'m006'),limitToLast(50))));
  assert.deepEqual(values(older),['m001','m002','m003','m004','m005']);
  const tie=await assertSucceeds(get(query(path(member,history),orderByChild('createdAt'),startAt(1001),endBefore(1054,'m055'),limitToLast(50))));
  assert.equal(values(tie).at(-1),'m054');
  assert.equal(values(tie).includes('m055'),false);
  await assertSucceeds(get(path(member,history+'/m055')));
  // A fresh context after a server-side membership change cannot use old grants.
  await env.withSecurityRulesDisabled(admin=>set(path(admin,control+'/members/'+p+'/active'),false));
  const left=env.authenticatedContext('uidA');
  await deny(get(latest(left)));
  await deny(get(path(left,history+'/m055')));
  await env.withSecurityRulesDisabled(admin=>set(path(admin,control+'/members/'+p),{active:true,joinedAt:1053,role:'member'}));
  const rejoined=env.authenticatedContext('uidA');
  await deny(get(latest(rejoined,1001)));
  await deny(get(path(rejoined,history+'/m053')));
  const after=await assertSucceeds(get(latest(rejoined,1054)));
  assert.deepEqual(values(after),['m054','m055']);
  await env.withSecurityRulesDisabled(admin=>set(path(admin,access+'/uidA/active'),false));
  const revoked=env.authenticatedContext('uidA');
  await deny(get(latest(revoked,1054)));
  await deny(get(path(revoked,history+'/m055')));
  console.log('MESSAGING_READ_BOUNDARY_OK');
} finally {
  await env.cleanup();
}
