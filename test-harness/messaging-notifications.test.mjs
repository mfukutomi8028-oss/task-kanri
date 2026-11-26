import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingNotificationAdapter} from './messaging-preview/workspace-messaging-notifications.js';
const p='p_'+'a'.repeat(32),b='p_'+'b'.repeat(32),c='p_'+'c'.repeat(32),roomId='roomA';
const group='group_g_'+'d'.repeat(32),other='group_g_'+'e'.repeat(32),inviteGroup='group_g_'+'f'.repeat(32);
const identity={roomId,personId:p};
const msg=(n,sender=b,createdAt=2000+n)=>({id:'msg_'+sender+'_q_'+n.toString(16).padStart(32,'0'),createdAt});
const row=(patch={})=>({id:group,joinedAt:1000,unread:1,muted:false,latestIncoming:msg(1),...patch});
const snapshot=(rows,invites=[],complete=true)=>({...identity,conversations:rows,invites,complete});
function fixture(){const events=[];const adapter=createMessagingNotificationAdapter({notify:event=>events.push(event)});adapter.bind(identity);return {adapter,events};}
test('initial snapshot exposes unread including muted conversations without replaying old notices',()=>{
  const f=fixture();const result=f.adapter.sync(snapshot([row(),row({id:other,unread:3,muted:true,latestIncoming:msg(2)})]));
  assert.deepEqual(result,{status:'ok',unread:4,unreadLabel:'4',invites:0,complete:true});assert.deepEqual(f.events,[]);
});
test('new incoming cursor emits once across reconnect and older snapshots',()=>{
  const f=fixture();f.adapter.sync(snapshot([row()]));f.adapter.bind(identity);
  const next=snapshot([row({unread:2,latestIncoming:msg(2)})]);f.adapter.sync(next);f.adapter.sync(next);f.adapter.sync(snapshot([row()]));f.adapter.sync(next);
  assert.deepEqual(f.events,[{kind:'message',roomId,personId:p,conversationId:group,messageId:msg(2).id}]);
});
test('mute and active foreground suppress notices but keep unread and do not replay when unmuted',()=>{
  const f=fixture();f.adapter.sync(snapshot([row()]));
  assert.equal(f.adapter.sync(snapshot([row({muted:true,latestIncoming:msg(2),unread:2})])).unread,2);
  f.adapter.sync(snapshot([row({latestIncoming:msg(2),unread:2})]));
  f.adapter.sync(snapshot([row({latestIncoming:msg(3),unread:3})]),{activeConversationId:group,foreground:true});
  f.adapter.sync(snapshot([row({latestIncoming:msg(3),unread:3})]));assert.deepEqual(f.events,[]);
  f.adapter.sync(snapshot([row({latestIncoming:msg(4),unread:4})]),{activeConversationId:group,foreground:false});assert.equal(f.events.length,1);
});
test('pending invitations are distinct and cannot be replayed on reconnect',()=>{
  const f=fixture(),inv={conversationId:inviteGroup,invitedBy:b,invitedAt:3000};f.adapter.sync(snapshot([]));
  f.adapter.sync(snapshot([],[inv]));f.adapter.sync(snapshot([],[inv]));f.adapter.sync(snapshot([]));f.adapter.sync(snapshot([],[inv]));
  assert.deepEqual(f.events,[{kind:'invite',roomId,personId:p,conversationId:inviteGroup,invitedAt:3000}]);
  assert.equal(f.adapter.sync(snapshot([],[{...inv,invitedAt:4000}])).invites,1);assert.equal(f.events.length,2);
});
test('unread excludes own message identity and old membership epochs',()=>{
  const f=fixture();f.adapter.sync(snapshot([row()]));
  for(const patch of [{latestIncoming:msg(2,p)},{joinedAt:2002,latestIncoming:msg(2)},{latestIncoming:null},{unread:-1}])assert.deepEqual(f.adapter.sync(snapshot([row(patch)])),{status:'invalid'});
  f.adapter.sync(snapshot([row({joinedAt:2005,latestIncoming:msg(6)})]));assert.deepEqual(f.events,[]);
});
test('identity changes reset baseline and reject stale account responses',()=>{
  const f=fixture();f.adapter.sync(snapshot([row()]));f.adapter.bind({roomId,personId:c});
  assert.deepEqual(f.adapter.sync(snapshot([row({latestIncoming:msg(2)})])),{status:'locked'});
  f.adapter.sync({...snapshot([row({latestIncoming:msg(3)})]),personId:c});assert.deepEqual(f.events,[]);
  f.adapter.bind(null);assert.deepEqual(f.adapter.sync(snapshot([])),{status:'locked'});f.adapter.dispose();assert.deepEqual(f.adapter.sync(snapshot([])),{status:'locked'});
});
test('badge saturates at 99+ and partial snapshots are not reported as global counts',()=>{
  const f=fixture();const result=f.adapter.sync(snapshot([row({unread:70}),row({id:other,unread:45,latestIncoming:msg(2)})],[],false));
  assert.deepEqual(result,{status:'ok',unread:100,unreadLabel:'99+',invites:0,complete:false});
  assert.deepEqual(f.adapter.sync(snapshot([row(),row()])),{status:'invalid'});
});
test('a stale prior membership snapshot cannot restore an old unread count',()=>{
  const f=fixture();f.adapter.sync(snapshot([row()]));
  f.adapter.sync(snapshot([row({joinedAt:2005,unread:0,latestIncoming:null})]));
  assert.deepEqual(f.adapter.sync(snapshot([row({unread:20})])),{status:'stale'});
  assert.deepEqual(f.events,[]);
});
