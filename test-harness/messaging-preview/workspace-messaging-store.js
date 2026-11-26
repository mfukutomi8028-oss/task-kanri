// Theme-neutral client state. The transport must enforce authorization and
// atomic persistence on the server. A bound UI session is not authorization.
import {isPersonId,isMessagingRoomId,compareCursor,advanceReadCursor,messageIdFor,isConversationId,isMessageId,isMessagingTimestamp,validateRoomMessageInput,projectMessagingMessage} from './workspace-messaging-core.js';

const PAGE_SIZE=50;
const sameIdentity=(a,b)=>a?.roomId===b?.roomId&&a?.personId===b?.personId;
const result=status=>({status});
const emptyMessages=Object.freeze([]);
const cursorOf=item=>({createdAt:item.createdAt,id:item.id});
const sameCursor=(a,b)=>a!=null&&b!=null&&a.createdAt===b.createdAt&&a.id===b.id;
const immutable=value=>{
  if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(immutable);Object.freeze(value);
  }return value;
};
const safeMessage=(raw,roomId,joinedAt)=>immutable(projectMessagingMessage(raw,{roomId,joinedAt}));
function decodePage(page,roomId,before){
  if(!page||page.status!=='ok'||!isMessagingTimestamp(page.joinedAt)||!Array.isArray(page.messages)||page.messages.length>PAGE_SIZE
      ||page.hasMore!==(page.messages.length===PAGE_SIZE))throw new TypeError('Invalid history page');
  const messages=page.messages.map(item=>safeMessage(item,roomId,page.joinedAt));
  for(let i=0;i<messages.length;i++){
    if(i&&compareCursor(messages[i-1],messages[i])>=0||before&&compareCursor(messages[i],before)>=0)throw new TypeError('Invalid history ordering');
  }
  if(new Set(messages.map(m=>m.id)).size!==messages.length)throw new TypeError('Duplicate history');
  const nextCursor=page.hasMore?cursorOf(messages[0]):null;
  if(nextCursor?!sameCursor(nextCursor,page.nextCursor):page.nextCursor!==null)throw new TypeError('Invalid history cursor');
  return {joinedAt:page.joinedAt,messages,hasMore:page.hasMore,nextCursor};
}
function mergeMessages(current,incoming){
  const map=new Map(current.map(m=>[m.id,m]));
  for(const item of incoming){
    const old=map.get(item.id);
    if(old&&(old.createdAt!==item.createdAt||old.senderId!==item.senderId))throw new TypeError('Immutable message identity changed');
    if(!old||item.revision>=old.revision)map.set(item.id,item);
  }
  return [...map.values()].sort(compareCursor);
}

export function createMessagingStore({session,transport}={}){
  if(typeof session?.subscribe!=='function'||['readHistory','observeActivity','send','edit','remove','markRead'].some(k=>typeof transport?.[k]!=='function'))throw new TypeError('Messaging transport and session required');
  const subscribers=new Set(),drafts=new Map(),cursors=new Map(),memberships=new Map(),pendingSends=new Map();
  let identity=null,disposed=false,generation=0,stopActivity=null,stopSession=null,pageRequest=null,refreshQueued=false,draftVersion=0;
  let state=immutable({status:'locked',conversationId:null,messages:emptyMessages,joinedAt:null,hasMore:false,nextCursor:null,draft:'',readCursor:null,historyReset:false,busy:false,error:null});
  const current=()=>state.conversationId&&identity?{roomId:identity.roomId,conversationId:state.conversationId}:null;
  const stillCurrent=token=>!disposed&&generation===token;
  const stillMember=(token,joinedAt)=>stillCurrent(token)&&state.joinedAt===joinedAt;
  const safeCall=fn=>{try{fn?.();}catch(_){/* Cleanup cannot prevent locking. */}};
  function publish(patch){
    state=immutable({...state,...patch});const next=state;
    for(const fn of [...subscribers]){if(state!==next)break;if(subscribers.has(fn))safeCall(()=>fn(next));}
  }
  function detach(){
    generation++;const stop=stopActivity;stopActivity=null;pageRequest=null;refreshQueued=false;safeCall(stop);
  }
  function reset(status,conversationId=null){
    publish({status,conversationId,messages:emptyMessages,joinedAt:null,hasMore:false,nextCursor:null,
      draft:'',readCursor:null,
      historyReset:false,busy:false,error:null});
  }
  function lockConversation(){
    const id=state.conversationId;detach();if(id){drafts.delete(id);cursors.delete(id);memberships.delete(id);}reset('forbidden');
  }
  function onIdentity(next){
    if(disposed)return;
    const bound=next?.status==='bound'&&isMessagingRoomId(next.roomId)&&isPersonId(next.personId)?{roomId:next.roomId,personId:next.personId}:null;
    if(bound&&identity&&sameIdentity(identity,bound))return;
    detach();identity=bound;drafts.clear();cursors.clear();memberships.clear();pendingSends.clear();reset(bound?'idle':'locked');
  }
  function requestPage(kind){
    const target=current();if(!target||disposed)return Promise.resolve(result('locked'));
    if(kind==='older'&&!state.hasMore)return Promise.resolve(result('ignored'));
    if(pageRequest)return pageRequest.kind===kind?pageRequest.promise:Promise.resolve(result('busy'));
    const before=kind==='older'?state.nextCursor:null,token=generation;
    const ticket={kind,promise:null};pageRequest=ticket;
    ticket.promise=Promise.resolve().then(async()=>{
      if(!stillCurrent(token))return result('locked');
      publish({busy:true,error:null,status:state.joinedAt===null?'loading':state.status});
      if(!stillCurrent(token))return result('locked');
      try{
        const raw=await transport.readHistory({...target,before,limit:PAGE_SIZE});
        if(!stillCurrent(token))return result('locked');
        if(raw?.status==='forbidden'||raw?.status==='locked'){lockConversation();return result('forbidden');}
        const page=decodePage(raw,target.roomId,before);
        const previousBoundary=memberships.get(target.conversationId);
        const changedBoundary=previousBoundary!==undefined&&previousBoundary!==page.joinedAt;
        memberships.set(target.conversationId,page.joinedAt);
        if(changedBoundary){
          drafts.delete(target.conversationId);cursors.delete(target.conversationId);
          // An older-page response cannot establish a new membership's latest page.
          if(kind==='older'){
            refreshQueued=true;
            publish({messages:emptyMessages,joinedAt:page.joinedAt,hasMore:false,nextCursor:null,draft:'',readCursor:null,historyReset:true});return result('ok');
          }
        }
        const existingIds=new Set(state.messages.map(m=>m.id));
        const overlap=page.messages.some(m=>existingIds.has(m.id));
        const replace=changedBoundary||state.joinedAt===null||kind==='latest'&&!overlap;
        const historyReset=changedBoundary||kind==='latest'&&state.messages.length>0&&!overlap;
        const messages=replace?page.messages:mergeMessages(state.messages,page.messages);
        const usePageCursor=replace||kind==='older';
        publish({status:'ready',messages,joinedAt:page.joinedAt,historyReset:state.historyReset||historyReset,
          hasMore:usePageCursor?page.hasMore:state.hasMore,nextCursor:usePageCursor?page.nextCursor:state.nextCursor,
          draft:drafts.get(target.conversationId)?.body??'',readCursor:cursors.get(target.conversationId)??null,busy:false,error:null});
        return result('ok');
      }catch(_){
        if(!stillCurrent(token))return result('locked');
        publish({status:state.joinedAt===null?'unavailable':state.status,error:'unavailable',busy:false});return result('unavailable');
      }
    }).finally(()=>{
      if(pageRequest===ticket){pageRequest=null;if(stillCurrent(token)){if(state.busy)publish({busy:false});if(refreshQueued){refreshQueued=false;void requestPage('latest');}}}
    });
    return ticket.promise;
  }
  function onActivity(token){if(!stillCurrent(token))return;if(pageRequest)refreshQueued=true;else void requestPage('latest');}
  function setActiveConversation(id){
    if(disposed||!identity)return Promise.resolve(result('locked'));
    if(id===null){detach();reset('idle');return Promise.resolve(result('ok'));}
    if(!isConversationId(id))return Promise.resolve(result('invalid'));
    if(state.conversationId===id)return requestPage('latest');
    detach();const token=generation;reset('loading',id);
    if(!stillCurrent(token))return Promise.resolve(result('locked'));
    try{
      const stop=transport.observeActivity(current(),()=>onActivity(token),()=>{if(stillCurrent(token))lockConversation();});
      if(typeof stop!=='function')throw new TypeError('Missing activity disposer');
      if(!stillCurrent(token)){safeCall(stop);return Promise.resolve(result('forbidden'));}stopActivity=stop;
    }catch(_){if(stillCurrent(token))lockConversation();return Promise.resolve(result('unavailable'));}
    return requestPage('latest');
  }
  function setDraft(body){
    if(disposed||!current()||state.status!=='ready'||typeof body!=='string'||body.length>6000)return false;
    drafts.set(state.conversationId,{body,version:++draftVersion});publish({draft:body});return true;
  }
  function send({conversationId,requestId,input}={}){
    const target=current();if(!target||disposed)return Promise.resolve(result('locked'));
    if(conversationId!==target.conversationId||state.status!=='ready')return Promise.resolve(result('invalid'));
    let normalized,expectedId;try{normalized=validateRoomMessageInput(input,target.roomId);expectedId=messageIdFor(identity.personId,requestId);}catch(_){return Promise.resolve(result('invalid'));}
    const token=generation,joinedAt=state.joinedAt,bodyKey=JSON.stringify(normalized),key=conversationId+'/'+requestId;
    const prior=pendingSends.get(key);if(prior)return prior.bodyKey===bodyKey?prior.promise:Promise.resolve(result('conflict'));
    const draft=drafts.get(conversationId),entry={bodyKey,promise:null};pendingSends.set(key,entry);
    entry.promise=(async()=>{
      try{
        const response=await transport.send({...target,requestId,input:normalized});
        if(!stillMember(token,joinedAt))return result('locked');
        if(response?.status==='locked'||response?.status==='forbidden'){lockConversation();return result('locked');}
        if(response?.status==='sent'&&response.id===expectedId){
          if(draft&&draft.version===drafts.get(conversationId)?.version&&draft.body===normalized.body){drafts.delete(conversationId);publish({draft:''});}
          onActivity(token);return {status:'sent',id:response.id};
        }
        return result(response?.status==='conflict'?'conflict':'failed');
      }catch(_){return result(stillMember(token,joinedAt)?'failed':'locked');}
      finally{if(pendingSends.get(key)===entry)pendingSends.delete(key);}
    })();return entry.promise;
  }
  async function mutate(kind,{conversationId,messageId,expectedRevision,input}={}){
    const target=current();if(!target||disposed)return result('locked');
    if(conversationId!==target.conversationId||state.status!=='ready'||!isMessageId(messageId))return result('invalid');
    const old=state.messages.find(m=>m.id===messageId);
    if(!old||old.senderId!==identity.personId||old.deletedAt!=null)return result('forbidden');
    if(old.revision!==expectedRevision)return result('conflict');
    const token=generation,joinedAt=state.joinedAt,request={...target,messageId,expectedRevision};
    if(kind==='edit')try{request.input=validateRoomMessageInput(input,target.roomId);}catch(_){return result('invalid');}
    try{
      const response=await transport[kind](request);
      if(!stillMember(token,joinedAt))return result('locked');
      if(response?.status==='locked'||response?.status==='forbidden'){lockConversation();return result('locked');}
      if(response?.status!=='ok')return result(response?.status==='conflict'?'conflict':'failed');
      const next=safeMessage(response.message,target.roomId,state.joinedAt);
      if(next.id!==old.id||next.revision!==old.revision+1||kind==='remove'&&next.deletedAt==null||kind==='edit'&&next.deletedAt!=null)return result('failed');
      publish({messages:mergeMessages(state.messages,[next])});return result('ok');
    }catch(_){return result(stillMember(token,joinedAt)?'failed':'locked');}
  }
  async function markRead({conversationId,cursor,visible}={}){
    if(visible!==true)return result('ignored');
    const target=current();if(!target||disposed)return result('locked');
    if(conversationId!==target.conversationId||state.status!=='ready'||!state.messages.some(m=>sameCursor(m,cursor)))return result('invalid');
    if(state.readCursor&&compareCursor(state.readCursor,cursor)>=0)return result('ignored');
    const token=generation,joinedAt=state.joinedAt,requested=cursorOf(cursor);try{
      const response=await transport.markRead({...target,personId:identity.personId,joinedAt,cursor:requested});
      if(!stillMember(token,joinedAt))return result('locked');
      if(response?.status==='locked'||response?.status==='forbidden'){lockConversation();return result('locked');}
      if(response?.status!=='ok')return result('failed');
      const committed=response.cursor??requested;
      if(!isMessageId(committed?.id)||!isMessagingTimestamp(committed.createdAt)||committed.createdAt<=joinedAt||compareCursor(committed,requested)<0)return result('failed');
      const next=advanceReadCursor(state.readCursor,committed);cursors.set(conversationId,next);publish({readCursor:next});return result('ok');
    }catch(_){return result(stillMember(token,joinedAt)?'failed':'locked');}
  }
  stopSession=session.subscribe(onIdentity);
  if(typeof stopSession!=='function')throw new TypeError('Session subscription must be disposable');
  return Object.freeze({getSnapshot:()=>state,subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener required');if(disposed){safeCall(()=>fn(state));return ()=>{};}subscribers.add(fn);safeCall(()=>fn(state));return ()=>subscribers.delete(fn);},
    setActiveConversation,loadOlder:()=>requestPage('older'),refreshLatest:()=>requestPage('latest'),setDraft,send,
    edit:request=>mutate('edit',request),remove:request=>mutate('remove',request),markRead,
    dispose(){if(disposed)return;disposed=true;detach();safeCall(stopSession);stopSession=null;identity=null;drafts.clear();cursors.clear();memberships.clear();pendingSends.clear();reset('locked');subscribers.clear();}
  });
}
