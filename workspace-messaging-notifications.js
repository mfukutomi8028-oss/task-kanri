// Notification projection from the authorized conversation summary, not history.
// This adapter has no database writer, background subscription or legacy inbox cache.
import {isMessagingRoomId,isPersonId,isConversationId,isMessageId,isMessagingTimestamp,compareCursor} from './workspace-messaging-core.js';
const status=value=>({status:value});
const validIdentity=value=>isMessagingRoomId(value?.roomId)&&isPersonId(value?.personId);
const sameIdentity=(a,b)=>a&&b&&a.roomId===b.roomId&&a.personId===b.personId;
const MAX_ROWS=1000;
function validRow(row,personId){
  const latest=row?.latestIncoming;
  return isConversationId(row?.id)&&isMessagingTimestamp(row.joinedAt)&&Number.isSafeInteger(row.unread)&&row.unread>=0&&row.unread<=100&&typeof row.muted==='boolean'
    &&(latest===null?row.unread===0:isMessageId(latest?.id)&&!latest.id.startsWith('msg_'+personId+'_')&&isMessagingTimestamp(latest.createdAt)&&latest.createdAt>row.joinedAt);
}
function validInvite(invite,personId){return isConversationId(invite?.conversationId)&&invite.conversationId.startsWith('group_')&&isPersonId(invite.invitedBy)&&invite.invitedBy!==personId&&isMessagingTimestamp(invite.invitedAt);}
export function createMessagingNotificationAdapter({notify}={}){
  if(typeof notify!=='function')throw new TypeError('Notification sink required');
  let identity=null,initialized=false,complete=false,disposed=false;
  const newest=new Map(),inviteWatermarks=new Map();
  function clear(){newest.clear();inviteWatermarks.clear();initialized=false;complete=false;}
  function bind(value){
    if(disposed)return status('locked');
    if(value===null){identity=null;clear();return status('ok');}
    if(!validIdentity(value))return status('invalid');
    if(!sameIdentity(identity,value)){clear();identity={roomId:value.roomId,personId:value.personId};}
    return status('ok');
  }
  function sync(snapshot,{activeConversationId=null,foreground=false}={}){
    if(disposed||!sameIdentity(identity,snapshot))return status('locked');
    const {conversations,invites,complete:full}=snapshot;
    if(!Array.isArray(conversations)||conversations.length>MAX_ROWS||!Array.isArray(invites)||invites.length>MAX_ROWS||typeof full!=='boolean'
      ||conversations.some(row=>!validRow(row,identity.personId))||invites.some(invite=>!validInvite(invite,identity.personId))
      ||new Set(conversations.map(row=>row.id)).size!==conversations.length||new Set(invites.map(invite=>invite.conversationId)).size!==invites.length)return status('invalid');
    if(conversations.some(row=>newest.has(row.id)&&row.joinedAt<newest.get(row.id).joinedAt))return status('stale');
    const events=[];let unread=0;
    for(const row of conversations){
      unread=Math.min(100,unread+row.unread);
      const previous=newest.get(row.id);
      const sameEpoch=previous?.joinedAt===row.joinedAt;
      const latest=row.latestIncoming;
      const advanced=latest!==null&&(!sameEpoch||previous.latest===null||compareCursor(latest,previous.latest)>0);
      if(!sameEpoch||advanced)newest.set(row.id,{joinedAt:row.joinedAt,latest:latest===null?null:{id:latest.id,createdAt:latest.createdAt}});
      // New membership is a new visibility boundary; do not replay its history.
      // When the previous list was partial, first appearances may be old rows.
      if(initialized&&advanced&&(sameEpoch||!previous&&complete)&&row.unread>0&&!row.muted&&!(foreground&&activeConversationId===row.id))events.push({kind:'message',...identity,conversationId:row.id,messageId:latest.id});
    }
    for(const invite of invites){
      const prior=inviteWatermarks.get(invite.conversationId);
      if(prior!==undefined&&invite.invitedAt<=prior)continue;
      inviteWatermarks.set(invite.conversationId,invite.invitedAt);
      if(initialized&&(prior!==undefined||complete))events.push({kind:'invite',...identity,conversationId:invite.conversationId,invitedAt:invite.invitedAt});
    }
    initialized=true;complete=full;
    for(const event of events){if(disposed||!sameIdentity(identity,event))break;try{notify(Object.freeze(event));}catch(_){/* A presentation error cannot duplicate an event. */}}
    return {status:'ok',unread,unreadLabel:unread>=100?'99+':String(unread),invites:invites.length,complete:full};
  }
  return Object.freeze({bind,sync,dispose(){disposed=true;identity=null;clear();}});
}

// One owner survives opening and closing the workspace. Background work uses
// the same authorized directory and unread cache, never message history.
export function createMessagingSummaryOwner({session,readList,onSummary,notify}={}){
  if(typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||[readList,onSummary,notify].some(fn=>typeof fn!=='function'))throw new TypeError('Messaging summary adapters required');
  let actor=null,workspaceOpen=true,disposed=false,epoch=0,pending=false,queued=null,summary=null;
  const safely=fn=>{try{fn();}catch(_){/* Presentation failure cannot affect authorization. */}};
  const bound=value=>value?.status==='bound'&&validIdentity(value)?{roomId:value.roomId,personId:value.personId}:null;
  const current=()=>!disposed&&actor!==null&&sameIdentity(actor,bound(session.getSnapshot()));
  const adapter=createMessagingNotificationAdapter({notify:event=>{if(current())safely(()=>notify(event));}});
  function publish(value){if(JSON.stringify(summary)===JSON.stringify(value))return;summary=value;safely(()=>onSummary(value));}
  function unavailable(){publish(null);}
  function sync(snapshot,options){
    if(!current()||!sameIdentity(actor,snapshot))return status('locked');
    if(!Array.isArray(snapshot.conversations)||!Array.isArray(snapshot.invites)||typeof snapshot.complete!=='boolean'){unavailable();return status('invalid');}
    const known=snapshot.conversations.filter(row=>Number.isSafeInteger(row?.unread));
    const next=adapter.sync({...snapshot,conversations:known,complete:snapshot.complete&&known.length===snapshot.conversations.length},options);
    if(next.status==='ok'&&current())publish(Object.freeze(next));else if(current())unavailable();
    return next;
  }
  function refresh(options={}){
    if(!current()||workspaceOpen)return;
    const cached=options.cached===true;
    queued={cached:queued===null?cached:queued.cached&&cached};
    if(pending)return;
    pending=true;
    queueMicrotask(async()=>{
      try{while(queued&&current()&&!workspaceOpen){
        const request=queued,token=epoch;queued=null;
        try{const result=await readList(request);if(token!==epoch||!current()||workspaceOpen)continue;if(result?.status==='ok')sync(result);else unavailable();}
        catch(_){if(token===epoch&&current()&&!workspaceOpen)unavailable();}
      }}finally{pending=false;if(queued&&current()&&!workspaceOpen)refresh(queued);}
    });
  }
  function setWorkspaceOpen(value){if(disposed||workspaceOpen===(value===true))return;workspaceOpen=value===true;epoch++;queued=null;if(!workspaceOpen)refresh();}
  const stop=session.subscribe(value=>{const next=bound(value);if(actor===null&&next===null||sameIdentity(actor,next))return;epoch++;queued=null;actor=next;adapter.bind(next);unavailable();if(!workspaceOpen)refresh();});
  if(typeof stop!=='function'){adapter.dispose();throw new TypeError('Disposable identity required');}
  return Object.freeze({sync,unavailable,refresh,setWorkspaceOpen,getSnapshot:()=>summary,dispose(){if(disposed)return;disposed=true;epoch++;queued=null;safely(stop);actor=null;adapter.dispose();unavailable();}});
}
