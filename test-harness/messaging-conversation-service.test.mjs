import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingConversationService} from '../security/messaging-conversation-service.mjs';
const roomId='roomA',a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),c='p_'+'c'.repeat(32),group='group_g_'+'1'.repeat(32),dm='dm_'+a+'_'+b;
function fixture(){
  const bindings=new Map([['uidA',{uid:'uidA',roomId,personId:a,approved:true,active:true}],['uidB',{uid:'uidB',roomId,personId:b,approved:true,active:true}],['uidC',{uid:'uidC',roomId,personId:c,approved:false,active:true}]]);
  const roster={revision:1,people:{[a]:{displayName:'Person A'},[b]:{displayName:'Person B'}}},controls=new Map(),repairs=[],scopes=[];
  let now=1000,indexFails=false,beforeCommit=()=>{},afterRepair=()=>{};
  const service=createMessagingConversationService({verifyToken:async token=>({uid:token}),readBinding:async({roomId:room,uid})=>room===roomId?structuredClone(bindings.get(uid)??null):null,readRoster:async()=>structuredClone(roster),clock:()=>now,
    async transactControl(scope,decide){scopes.push(scope);await beforeCommit();const binding=bindings.get(scope.uid);if(binding?.active!==true||binding.approved!==true||binding.personId!==scope.personId||roster.revision!==scope.rosterRevision)return {status:'forbidden'};
      const decision=decide(structuredClone(controls.get(scope.conversationId)??null));if(decision.changed)controls.set(scope.conversationId,structuredClone(decision.control));return {status:'ok',decision};},
    async reconcileIndex(scope){repairs.push(scope);await afterRepair();return indexFails?{status:'unavailable'}:{status:'ok'};}
  });
  const call=(command,token='uidA',conversationId=group,patch={})=>service.execute({token,roomId,conversationId,command,...patch});
  const create=()=>call({type:'createGroup',title:'Project',invitees:[b]});
  return {bindings,roster,controls,repairs,scopes,call,create,service,setNow(v){now=v;},failIndex(v){indexFails=v;},beforeCommit(fn){beforeCommit=fn;},afterRepair(fn){afterRepair=fn;}};
}
test('create, accept and remove use the trusted actor and repair the same canonical index',async()=>{
  const f=fixture();assert.deepEqual(await f.create(),{status:'ok',conversationId:group,revision:1,indexPending:false});
  assert.deepEqual(f.scopes[0],{uid:'uidA',personId:a,roomId,conversationId:group,rosterRevision:1});assert.equal(f.controls.get(group).invites[b].state,'pending');
  f.setNow(2000);assert.deepEqual(await f.call({type:'respondInvite',accept:true,expectedRevision:1},'uidB'),{status:'ok',conversationId:group,revision:2,indexPending:false});
  assert.equal(f.controls.get(group).members[b].joinedAt,2000);f.setNow(3000);assert.equal((await f.call({type:'removeMember',personId:b,expectedRevision:2})).status,'ok');assert.equal(f.controls.get(group).members[b].active,false);
  assert.deepEqual(f.repairs,[{roomId,conversationId:group},{roomId,conversationId:group},{roomId,conversationId:group}]);
});
test('unapproved device, target outside roster and forged request actor do not create a control',async()=>{
  const f=fixture();assert.deepEqual(await f.call({type:'createGroup',title:'Project',invitees:[b]},'uidC'),{status:'forbidden'});
  assert.deepEqual(await f.call({type:'createGroup',title:'Project',invitees:[c]}),{status:'forbidden'});
  assert.deepEqual(await f.call({type:'createGroup',title:'Project',invitees:[b]},'uidA',group,{personId:b}),{status:'invalid'});
  assert.equal(f.controls.size,0);assert.equal(f.repairs.length,0);
});
test('device approval or roster version changed before persistence prevents the command',async()=>{
  for(const mutate of [f=>{f.bindings.get('uidA').active=false;},f=>{f.roster.revision++;delete f.roster.people[b];}]){
    const f=fixture();f.beforeCommit(()=>mutate(f));assert.deepEqual(await f.create(),{status:'forbidden'});assert.equal(f.controls.size,0);assert.equal(f.repairs.length,0);
  }
});
test('concurrent commands from the same revision produce a single successful update',async()=>{
  const f=fixture();await f.create();f.setNow(2000);const results=await Promise.all([f.call({type:'rename',title:'First',expectedRevision:1}),f.call({type:'rename',title:'Second',expectedRevision:1})]);assert.deepEqual(results.map(r=>r.status).sort(),['conflict','ok']);assert.equal(f.controls.get(group).revision,2);assert.equal(f.repairs.length,2);
});
test('committed control is not reported as a failed mutation if its derived index repair fails',async()=>{
  const f=fixture();f.failIndex(true);assert.deepEqual(await f.call({type:'openDirect',personId:b},'uidA',dm),{status:'ok',conversationId:dm,revision:1,indexPending:true});assert.equal(f.controls.get(dm).revision,1);
  f.setNow(2000);f.failIndex(false);assert.deepEqual(await f.call({type:'openDirect',personId:a},'uidB',dm),{status:'ok',conversationId:dm,revision:1,indexPending:false});assert.equal(f.controls.size,1);assert.equal(f.repairs.length,2);
});
test('directory for starting conversations returns approved display names but not device IDs',async()=>{
  const f=fixture();assert.deepEqual(await f.service.readPeople({token:'uidA',roomId}),{status:'ok',roomId,personId:a,people:[{personId:a,displayName:'Person A'},{personId:b,displayName:'Person B'}]});assert.deepEqual(await f.service.readPeople({token:'uidC',roomId}),{status:'forbidden'});
});
test('changed identity after a committed operation does not disclose its result',async()=>{
  const f=fixture();f.afterRepair(()=>{f.bindings.get('uidA').active=false;});assert.deepEqual(await f.create(),{status:'forbidden'});assert.equal(f.controls.get(group).revision,1);
});

test('the bound person assertion rejects a different token before conversation creation or roster retrieval',async()=>{
  const f=fixture();assert.deepEqual(await f.call({type:'createGroup',title:'Project',invitees:[b]},'uidA',group,{expectedPersonId:b}),{status:'forbidden'});assert.equal(f.scopes.length,0);
  assert.deepEqual(await f.service.readPeople({token:'uidA',roomId,expectedPersonId:b}),{status:'forbidden'});
  assert.equal((await f.call({type:'createGroup',title:'Project',invitees:[b]},'uidA',group,{expectedPersonId:a})).status,'ok');
});
