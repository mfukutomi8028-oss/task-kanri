import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConversationCommand} from '../security/messaging-conversation-commands.mjs';
const a='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),c='p_'+'c'.repeat(32),g='group_g_'+'d'.repeat(32),roomId='roomA';
const context=(personId=a,now=1000,conversationId=g,approvedPersonIds=[a,b,c])=>({personId,roomId,conversationId,now,approvedPersonIds});
const create=(invitees=[b])=>applyConversationCommand(null,{type:'createGroup',title:'Project',invitees},context()).control;
const change=(control,command,personId=a,now=2000)=>applyConversationCommand(control,{...command,expectedRevision:control.revision},context(personId,now));
const accept=(control,personId=b,now=2000)=>change(control,{type:'respondInvite',accept:true},personId,now).control;

test('direct and self creation use canonical IDs and reopen without duplicates',()=>{
  const dm='dm_'+a+'_'+b;
  const first=applyConversationCommand(null,{type:'openDirect',personId:b},context(a,1000,dm));
  assert.equal(first.status,'ok');assert.equal(first.control.kind,'direct');assert.deepEqual(Object.keys(first.control.members).sort(),[a,b]);
  const again=applyConversationCommand(first.control,{type:'openDirect',personId:a},context(b,2000,dm));
  assert.equal(again.changed,false);assert.deepEqual(again.control,first.control);
  const self=applyConversationCommand(null,{type:'openSelf'},context(a,1000,'self_'+a));
  assert.equal(self.status,'ok');assert.deepEqual(Object.keys(self.control.members),[a]);
  assert.deepEqual(applyConversationCommand(null,{type:'openDirect',personId:c},context(a,1000,dm)),{status:'invalid'});
  assert.deepEqual(applyConversationCommand(null,{type:'openDirect',personId:b},context(a,1000,dm,[a])),{status:'forbidden'});
});
test('new group invitations do not grant membership before acceptance',()=>{
  const initial=create();assert.equal(initial.ownerId,a);assert.equal(initial.title,'Project');assert.equal(initial.members[a].role,'owner');
  assert.equal(initial.members[b],undefined);assert.equal(initial.invites[b].state,'pending');
  assert.deepEqual(change(initial,{type:'respondInvite',accept:true},c),{status:'forbidden'});
  const accepted=accept(initial);assert.equal(accepted.members[b].active,true);assert.equal(accepted.members[b].joinedAt,2000);assert.equal(accepted.invites[b].state,'accepted');
  assert.equal(initial.members[b],undefined);assert.equal(initial.revision,1);assert.equal(accepted.revision,2);
});
test('declining an invitation never grants membership',()=>{
  const control=create();const result=change(control,{type:'respondInvite',accept:false},b);
  assert.equal(result.status,'ok');assert.equal(result.control.invites[b].state,'declined');assert.equal(result.control.members[b],undefined);
  assert.deepEqual(change(result.control,{type:'respondInvite',accept:true},b),{status:'forbidden'});
});
test('only active managers can invite and rename, and only approved users may be invited',()=>{
  const control=accept(create());
  assert.deepEqual(change(control,{type:'invite',personIds:[c]},b),{status:'forbidden'});
  assert.deepEqual(change(control,{type:'rename',title:'Other'},b),{status:'forbidden'});
  const invited=change(control,{type:'invite',personIds:[c]});assert.equal(invited.control.invites[c].state,'pending');
  const renamed=change(invited.control,{type:'rename',title:'  Updated  '});assert.equal(renamed.control.title,'Updated');
  assert.deepEqual(applyConversationCommand(control,{type:'invite',personIds:[c],expectedRevision:control.revision},context(a,3000,g,[a,b])),{status:'forbidden'});
});
test('owner must transfer ownership before leaving',()=>{
  const control=accept(create());assert.deepEqual(change(control,{type:'leave'}),{status:'forbidden'});
  assert.deepEqual(change(control,{type:'transferOwner',personId:c}),{status:'forbidden'});
  assert.deepEqual(change(control,{type:'transferOwner',personId:a},b),{status:'forbidden'});
  const moved=change(control,{type:'transferOwner',personId:b}).control;
  assert.equal(moved.ownerId,b);assert.equal(moved.members[b].role,'owner');assert.equal(moved.members[a].role,'admin');
  assert.equal(change(moved,{type:'leave'}).control.members[a].active,false);
});
test('removed and re-invited member receives a fresh join boundary',()=>{
  const control=accept(create());const removed=change(control,{type:'removeMember',personId:b},a,3000).control;
  assert.equal(removed.members[b].active,false);assert.equal(removed.members[b].leftAt,3000);
  assert.deepEqual(change(removed,{type:'rename',title:'Other'},b,3100),{status:'forbidden'});
  const invited=change(removed,{type:'invite',personIds:[b]},a,4000).control;
  assert.equal(invited.members[b].active,false);const rejoined=accept(invited,b,5000);
  assert.equal(rejoined.members[b].joinedAt,5000);assert.equal(rejoined.members[b].leftAt,undefined);
});
test('archive and reopen are management actions, not personal archive',()=>{
  const control=accept(create());assert.deepEqual(change(control,{type:'setArchived',archived:true},b),{status:'forbidden'});
  const archived=change(control,{type:'setArchived',archived:true}).control;assert.equal(archived.status,'archived');
  assert.deepEqual(change(archived,{type:'invite',personIds:[c]}),{status:'forbidden'});
  const resumed=change(archived,{type:'setArchived',archived:false}).control;assert.equal(resumed.status,'active');
});
test('stale revision and invalid requests cannot mutate the control node',()=>{
  const control=accept(create());const before=structuredClone(control);
  assert.deepEqual(applyConversationCommand(control,{type:'rename',title:'Stale',expectedRevision:1},context()),{status:'conflict'});
  assert.deepEqual(change(control,{type:'rename',title:'x'.repeat(81)}),{status:'invalid'});
  assert.deepEqual(change(control,{type:'removeMember',personId:a},b),{status:'forbidden'});
  assert.deepEqual(change(control,{type:'rename',title:'New',ownerId:b}),{status:'invalid'});
  assert.deepEqual(control,before);
});
test('group participant limit includes outstanding invitations',()=>{
  const people=Array.from({length:100},(_,i)=>'p_'+i.toString(16).padStart(32,'0'));
  const atLimit=applyConversationCommand(null,{type:'createGroup',title:'Large group',invitees:people.slice(0,99)},context(a,1000,g,[a,...people]));
  assert.equal(atLimit.status,'ok');assert.equal(Object.keys(atLimit.control.invites).length,99);
  const extra=applyConversationCommand(atLimit.control,{type:'invite',personIds:[people[99]],expectedRevision:1},context(a,2000,g,[a,...people]));
  assert.deepEqual(extra,{status:'limit'});
});
