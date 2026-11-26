import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../workspace-messaging-notifications.js';
const roomId='roomA',personId='p_'+'a'.repeat(32),peer='p_'+'b'.repeat(32),id='group_g_'+'c'.repeat(32),inviteId='group_g_'+'d'.repeat(32);
const actor={status:'bound',roomId,personId};
const row=(n,muted=false)=>({id,joinedAt:1000,unread:n,muted,latestIncoming:n?{id:'msg_'+peer+'_q_'+String(n).padStart(32,'0'),createdAt:2000+n}:null});
const snapshot=(n,muted=false,complete=true)=>({status:'ok',roomId,personId,conversations:[row(n,muted)],invites:[],complete});
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){let identity=actor,listener;const summaries=[],events=[],calls=[],pending=[];const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
 const owner=mod.createMessagingSummaryOwner({session,readList:opts=>{calls.push(opts);return new Promise(resolve=>pending.push(resolve));},onSummary:value=>summaries.push(value),notify:event=>events.push(event)});
 return {owner,summaries,events,calls,pending,identity(value){identity=value;listener?.(value);}};
}
test('one notification watermark survives open, close and reopen; background emits only new unmuted messages',async()=>{
 const f=fixture();f.owner.setWorkspaceOpen(true);f.owner.sync(snapshot(1));assert.equal(f.summaries.at(-1).unread,1);assert.deepEqual(f.events,[]);
 f.owner.setWorkspaceOpen(false);await turn();assert.equal(f.calls.length,1);f.pending[0](snapshot(2));await turn();assert.equal(f.summaries.at(-1).unread,2);assert.deepEqual(f.events.map(e=>e.kind),['message']);
 f.owner.setWorkspaceOpen(true);f.owner.sync(snapshot(2));f.owner.sync(snapshot(3,true));assert.equal(f.summaries.at(-1).unread,3);assert.equal(f.events.length,1);f.owner.dispose();
});
test('background coalesces signals and prioritizes full refresh without rereading for each cached update',async()=>{
 const f=fixture();f.owner.setWorkspaceOpen(false);await turn();assert.equal(f.calls.length,1);f.owner.refresh({cached:true});f.owner.refresh({cached:true});f.owner.refresh();f.pending[0](snapshot(1));await turn();assert.equal(f.calls.length,2);assert.equal(f.calls[1].cached,false);f.pending[1](snapshot(2));await turn();assert.equal(f.calls.length,2);f.owner.dispose();
});
test('opening the workspace or changing identity prevents a late background response from replacing counts',async()=>{
 const f=fixture();f.owner.setWorkspaceOpen(false);await turn();f.owner.setWorkspaceOpen(true);f.owner.sync(snapshot(1));f.pending[0](snapshot(8));await turn();assert.equal(f.summaries.at(-1).unread,1);f.owner.setWorkspaceOpen(false);await turn();f.identity({status:'locked'});assert.equal(f.summaries.at(-1),null);f.pending[1](snapshot(9));await turn();assert.equal(f.summaries.at(-1),null);assert.deepEqual(f.events,[]);f.owner.dispose();
});
test('unknown and unavailable summaries never masquerade as zero, and lock clears invite metadata',async()=>{
 const f=fixture();f.owner.setWorkspaceOpen(true);f.owner.sync({...snapshot(0),conversations:[{...row(0),unread:null}],complete:false,invites:[{conversationId:inviteId,invitedBy:peer,invitedAt:3000}]});assert.equal(f.summaries.at(-1).complete,false);assert.equal(f.summaries.at(-1).invites,1);f.owner.unavailable();assert.equal(f.summaries.at(-1),null);f.identity({status:'locked'});assert.equal(f.owner.sync(snapshot(5)).status,'locked');assert.equal(f.summaries.at(-1),null);f.owner.dispose();
});
