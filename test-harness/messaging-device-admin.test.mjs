import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingDeviceAdmin} from '../security/messaging-device-admin-service.mjs';
const roomId='roomA',personId='p_'+'a'.repeat(32),otherId='p_'+'b'.repeat(32),uid='deviceA',displayName='Alice';
const register={action:'register-person',roomId,personId,displayName};
const approve={action:'approve-device',roomId,personId,displayName,uid};
const revoke={action:'revoke-device',roomId,personId,uid};
function fixture(){
  let roster=null,bindings=new Map(),users=new Map([[uid,{uid,disabled:false}],['deviceB',{uid:'deviceB',disabled:false}]]),writes=[],reads=[],beforeBinding=()=>{};
  const key=scope=>scope.roomId+'/'+scope.uid;
  const admin=createMessagingDeviceAdmin({lookupUid:async id=>{reads.push('auth');return users.get(id)??null;},readRoster:async()=>{reads.push('roster');return structuredClone(roster);},readBinding:async scope=>{reads.push('binding');return structuredClone(bindings.get(key(scope))??null);},
   async transactRoster(scope,decide){const decision=decide(structuredClone(roster));if(decision.changed){roster=structuredClone(decision.value);writes.push('roster');}return {decision,committed:decision.changed===true};},
   async transactBinding(scope,decide){beforeBinding(scope);const decision=decide(structuredClone(bindings.get(key(scope))??null));if(decision.changed){bindings.set(key(scope),structuredClone(decision.value));writes.push('binding');}return {decision,committed:decision.changed===true};}});
  return {admin,writes,reads,users,get roster(){return roster;},binding:id=>bindings.get(roomId+'/'+id),setBinding:(id,value)=>bindings.set(roomId+'/'+id,value),race:fn=>{beforeBinding=fn;}};
}
test('dry run makes no write and registration creates a revisioned stable roster entry only on apply',async()=>{
 const f=fixture();assert.deepEqual(await f.admin.run(register),{status:'ok',changed:true,applied:false});assert.equal(f.roster,null);assert.deepEqual(f.writes,[]);
 assert.deepEqual(await f.admin.run(register,{apply:true}),{status:'ok',changed:true,applied:true});assert.deepEqual(f.roster,{revision:1,people:{[personId]:{displayName}}});assert.deepEqual(await f.admin.run(register,{apply:true}),{status:'ok',changed:false,applied:false});assert.equal(f.writes.length,1);
});
test('duplicate display names and changing an existing person id are refused',async()=>{
 const f=fixture();await f.admin.run(register,{apply:true});assert.equal((await f.admin.run({...register,personId:otherId},{apply:true})).status,'conflict');assert.equal((await f.admin.run({...register,displayName:'Bob'},{apply:true})).status,'conflict');assert.equal((await f.admin.run({...register,personId:otherId,displayName:'Bob'},{apply:true})).status,'ok');assert.equal(f.roster.revision,2);
});
test('approval requires a registered exact person and an existing enabled Firebase UID',async()=>{
 const f=fixture();assert.equal((await f.admin.run(approve,{apply:true})).status,'forbidden');await f.admin.run(register,{apply:true});assert.equal((await f.admin.run({...approve,displayName:'Bob'},{apply:true})).status,'forbidden');assert.equal((await f.admin.run({...approve,uid:'missing'},{apply:true})).status,'forbidden');f.users.set(uid,{uid,disabled:true});assert.equal((await f.admin.run(approve,{apply:true})).status,'forbidden');assert.equal(f.binding(uid),undefined);assert.deepEqual(f.writes,['roster']);
});
test('the same registered person can have two approved devices but an existing device cannot be rebound',async()=>{
 const f=fixture();await f.admin.run(register,{apply:true});await f.admin.run({...register,personId:otherId,displayName:'Bob'},{apply:true});assert.equal((await f.admin.run(approve)).applied,false);assert.equal(f.binding(uid),undefined);assert.equal((await f.admin.run(approve,{apply:true})).applied,true);assert.equal((await f.admin.run({...approve,uid:'deviceB'},{apply:true})).applied,true);assert.deepEqual(f.binding(uid),{uid,roomId,personId,displayName,approved:true,active:true});assert.equal(f.binding('deviceB').personId,personId);assert.equal((await f.admin.run({...approve,personId:otherId,displayName:'Bob'},{apply:true})).status,'conflict');assert.equal(f.binding(uid).personId,personId);
});
test('revocation retains the binding, does not change another device, and requires explicit reactivation',async()=>{
 const f=fixture();await f.admin.run(register,{apply:true});await f.admin.run(approve,{apply:true});await f.admin.run({...approve,uid:'deviceB'},{apply:true});assert.equal((await f.admin.run({...revoke,personId:otherId},{apply:true})).status,'conflict');assert.equal((await f.admin.run(revoke,{apply:true})).applied,true);assert.deepEqual(f.binding(uid),{uid,roomId,personId,displayName,approved:false,active:false});assert.equal(f.binding('deviceB').active,true);assert.equal((await f.admin.run(approve,{apply:true})).status,'conflict');assert.equal((await f.admin.run({...approve,reactivate:true},{apply:true})).applied,true);assert.equal(f.binding(uid).approved,true);
});
test('apply rechecks current binding inside the transaction and refuses concurrent reassignment',async()=>{
 const f=fixture();await f.admin.run(register,{apply:true});f.race(()=>f.setBinding(uid,{uid,roomId,personId:otherId,displayName:'Bob',approved:true,active:true}));assert.equal((await f.admin.run(approve,{apply:true})).status,'conflict');assert.equal(f.binding(uid).personId,otherId);assert.deepEqual(f.writes,['roster']);
});
test('invalid paths or unrecognized arguments fail before reading Firebase',async()=>{
 const f=fixture();for(const patch of [{roomId:'a/b'},{roomId:'__proto__'},{uid:'bad/uid'},{uid:'constructor'},{personId:'Alice'},{displayName:' Alice'},{extra:true}])assert.equal((await f.admin.run({...approve,...patch},{apply:true})).status,'invalid');assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);
});
