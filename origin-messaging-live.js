// Compose the production-intended view with Firebase and the authenticated
// HTTP API. The host supplies the existing database connection and canonical
// business-data bridge. This module never uses a preview fixture or admin key.
import {createMessagingRecordLinkTransport,recordLinkKey,removeLegacyPendingLinks} from './workspace-messaging-record-links.js';
export {removeLegacyPendingLinks};
import {createMessagingSession} from './workspace-messaging-session.js';
import {createMessagingApiTransport} from './workspace-messaging-api.js';
import {createFirebaseMessagingActivityTransport} from './workspace-messaging-activity.js';
import {createMessagingDirectorySync} from './workspace-messaging-directory-sync.js';
import {createMessagingLiveCommands} from './workspace-messaging-live-commands.js';
import {createMessagingUnreadSync} from './workspace-messaging-unread-sync.js';
import {createMessagingSummaryOwner} from './workspace-messaging-notifications.js';
import {createMessagingPersonalStateTransport} from './workspace-messaging-personal.js';
import {createMessagingSharedTransport} from './workspace-messaging-shared.js';
import {createMessagingConfirmationTransport} from './workspace-messaging-confirmations.js';
import {createMessagingStore,createMessagingDraftOwner} from './workspace-messaging-store.js';
import {createMessagingReferenceResolver} from './workspace-messaging-refs.js';
import {isMessagingRoomId,isPersonId,isConversationId,isMessageId,isMessagingTimestamp} from './workspace-messaging-core.js';
import {mountOriginMessaging} from './origin-messaging.js';

const fail=status=>({status});
const safely=fn=>{try{fn?.();}catch(_){/* Release other resources even if one disposer fails. */}};
const validUid=v=>typeof v==='string'&&v.length>=1&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const validLabel=v=>typeof v==='string'&&v.length>=1&&v.length<=64&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);

const newRequestId=()=>'q_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function mountCloudOriginMessaging({root,endpoint,sdk,auth,board,fetchImpl,storage=globalThis.localStorage,attachmentsEnabled=false,keepNotificationSession=false,draftOwner=createMessagingDraftOwner(),onSummary=()=>{},onAvailability=()=>{},onIdentityInvalidated=()=>{},onNotification=()=>{},onClose=()=>{}}={}){
  if(!root||!sdk?.db||['ref','get','onValue','set','update','runTransaction','serverTimestamp'].some(k=>typeof sdk[k]!=='function')||['getUid','getToken','observeAuth'].some(k=>typeof auth?.[k]!=='function')||['readSnapshot','readMemos','canReadRecord','openRecord','restoreConversation','subscribe'].some(k=>typeof board?.[k]!=='function')||[onClose,onSummary,onNotification,onIdentityInvalidated].some(fn=>typeof fn!=='function'))throw new TypeError('Cloud messaging host adapters required');
  const stops=[];let disposed=false,online=false,control=null,lastContext=null,store=null,view=null,resolver=null,returnScope=null,stopStore=null;
  function disposeWorkspace(){const previousView=view,previousStore=store,previousStop=stopStore;view=null;store=null;resolver=null;returnScope=null;stopStore=null;safely(previousStop);safely(()=>previousView?.dispose());safely(()=>previousStore?.dispose());}
  function own(resource){stops.push(()=>resource.dispose());return resource;}
  function dispose(){if(disposed)return;disposed=true;disposeWorkspace();for(const stop of stops.reverse())safely(stop);stops.length=0;}
  try{
    const bindingPath=({roomId,uid})=>{if(!isMessagingRoomId(roomId)||!validUid(uid))throw new TypeError('Invalid binding scope');return 'messagingAccessV1/'+roomId+'/'+uid;};
    const read=async path=>(await sdk.get(sdk.ref(sdk.db,path))).val();
    let lastUid=auth.getUid();
    let draftSource=null;
    const clearScope=()=>{draftOwner.clear();resolver?.clear();returnScope=null;draftSource=null;};
    removeLegacyPendingLinks(storage);
    const identityInvalidated=()=>{clearScope();onIdentityInvalidated();};
    const session=own(createMessagingSession({
      getAuthUid:()=>online&&control===true?auth.getUid():null,
      readBinding:target=>read(bindingPath(target)),
      observeBinding:(target,changed,error)=>sdk.onValue(sdk.ref(sdk.db,bindingPath(target)),s=>changed(s.val()),error),
      observeAuth(changed){
        let stopAuth,stopConnection,stopControl;
        try{
          stopAuth=auth.observeAuth(()=>{const uid=auth.getUid();if(lastUid!==null&&lastUid!==uid)identityInvalidated();lastUid=uid;changed();});
          stopConnection=sdk.onValue(sdk.ref(sdk.db,'.info/connected'),snapshot=>{const next=snapshot.val()===true;if(online!==next){online=next;changed();}},()=>{online=false;changed();});
          const applyControl=value=>{
            if(value===control)return;
            control=value;
            changed();
            onAvailability(control);
          };
          stopControl=sdk.onValue(sdk.ref(sdk.db,'messagingControlV1/enabled'),snapshot=>applyControl(snapshot.val()===true),()=>applyControl(false));
          if(typeof stopAuth!=='function'||typeof stopConnection!=='function'||typeof stopControl!=='function')throw new TypeError('Disposable auth and connection required');
          return ()=>{online=false;safely(stopAuth);safely(stopConnection);safely(stopControl);};
        }catch(error){safely(stopAuth);safely(stopConnection);safely(stopControl);throw error;}
      },onLock:()=>{},onBindingRejected:identityInvalidated,onBindingReassigned:identityInvalidated
    }));
    const api=own(createMessagingApiTransport({endpoint,session,getToken:()=>auth.getToken(),...(fetchImpl?{fetchImpl}:{})}));
    function scopeActor(scope){const actor=session.getSnapshot();return !disposed&&actor.status==='bound'&&actor.roomId===scope?.roomId&&actor.personId===scope?.personId?actor:null;}
    function currentConversation(scope){const s=store?.getSnapshot();return Boolean(scopeActor(scope)&&s?.status==='ready'&&s.conversationId===scope.conversationId&&(scope.joinedAt===undefined||s.joinedAt===scope.joinedAt));}
    function guard(fn){return async scope=>{const before=scopeActor(scope);if(!before)return fail('locked');try{const value=await fn(scope);return scopeActor(scope)===before?value:fail('locked');}catch(_){return fail(scopeActor(scope)===before?'unavailable':'locked');}};}
    const guardMethods=resource=>Object.freeze(Object.fromEntries(Object.entries(resource).map(([key,fn])=>[key,guard(fn)])));
    // Shared record links are read-only here. The source message of an open
    // create-from-message draft is kept in memory only, with one request id per
    // record type and count, so a retried save receives the same issued ids.
    const recordLinks=createMessagingRecordLinkTransport(sdk);
    const linkActor=scope=>{const actor=session.getSnapshot();return !disposed&&control===true&&actor.status==='bound'&&actor.roomId===scope?.roomId&&actor.personId===scope.personId?actor:null;};
    const personal=guardMethods(createMessagingPersonalStateTransport(sdk)),decorations=guardMethods(createMessagingSharedTransport(sdk));
    const receiptTransport=createMessagingConfirmationTransport(sdk);
    const confirmations=guardMethods({...receiptTransport,async readMembers(scope){
      if(!currentConversation(scope)||!isConversationId(scope.conversationId))return fail('forbidden');
      const raw=await read('messagingV1/'+scope.roomId+'/control/'+scope.conversationId+'/members');
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>100||!currentConversation(scope))return fail('unavailable');
      const members={};for(const [id,m] of Object.entries(raw)){if(!isPersonId(id)||typeof m?.active!=='boolean'||!isMessagingTimestamp(m.joinedAt))return fail('unavailable');members[id]={active:m.active,joinedAt:m.joinedAt};}
      return {status:'ok',members};
    }});
    const readGroup=guard(async scope=>{
      if(!currentConversation(scope)||!isConversationId(scope.conversationId)||!scope.conversationId.startsWith('group_'))return fail('forbidden');
      const data=await read('messagingV1/'+scope.roomId+'/control/'+scope.conversationId),self=data?.members?.[scope.personId];
      if(!currentConversation(scope)||data?.id!==scope.conversationId||data.roomId!==scope.roomId||self?.active!==true||self.joinedAt!==scope.joinedAt)return fail('forbidden');
      const roles=['owner','admin','member'];
      if(!Number.isSafeInteger(data.revision)||data.revision<1||!roles.includes(self.role)||!['active','archived'].includes(data.status)||typeof data.title!=='string')return fail('unavailable');
      const members=Object.entries(data.members);
      const invitations=Object.entries(data.invites??{});
      if(members.length>100||invitations.length>100||members.some(([id,row])=>!isPersonId(id)||!roles.includes(row?.role)||typeof row.active!=='boolean')||invitations.some(([id,row])=>!isPersonId(id)||!['pending','accepted','declined'].includes(row?.state)))return fail('unavailable');
      return {status:'ok',revision:data.revision,title:data.title,archived:data.status==='archived',role:self.role,members:members.filter(([,row])=>row.active).map(([id,row])=>({id,role:row.role})),invitations:invitations.filter(([,row])=>row.state==='pending').map(([id])=>id)};
    });
    const activity=createFirebaseMessagingActivityTransport({...sdk,session});
    const directory=own(createMessagingDirectorySync({session,transport:api}));
    const unreadSync=own(createMessagingUnreadSync({session,observeActivity:activity.observeActivity,readUnread:api.readUnread}));
    const commands=own(createMessagingLiveCommands({session,directory,api,personal,unreadSync,activeConversation:()=>store?.getSnapshot().conversationId??null}));
    const workspaceVisible=()=>Boolean(view&&root.isConnected&&root.getClientRects().length&&document.visibilityState==='visible');
    const summaryOwner=own(createMessagingSummaryOwner({session,readList:options=>commands.list(options),onSummary,notify(event){if(workspaceVisible())view.announce(event);else if(document.visibilityState==='visible')onNotification(event.kind);}}));
    stops.push(commands.subscribe(options=>summaryOwner.refresh(options)));
    function hideWorkspace(){if(disposed||!keepNotificationSession)return false;disposeWorkspace();summaryOwner.setWorkspaceOpen(false);return true;}
    function showWorkspace(){
      if(disposed)return false;if(view)return true;summaryOwner.setWorkspaceOpen(true);
      try{
      store=createMessagingStore({session,draftOwner,getUid:()=>auth.getUid(),transport:{...api,...activity,readPersonalState:personal.readPersonalState,markRead:personal.markRead}});
      async function openFromConversation(scope,open){
        if(!currentConversation(scope))return false;
        const location={...scope};
        returnScope=location;
        try{if(await open()===true&&returnScope===location)return true;}
        catch(_){/* Keep the existing conversation if the board could not open. */}
        if(returnScope===location)returnScope=null;
        return false;
      }
      resolver=createMessagingReferenceResolver({
      readSnapshot:()=>board.readSnapshot(),readMemos:()=>board.readMemos(),
      async canRead(target,scope){if(!currentConversation(scope))return false;if(target.kind==='message')return isMessageId(target.messageId);return await board.canReadRecord(target.ref,scope)===true&&currentConversation(scope);},
      async readMessage({roomId,conversationId,messageId}){const actor=session.getSnapshot(),scope={...actor,roomId,conversationId};if(!currentConversation(scope)||!isMessageId(messageId))return null;const value=await read('messagingV1/'+roomId+'/messages/'+conversationId+'/'+messageId);return scopeActor(scope)===actor&&currentConversation(scope)?value:null;},
      openRecord:(ref,scope)=>openFromConversation(scope,()=>board.openRecord(ref,scope)),
      ...(typeof board.openBusinessDraft==='function'?{openBusinessDraft:(draft,scope)=>{draftSource=draft?.source?.roomId===scope.roomId&&draft.source.conversationId===scope.conversationId&&isMessageId(draft.source.messageId)?{roomId:scope.roomId,personId:scope.personId,conversationId:draft.source.conversationId,messageId:draft.source.messageId,requests:new Map()}:null;return openFromConversation(scope,()=>board.openBusinessDraft(draft,scope));}}:{}),
      async restoreConversation(location,scope){if(!currentConversation(scope)||await board.restoreConversation(location,scope)!==true||!currentConversation(scope))return false;return view?.restoreLocation(location)??false;}
    });
    function readBusinessData(){const actor=session.getSnapshot(),snapshot=board.readSnapshot();return !disposed&&actor.status==='bound'&&snapshot?.roomId===actor.roomId&&snapshot.connectionMode==='remote-online'?{...snapshot,memos:board.readMemos()}:{roomId:null,tasks:[],schedules:[],memos:[]};}
    view=mountOriginMessaging({root,store,session,commands,resolver,readBusinessData,resolvePerson:id=>commands.resolvePerson(id),confirmations,personal,decorations,attachments:attachmentsEnabled?api:null,canShareRecord:board.canReadRecord,readGroup,summaryOwner,onClose(){if(!keepNotificationSession)dispose();onClose();}});
    let last=null,queued=false;
    const mountedStore=store;
    stopStore=store.subscribe(next=>{
      if(next.status!=='ready'){last=null;return;}
      const key=JSON.stringify([next.conversationId,next.joinedAt,next.preferences]);
      if(key===last)return;last=key;if(queued)return;queued=true;
      queueMicrotask(()=>{queued=false;if(!disposed&&store===mountedStore&&session.getSnapshot().status==='bound')commands.invalidate();});
    });return true;
      }catch(error){disposeWorkspace();summaryOwner.unavailable();throw error;}
    }
    function waitBound(ms){
      const ready=()=>{const actor=session.getSnapshot();return !disposed&&control===true&&actor.status==='bound'?actor:null;};
      if(ready())return Promise.resolve(ready());
      return new Promise(resolve=>{let stop=null,done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);try{stop?.();}catch(_){}resolve(value);};const timer=setTimeout(()=>finish(ready()),ms);stop=session.subscribe(()=>{if(ready())queueMicrotask(()=>finish(ready()));});});
    }
    showWorkspace();
    directory.setVisible(true);
    // New memberships and invitations have no existing conversation watcher.
    // Reconcile while the board is visible, without scanning history.
    const refreshDirectory=()=>{if(!disposed&&document.visibilityState==='visible'&&root.isConnected&&session.getSnapshot().status==='bound')commands.invalidate();};
    const directoryTimer=setInterval(refreshDirectory,120000);
    document.addEventListener('visibilitychange',refreshDirectory);
    stops.push(()=>{clearInterval(directoryTimer);document.removeEventListener('visibilitychange',refreshDirectory);});
    function syncContext(snapshot){
      const selected=isMessagingRoomId(snapshot?.roomId)&&validLabel(snapshot.currentUser)?{roomId:snapshot.roomId,selectedDisplayName:snapshot.currentUser}:null;
      const next=snapshot?.connectionMode==='remote-online'?selected:null;
      if(JSON.stringify(next)===JSON.stringify(lastContext))return;lastContext=next;void session.setContext(next);
    }
    let draftScope=JSON.stringify([board.readSnapshot()?.roomId,board.readSnapshot()?.currentUser]);
    const stopBoard=board.subscribe(snapshot=>{
      const next=JSON.stringify([snapshot?.roomId,snapshot?.currentUser]);
      if(next!==draftScope){draftScope=next;clearScope();}
      syncContext(snapshot);
    });if(typeof stopBoard!=='function')throw new TypeError('Disposable canonical board required');stops.push(stopBoard);
    syncContext(board.readSnapshot());
    return Object.freeze({getSnapshot:()=>session.getSnapshot(),getAvailability:()=>control,getApprovalRequest(){const uid=auth.getUid();return !disposed&&control===true&&online&&session.getSnapshot().status==='locked'&&lastContext&&validUid(uid)?{roomId:lastContext.roomId,displayName:lastContext.selectedDisplayName,uid}:null;},subscribe:fn=>session.subscribe(fn),hideWorkspace,showWorkspace,share:ref=>view?.share(ref)??false,open:id=>view?.open(id)??Promise.resolve(false),
      // Called by the board right before it saves a new record from a message
      // (after its own checks and confirmations). Returns ids issued by the server
      // whose links already exist, or a status when no link can be attached.
      async reserveRecordIds({roomId,type,count}={}){
        const source=draftSource;
        if(!source||source.roomId!==roomId||!['task','schedule'].includes(type)||!Number.isInteger(count)||count<1||count>200)return {status:'none'};
        const actor=linkActor(source);if(!actor)return {status:'locked'};
        const key=type+':'+count;let requestId=source.requests.get(key);
        if(!requestId){requestId=newRequestId();source.requests.set(key,requestId);}
        const result=await api.reserveRecords({roomId:source.roomId,conversationId:source.conversationId,messageId:source.messageId,requestId,recordType:type,count});
        if(session.getSnapshot()!==actor)return {status:'locked'};
        return result.status==='ok'?{status:'ok',ids:result.ids}:{status:result.status};
      },
      // The draft was saved (or abandoned): later saves are not from this message.
      finishRecordDraft(){draftSource=null;},
      // Explicit check from a record's detail. Waits for this device's own approved
      // binding before reading, and reports missing and forbidden alike.
      async openRecordLink(ref){
        if(disposed||!recordLinkKey(ref)||!view)return 'unavailable';
        const actor=await waitBound(10000);
        if(!actor||ref.roomId!==actor.roomId)return 'locked';
        const link=await recordLinks.readLink(actor,ref);
        if(session.getSnapshot()!==actor||control!==true)return 'locked';
        if(link.status!=='ok')return link.status==='unavailable'?'retry':'unavailable';
        return await view.openMessage(link.conversationId,link.messageId)===true&&session.getSnapshot()===actor?'opened':'unavailable';
      },
      async restore(){
      const scope=returnScope,target=store;
      if(!scope||!target||!scopeActor(scope))return false;
      if(!currentConversation(scope))await target.setActiveConversation(scope.conversationId);
      if(returnScope!==scope||store!==target||!scopeActor(scope))return false;
      if(!currentConversation(scope)){
        returnScope=null;resolver?.clear();
        return false;
      }
      returnScope=null;
      return resolver.restore(scope);
    },dispose});
  }catch(error){dispose();throw error;}
}
