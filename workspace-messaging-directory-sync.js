// Client-side directory synchronization; the authenticated API is authoritative.
// A change observer is only an invalidation signal, never a source of rows.
// No background polling, history reads, or database permissions are added here.
import {isMessagingRoomId,isPersonId,isConversationId,isMessagingTimestamp,conversationIdFor} from './workspace-messaging-core.js';
const PAGE_SIZE=100,MAX_PAGES=10;
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const bound=v=>v?.status==='bound'&&isMessagingRoomId(v.roomId)&&isPersonId(v.personId)?Object.freeze({roomId:v.roomId,personId:v.personId}):null;
const same=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a.roomId===b.roomId&&a.personId===b.personId;
const revision=v=>Number.isSafeInteger(v)&&v>=1;
const title=v=>typeof v==='string'&&v.length>0&&v.length<=80&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const empty=Object.freeze([]);
const blank=status=>Object.freeze({status,roomId:null,personId:null,conversations:empty,invites:empty,complete:false,nextCursor:null});
function memberRow(row,identity){
  if(!record(row)||!isConversationId(row.id)||!['active','archived'].includes(row.status)||!['owner','admin','member'].includes(row.role)||!Number.isInteger(row.memberCount)||row.memberCount<1||row.memberCount>100||!isMessagingTimestamp(row.joinedAt)||!revision(row.revision)||!isMessagingTimestamp(row.controlUpdatedAt)||row.controlUpdatedAt<row.joinedAt)throw new TypeError('Invalid conversation row');
  const {id,kind,status,role,memberCount,joinedAt,revision:rev,controlUpdatedAt}=row;
  const clean={id,kind,status,role,memberCount,joinedAt,revision:rev,controlUpdatedAt};
  if(kind==='group'&&id.startsWith('group_')&&title(row.title))return Object.freeze({...clean,title:row.title});
  if(status!=='active'||role!=='member')throw new TypeError('Invalid individual conversation');
  if(kind==='self'&&memberCount===1&&id===conversationIdFor({...identity,kind,personIds:[identity.personId]}))return Object.freeze(clean);
  if(kind==='direct'&&memberCount===2&&isPersonId(row.peerId)&&row.peerId!==identity.personId&&id===conversationIdFor({...identity,kind,personIds:[identity.personId,row.peerId]}))return Object.freeze({...clean,peerId:row.peerId});
  throw new TypeError('Invalid conversation identity');
}
function inviteRow(row,identity){
  if(!record(row)||!isConversationId(row.conversationId)||!row.conversationId.startsWith('group_')||!title(row.title)||!isPersonId(row.invitedBy)||row.invitedBy===identity.personId||!isMessagingTimestamp(row.invitedAt)||!revision(row.revision))throw new TypeError('Invalid invitation row');
  const {conversationId,title:label,invitedBy,invitedAt,revision:rev}=row;return Object.freeze({conversationId,title:label,invitedBy,invitedAt,revision:rev});
}
function decodePage(raw,identity,after){
  if(!record(raw)||raw.status!=='ok'||raw.roomId!==identity.roomId||raw.personId!==identity.personId||!Array.isArray(raw.conversations)||!Array.isArray(raw.invites)||raw.conversations.length+raw.invites.length>PAGE_SIZE||typeof raw.hasMore!=='boolean')throw new TypeError('Invalid directory page');
  const cursor=raw.nextCursor;
  if(raw.hasMore?(!isConversationId(cursor)||after!==null&&cursor<=after):cursor!==null)throw new TypeError('Invalid directory cursor');
  const conversations=raw.conversations.map(row=>memberRow(row,identity)),invites=raw.invites.map(row=>inviteRow(row,identity));
  const ids=[...conversations.map(row=>row.id),...invites.map(row=>row.conversationId)];
  if(new Set(ids).size!==ids.length||ids.some(id=>after!==null&&id<=after||raw.hasMore&&id>cursor))throw new TypeError('Invalid directory page boundary');
  return {conversations,invites,nextCursor:cursor};
}
export function createMessagingDirectorySync({session,transport,observeChanges}={}){
  if(typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||typeof transport?.readDirectory!=='function'||observeChanges!==undefined&&typeof observeChanges!=='function')throw new TypeError('Directory session and transport required');
  let identity=null,visible=false,disposed=false,generation=0,stopObserver=null,stopSession=null,request=null,queued=false,observing=false;
  let state=blank('hidden');const subscribers=new Set();
  const safely=fn=>{try{fn?.();}catch(_){/* Keep cleanup and publication independent. */}};
  const current=token=>!disposed&&visible&&token===generation&&identity!==null&&same(identity,bound(session.getSnapshot()));
  function publish(next){state=next;for(const fn of [...subscribers]){if(state!==next)break;if(subscribers.has(fn))safely(()=>fn(next));}}
  function invalidate(){
    generation++;request=null;queued=false;observing=false;const stop=stopObserver;stopObserver=null;safely(stop);
  }
  function fail(status){invalidate();publish(blank(status));}
  function launch(){
    if(!current(generation))return Promise.resolve({status:'locked'});
    if(request)return request.promise;
    const token=generation,actor=identity,ticket={promise:null};request=ticket;
    ticket.promise=Promise.resolve().then(async()=>{
      const conversations=[],invites=[];let after=null;
      try{
        for(let i=0;i<MAX_PAGES;i++){
          if(!current(token))return {status:'locked'};
          if(queued)return {status:'stale'};
          const raw=await transport.readDirectory({roomId:actor.roomId,after,limit:PAGE_SIZE});
          if(!current(token))return {status:'locked'};
          if(raw?.status==='locked'||raw?.status==='forbidden'){fail('locked');return {status:'locked'};}
          if(queued)return {status:'stale'};
          const page=decodePage(raw,actor,after);conversations.push(...page.conversations);invites.push(...page.invites);after=page.nextCursor;
          if(after===null)break;
        }
        publish(Object.freeze({status:'ready',...actor,conversations:Object.freeze(conversations),invites:Object.freeze(invites),complete:after===null,nextCursor:after}));
        return {status:'ok'};
      }catch(_){if(current(token)&&!queued)fail('unavailable');return {status:'unavailable'};}
    }).finally(()=>{
      if(request!==ticket)return;request=null;
      if(current(token)&&queued){queued=false;void launch();}
    });
    publish(blank('loading'));return ticket.promise;
  }
  function activate(){
    if(!current(generation))return Promise.resolve({status:'locked'});
    if(observeChanges&&!observing){
      const token=generation;observing=true;let armed=false;
      try{
        const stop=observeChanges(identity,()=>{if(!armed||!current(token))return;if(request)queued=true;else void launch();},()=>{if(current(token))fail('unavailable');});
        if(typeof stop!=='function')throw new TypeError('Disposable observer required');
        if(!current(token)){safely(stop);return Promise.resolve({status:'unavailable'});}
        stopObserver=stop;armed=true;
      }catch(_){if(current(token))fail('unavailable');return Promise.resolve({status:'unavailable'});}
    }
    return launch();
  }
  function onIdentity(value){
    if(disposed)return;const next=bound(value);if(same(identity,next))return;
    invalidate();identity=next;if(!visible)publish(blank('hidden'));else if(!identity)publish(blank('locked'));else void activate();
  }
  stopSession=session.subscribe(onIdentity);
  if(typeof stopSession!=='function'){invalidate();throw new TypeError('Disposable session required');}
  return Object.freeze({getSnapshot:()=>state,subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener required');if(disposed){safely(()=>fn(state));return ()=>{};}subscribers.add(fn);safely(()=>fn(state));return ()=>subscribers.delete(fn);},
    setVisible(value){if(disposed||visible===(value===true))return;visible=value===true;invalidate();if(!visible)publish(blank('hidden'));else if(!identity)publish(blank('locked'));else void activate();},
    refresh:()=>activate(),
    dispose(){if(disposed)return;disposed=true;visible=false;invalidate();safely(stopSession);stopSession=null;identity=null;publish(blank('locked'));subscribers.clear();}
  });
}
