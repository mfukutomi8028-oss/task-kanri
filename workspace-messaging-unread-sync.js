// Cache per-membership unread summaries, driven by existing authorized metadata
// observers. Never use a cached value as an authorization or history grant.
import {isConversationId,isMessagingRoomId,isMessagingTimestamp,isPersonId,isMessageId} from './workspace-messaging-core.js';
const bound=value=>value?.status==='bound'&&isMessagingRoomId(value.roomId)&&isPersonId(value.personId)?{roomId:value.roomId,personId:value.personId}:null;
const same=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a.roomId===b.roomId&&a.personId===b.personId;
const safely=fn=>{try{fn?.();}catch(_){/* Dispose independently. */}};
function validateSummary(value,actor,entry){
  if(value?.status==='forbidden')return Object.freeze({status:'forbidden'});
  if(value?.status!=='ok'||value.roomId!==actor.roomId||value.personId!==actor.personId||value.conversationId!==entry.id||value.joinedAt!==entry.joinedAt||value.complete!==true||!Number.isInteger(value.unread)||value.unread<0||value.unread>100||typeof value.muted!=='boolean')return null;
  const latest=value.latestIncoming;
  if(latest===null?value.unread!==0:!isMessageId(latest?.id)||latest.id.startsWith('msg_'+actor.personId+'_')||!isMessagingTimestamp(latest.createdAt)||latest.createdAt<=entry.joinedAt)return null;
  return Object.freeze({status:'ok',unread:value.unread,muted:value.muted,latestIncoming:latest===null?null:Object.freeze({id:latest.id,createdAt:latest.createdAt})});
}
export function createMessagingUnreadSync({session,observeActivity,readUnread,maxWatched=100,parallel=4}={}){
  if(typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||typeof observeActivity!=='function'||typeof readUnread!=='function'||!Number.isInteger(maxWatched)||maxWatched<1||maxWatched>100||!Number.isInteger(parallel)||parallel<1||parallel>4)throw new TypeError('Bounded unread adapters required');
  let actor=null,disposed=false,scheduled=false,notifyQueued=false,running=0;
  const entries=new Map(),queue=new Set(),listeners=new Set();
  const current=entry=>!disposed&&actor!==null&&same(actor,bound(session.getSnapshot()))&&entries.get(entry.id)===entry&&!entry.failed;
  function changed(){if(disposed||notifyQueued)return;notifyQueued=true;queueMicrotask(()=>{notifyQueued=false;if(!disposed)for(const fn of [...listeners])if(listeners.has(fn))safely(fn);});}
  function remove(entry){entries.delete(entry.id);queue.delete(entry);entry.version++;entry.failed=true;safely(entry.stop);entry.stop=null;entry.summary=null;}
  function clear(){for(const entry of [...entries.values()])remove(entry);queue.clear();changed();}
  const stopSession=session.subscribe(value=>{const next=bound(value);if(!same(actor,next)){clear();actor=next;}});
  if(typeof stopSession!=='function'){clear();throw new TypeError('Disposable identity required');}
  function fail(entry){if(!current(entry))return;entry.failed=true;entry.version++;entry.summary=null;queue.delete(entry);safely(entry.stop);entry.stop=null;changed();}
  function enqueue(entry){if(!current(entry))return;entry.version++;if(entry.summary!==null){entry.summary=null;changed();}queue.add(entry);pump();}
  function pump(){
    if(disposed||scheduled)return;scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;if(disposed)return;
      for(const entry of queue){
        if(running>=parallel)break;
        if(!current(entry)){queue.delete(entry);continue;}
        if(entry.inflight)continue;
        queue.delete(entry);entry.inflight=true;running++;
        const version=entry.version,scope=actor;
        Promise.resolve().then(()=>current(entry)?readUnread({roomId:scope.roomId,conversationId:entry.id}):null).then(value=>{
          if(!current(entry)||entry.version!==version)return;
          entry.summary=validateSummary(value,scope,entry);changed();
        },()=>{if(current(entry)&&entry.version===version){entry.summary=null;changed();}}).finally(()=>{entry.inflight=false;running--;pump();});
      }
    });
  }
  function watch(row){
    const entry={id:row.id,joinedAt:row.joinedAt,version:0,inflight:false,failed:false,summary:null,stop:null};entries.set(row.id,entry);
    try{
      const stop=observeActivity({roomId:actor.roomId,conversationId:entry.id},()=>enqueue(entry),()=>fail(entry));
      if(typeof stop!=='function'){fail(entry);return;}
      if(current(entry))entry.stop=stop;else safely(stop);
    }catch(_){fail(entry);}
  }
  function setDirectory(snapshot,selected=null,{retryFailed=false,refresh=false}={}){
    if(disposed||!actor||!same(actor,bound(session.getSnapshot()))||snapshot?.roomId!==actor.roomId||snapshot.personId!==actor.personId||!Array.isArray(snapshot.conversations)||snapshot.conversations.length>1000){clear();return;}
    const rows=snapshot.conversations;
    if(rows.some(row=>!isConversationId(row?.id)||!isMessagingTimestamp(row.joinedAt))||new Set(rows.map(row=>row.id)).size!==rows.length){clear();return;}
    const prioritized=[...rows.filter(row=>row.id===selected),...rows.filter(row=>row.id!==selected)].slice(0,maxWatched);
    const desired=new Map(prioritized.map(row=>[row.id,row]));
    for(const entry of [...entries.values()])if(!desired.has(entry.id)||desired.get(entry.id).joinedAt!==entry.joinedAt||retryFailed&&entry.failed)remove(entry);
    for(const row of prioritized){const entry=entries.get(row.id);if(!entry)watch(row);else if(refresh)enqueue(entry);}
  }
  return Object.freeze({setDirectory,read(id,joinedAt){const entry=entries.get(id);return entry&&current(entry)&&entry.joinedAt===joinedAt?entry.summary:null;},subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener required');if(disposed)return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);},dispose(){if(disposed)return;disposed=true;clear();safely(stopSession);listeners.clear();actor=null;}});
}
