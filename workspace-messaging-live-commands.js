// Adapter from the authorized cloud directory to the Origin messaging view.
// Live unread projections reuse authorized metadata and do not re-query the directory.
import {isMessagingRoomId,isPersonId,isConversationId,isMessageId,isMessagingTimestamp,conversationIdFor} from './workspace-messaging-core.js';
const fail=status=>({status});
const bound=v=>v?.status==='bound'&&isMessagingRoomId(v.roomId)&&isPersonId(v.personId)?{roomId:v.roomId,personId:v.personId}:null;
const same=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a.roomId===b.roomId&&a.personId===b.personId;
const validName=v=>typeof v==='string'&&v.length>0&&v.length<=64&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
const preferenceKeys=['favorite','muted','pinned','archived'];
const newGroupId=()=> 'g_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
function validUnread(v,actor,row){
  return v?.status==='ok'&&v.roomId===actor.roomId&&v.personId===actor.personId&&v.conversationId===row.id&&v.joinedAt===row.joinedAt&&v.complete===true&&Number.isSafeInteger(v.unread)&&v.unread>=0&&v.unread<=100&&typeof v.muted==='boolean'&&(v.latestIncoming===null?v.unread===0:isMessageId(v.latestIncoming?.id)&&!v.latestIncoming.id.startsWith('msg_'+actor.personId+'_')&&isMessagingTimestamp(v.latestIncoming.createdAt)&&v.latestIncoming.createdAt>row.joinedAt);
}
export function createMessagingLiveCommands({session,directory,api,personal,activeConversation,makeGroupId=newGroupId,unreadSync=null}={}){
  if(typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||typeof directory?.refresh!=='function'||typeof directory?.getSnapshot!=='function'||['readPeople','readUnread','executeConversation'].some(k=>typeof api?.[k]!=='function')||typeof personal?.readPersonalState!=='function'||typeof activeConversation!=='function'||typeof makeGroupId!=='function'||unreadSync!==null&&['setDirectory','read','subscribe'].some(k=>typeof unreadSync[k]!=='function'))throw new TypeError('Authorized messaging adapters required');
  let actor=null,generation=0,disposed=false,roster=new Map(),invitations=new Map(),groupAttempt=null,commandPending=false,listSequence=0,projection=null,pendingSeq=null,projectionQueued=false,projectionScheduled=false;
  const listeners=new Set();
  function changed(options){for(const fn of [...listeners])if(listeners.has(fn))try{fn(options);}catch(_){/* View errors do not change committed results. */}}
  const current=token=>!disposed&&actor!==null&&token===generation&&same(actor,bound(session.getSnapshot()));
  const stop=session.subscribe(value=>{const next=bound(value);if(!same(actor,next)){actor=next;generation++;roster.clear();invitations.clear();groupAttempt=null;commandPending=false;projection=null;pendingSeq=null;projectionQueued=false;}});
  if(typeof stop!=='function')throw new TypeError('Disposable session required');
  function notifyProjection(){
    if(!current(generation)||!projection)return;
    if(pendingSeq!==null){projectionQueued=true;return;}
    if(projectionScheduled)return;projectionScheduled=true;
    const token=generation;
    queueMicrotask(()=>{projectionScheduled=false;if(current(token)&&projection){if(pendingSeq!==null)projectionQueued=true;else changed({cached:true});}});
  }
  const stopUnread=unreadSync?.subscribe(notifyProjection);
  if(unreadSync&&typeof stopUnread!=='function'){stop();throw new TypeError('Disposable unread observer required');}
  async function loadPeople(token){
    if(!current(token))return null;
    const scope=actor,result=await api.readPeople({roomId:scope.roomId});
    if(!current(token)||result?.status!=='ok'||result.roomId!==scope.roomId||result.personId!==scope.personId||!Array.isArray(result.people)||result.people.length>1000)return null;
    const next=new Map();for(const row of result.people){if(!isPersonId(row?.personId)||!validName(row.displayName)||next.has(row.personId))return null;next.set(row.personId,row.displayName);}
    if(!next.has(scope.personId))return null;return next;
  }
  function project({scope,snapshot,people,selected,preferences,summary}){
    const rows=[];let directoryComplete=snapshot.complete;
    for(const source of snapshot.conversations){
      const row={...source,title:source.kind==='self'?'\u81ea\u5206\u5b9b\u3066\u30e1\u30c3\u30bb\u30fc\u30b8':source.kind==='direct'?people.get(source.peerId)||'\u5229\u7528\u8005':source.title,unread:null,latestIncoming:null,updatedAt:source.controlUpdatedAt,archived:source.status==='archived'};
      const isSelected=row.id===selected&&activeConversation()===selected;
      const unread=unreadSync?unreadSync.read(row.id,row.joinedAt):isSelected?summary:null;
      const personalState=isSelected?preferences:null;
      if([unread?.status,personalState?.status].some(status=>status==='forbidden'||status==='locked')){directoryComplete=false;continue;}
      const saved=source.preferences??personalState?.preferences;
      const hasDirectoryPreferences=preferenceKeys.every(key=>typeof source.preferences?.[key]==='boolean');
      if(preferenceKeys.every(key=>typeof saved?.[key]==='boolean')){
        Object.assign(row,saved,{archived:row.status==='archived'||saved.archived});
      }else if(source.preferences===null){row.preferencesUnavailable=true;directoryComplete=false;}
      if(unreadSync?unread?.status==='ok':validUnread(unread,scope,row))Object.assign(row,{unread:unread.unread,latestIncoming:unread.latestIncoming,muted:hasDirectoryPreferences?saved.muted:unread.muted,updatedAt:Math.max(row.updatedAt,unread.latestIncoming?.createdAt??0)});
      rows.push(row);
    }
    return {status:'ok',...scope,conversations:rows,invites:[...invitations.values()],directoryComplete,complete:directoryComplete&&rows.every(row=>row.unread!==null)};
  }
  async function list({cached=false,retryUnread=false}={}){
    const token=generation;if(!current(token))return fail('locked');
    if(cached&&unreadSync)return projection?project(projection):fail('unavailable');
    const seq=++listSequence;pendingSeq=seq;
    const scope=actor,selected=activeConversation();
    try{
      const [refresh,people]=await Promise.all([directory.refresh(),loadPeople(token)]);
      if(!current(token)||seq!==listSequence)return fail('locked');
      const snapshot=directory.getSnapshot();
      if(refresh?.status!=='ok'||!people||snapshot.status!=='ready'||!same(scope,snapshot))throw Error('Unavailable');
      const row=snapshot.conversations.find(v=>v.id===selected);let summary=null,preferences=null;
      if(row&&(!unreadSync||row.preferences===undefined)){
        const target={roomId:scope.roomId,conversationId:row.id};
        [summary,preferences]=await Promise.all([unreadSync?null:api.readUnread(target),personal.readPersonalState({...target,personId:scope.personId,joinedAt:row.joinedAt})]);
        if(!current(token)||seq!==listSequence)return fail('locked');
      }
      roster=people;invitations=new Map(snapshot.invites.map(row=>[row.conversationId,row]));
      projection={scope,snapshot,people,selected,preferences,summary};
      unreadSync?.setDirectory(snapshot,selected,{retryFailed:retryUnread,refresh:retryUnread});
      return project(projection);
    }catch(_){if(current(token)&&seq===listSequence){roster.clear();invitations.clear();projection=null;unreadSync?.setDirectory(null);}return fail(current(token)?'unavailable':'locked');}
    finally{if(pendingSeq===seq){pendingSeq=null;if(projectionQueued){projectionQueued=false;notifyProjection();}}}
  }
  async function users(){const token=generation;try{const people=await loadPeople(token);if(!people||!current(token))return [];roster=people;return [...people].filter(([id])=>id!==actor.personId).map(([personId,displayName])=>({personId,displayName}));}catch(_){return [];}}
  async function execute(conversationId,command){
    const token=generation;if(!current(token))return fail('locked');if(commandPending)return fail('busy');commandPending=true;
    try{const result=await api.executeConversation({roomId:actor.roomId,conversationId,command});if(!current(token))return fail('locked');if(result?.status==='ok'){if(result.conversationId!==conversationId)return fail('unavailable');changed();}return result??fail('unavailable');}catch(_){return fail(current(token)?'unavailable':'locked');}finally{if(current(token))commandPending=false;}
  }
  return Object.freeze({list,users,resolvePerson:id=>current(generation)?roster.get(id)??null:null,subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener required');listeners.add(fn);return ()=>listeners.delete(fn);},invalidate:changed,
    openSelf(){if(!current(generation))return Promise.resolve(fail('locked'));return execute(conversationIdFor({...actor,kind:'self',personIds:[actor.personId]}),{type:'openSelf'});},
    openDirect(personId){if(!current(generation))return Promise.resolve(fail('locked'));if(!isPersonId(personId)||personId===actor.personId||!roster.has(personId))return Promise.resolve(fail('invalid'));return execute(conversationIdFor({...actor,kind:'direct',personIds:[actor.personId,personId]}),{type:'openDirect',personId});},
    async createGroup({title,invitees}={}){if(!current(generation))return fail('locked');if(typeof title!=='string'||!title.trim()||title.trim().length>80||/[\u0000-\u001f\u007f]/.test(title)||!Array.isArray(invitees)||invitees.length>99||new Set(invitees).size!==invitees.length||Array.from(invitees).some(id=>!isPersonId(id)||id===actor.personId||!roster.has(id)))return fail('invalid');
      const token=generation,command={type:'createGroup',title:title.trim(),invitees:[...invitees].sort()},key=JSON.stringify(command);if(groupAttempt&&groupAttempt.key!==key)return fail('conflict');
      try{groupAttempt??={key,id:conversationIdFor({...actor,kind:'group',personIds:[actor.personId,...command.invitees],groupId:makeGroupId()})};}catch(_){return fail('invalid');}
      const result=await execute(groupAttempt.id,command);if(current(token)&&['ok','invalid','forbidden','limit'].includes(result.status))groupAttempt=null;return result;
    },
    manageGroup(conversationId,command){
      if(!isConversationId(conversationId)||!conversationId.startsWith('group_')||activeConversation()!==conversationId
        ||!['rename','invite','removeMember','transferOwner','leave','setArchived'].includes(command?.type)
        ||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<1)return Promise.resolve(fail('invalid'));
      return execute(conversationId,command);
    },
    respondInvite(conversationId,accept){if(!current(generation))return Promise.resolve(fail('locked'));const invite=invitations.get(conversationId);if(!isConversationId(conversationId)||!invite||typeof accept!=='boolean')return Promise.resolve(fail('invalid'));return execute(conversationId,{type:'respondInvite',accept,expectedRevision:invite.revision});},
    dispose(){if(disposed)return;disposed=true;generation++;stop();stopUnread?.();actor=null;projection=null;roster.clear();invitations.clear();groupAttempt=null;listeners.clear();}
  });
}
