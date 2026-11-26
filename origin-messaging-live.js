// Compose the production-intended view with Firebase and the authenticated
// HTTP API. The host supplies the existing database connection and canonical
// business-data bridge. This module never uses a preview fixture or admin key.
import {createMessagingSession} from './workspace-messaging-session.js';
import {createMessagingApiTransport} from './workspace-messaging-api.js';
import {createFirebaseMessagingActivityTransport} from './workspace-messaging-activity.js';
import {createMessagingDirectorySync} from './workspace-messaging-directory-sync.js';
import {createMessagingLiveCommands} from './workspace-messaging-live-commands.js';
import {createMessagingUnreadSync} from './workspace-messaging-unread-sync.js';
import {createMessagingPersonalStateTransport} from './workspace-messaging-personal.js';
import {createMessagingSharedTransport} from './workspace-messaging-shared.js';
import {createMessagingConfirmationTransport} from './workspace-messaging-confirmations.js';
import {createMessagingStore} from './workspace-messaging-store.js';
import {createMessagingReferenceResolver} from './workspace-messaging-refs.js';
import {isMessagingRoomId,isPersonId,isConversationId,isMessageId,isMessagingTimestamp} from './workspace-messaging-core.js';
import {mountOriginMessaging} from './origin-messaging.js';

const fail=status=>({status});
const safely=fn=>{try{fn?.();}catch(_){/* Release other resources even if one disposer fails. */}};
const validUid=v=>typeof v==='string'&&v.length>=1&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const validLabel=v=>typeof v==='string'&&v.length>=1&&v.length<=64&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);

export function mountCloudOriginMessaging({root,endpoint,sdk,auth,board,fetchImpl,attachmentsEnabled=false,onClose=()=>{}}={}){
  if(!root||!sdk?.db||['ref','get','onValue','set','update','runTransaction','serverTimestamp'].some(k=>typeof sdk[k]!=='function')||['getUid','getToken','observeAuth'].some(k=>typeof auth?.[k]!=='function')||['readSnapshot','readMemos','canReadRecord','openRecord','restoreConversation','subscribe'].some(k=>typeof board?.[k]!=='function')||typeof onClose!=='function')throw new TypeError('Cloud messaging host adapters required');
  const stops=[];let disposed=false,online=false,lastContext=null,store=null,view=null;
  function own(resource){stops.push(()=>resource.dispose());return resource;}
  function dispose(){if(disposed)return;disposed=true;for(const stop of stops.reverse())safely(stop);stops.length=0;}
  try{
    const bindingPath=({roomId,uid})=>{if(!isMessagingRoomId(roomId)||!validUid(uid))throw new TypeError('Invalid binding scope');return 'messagingAccessV1/'+roomId+'/'+uid;};
    const read=async path=>(await sdk.get(sdk.ref(sdk.db,path))).val();
    const session=own(createMessagingSession({
      getAuthUid:()=>online?auth.getUid():null,
      readBinding:target=>read(bindingPath(target)),
      observeBinding:(target,changed,error)=>sdk.onValue(sdk.ref(sdk.db,bindingPath(target)),s=>changed(s.val()),error),
      observeAuth(changed){
        let stopAuth,stopConnection;
        try{
          stopAuth=auth.observeAuth(changed);
          stopConnection=sdk.onValue(sdk.ref(sdk.db,'.info/connected'),snapshot=>{const next=snapshot.val()===true;if(online!==next){online=next;changed();}},()=>{online=false;changed();});
          if(typeof stopAuth!=='function'||typeof stopConnection!=='function')throw new TypeError('Disposable auth and connection required');
          return ()=>{online=false;safely(stopAuth);safely(stopConnection);};
        }catch(error){safely(stopAuth);safely(stopConnection);throw error;}
      },onLock:()=>{}
    }));
    const api=own(createMessagingApiTransport({endpoint,session,getToken:()=>auth.getToken(),...(fetchImpl?{fetchImpl}:{})}));
    function scopeActor(scope){const actor=session.getSnapshot();return !disposed&&actor.status==='bound'&&actor.roomId===scope?.roomId&&actor.personId===scope?.personId?actor:null;}
    function currentConversation(scope){const s=store?.getSnapshot();return Boolean(scopeActor(scope)&&s?.status==='ready'&&s.conversationId===scope.conversationId&&(scope.joinedAt===undefined||s.joinedAt===scope.joinedAt));}
    function guard(fn){return async scope=>{const before=scopeActor(scope);if(!before)return fail('locked');try{const value=await fn(scope);return scopeActor(scope)===before?value:fail('locked');}catch(_){return fail(scopeActor(scope)===before?'unavailable':'locked');}};}
    const guardMethods=resource=>Object.freeze(Object.fromEntries(Object.entries(resource).map(([key,fn])=>[key,guard(fn)])));
    const personal=guardMethods(createMessagingPersonalStateTransport(sdk)),decorations=guardMethods(createMessagingSharedTransport(sdk));
    const receiptTransport=createMessagingConfirmationTransport(sdk);
    const confirmations=guardMethods({...receiptTransport,async readMembers(scope){
      if(!currentConversation(scope)||!isConversationId(scope.conversationId))return fail('forbidden');
      const raw=await read('messagingV1/'+scope.roomId+'/control/'+scope.conversationId+'/members');
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>100||!currentConversation(scope))return fail('unavailable');
      const members={};for(const [id,m] of Object.entries(raw)){if(!isPersonId(id)||typeof m?.active!=='boolean'||!isMessagingTimestamp(m.joinedAt))return fail('unavailable');members[id]={active:m.active,joinedAt:m.joinedAt};}
      return {status:'ok',members};
    }});
    const activity=createFirebaseMessagingActivityTransport({...sdk,session});
    const directory=own(createMessagingDirectorySync({session,transport:api}));
    const unreadSync=own(createMessagingUnreadSync({session,observeActivity:activity.observeActivity,readUnread:api.readUnread}));
    const commands=own(createMessagingLiveCommands({session,directory,api,personal,unreadSync,activeConversation:()=>store?.getSnapshot().conversationId??null}));
    store=own(createMessagingStore({session,transport:{...api,...activity,readPersonalState:personal.readPersonalState,markRead:personal.markRead}}));
    const resolver=createMessagingReferenceResolver({
      readSnapshot:()=>board.readSnapshot(),readMemos:()=>board.readMemos(),
      async canRead(target,scope){if(!currentConversation(scope))return false;if(target.kind==='message')return isMessageId(target.messageId);return await board.canReadRecord(target.ref,scope)===true&&currentConversation(scope);},
      async readMessage({roomId,conversationId,messageId}){const actor=session.getSnapshot(),scope={...actor,roomId,conversationId};if(!currentConversation(scope)||!isMessageId(messageId))return null;const value=await read('messagingV1/'+roomId+'/messages/'+conversationId+'/'+messageId);return scopeActor(scope)===actor&&currentConversation(scope)?value:null;},
      openRecord:(ref,scope)=>currentConversation(scope)?board.openRecord(ref,scope):false,
      async restoreConversation(location,scope){if(!currentConversation(scope)||await board.restoreConversation(location,scope)!==true||!currentConversation(scope))return false;return view.restoreLocation(location);}
    });
    function readBusinessData(){const actor=session.getSnapshot(),snapshot=board.readSnapshot();return !disposed&&actor.status==='bound'&&snapshot?.roomId===actor.roomId&&snapshot.connectionMode==='remote-online'?{...snapshot,memos:board.readMemos()}:{roomId:null,tasks:[],schedules:[],memos:[]};}
    view=own(mountOriginMessaging({root,store,session,commands,resolver,readBusinessData,resolvePerson:id=>commands.resolvePerson(id),confirmations,personal,decorations,attachments:attachmentsEnabled?api:null,onClose(){dispose();onClose();}}));
    let last=null,queued=false;
    const stopStore=store.subscribe(next=>{
      if(next.status!=='ready'){last=null;return;}
      const key=JSON.stringify([next.conversationId,next.joinedAt,next.preferences]);
      if(key===last)return;last=key;if(queued)return;queued=true;
      queueMicrotask(()=>{queued=false;if(!disposed&&session.getSnapshot().status==='bound')commands.invalidate();});
    });stops.push(stopStore);
    directory.setVisible(true);
    // New memberships and invitations have no existing conversation watcher.
    // Reconcile only while the workspace is visible, without scanning history.
    const refreshDirectory=()=>{if(!disposed&&document.visibilityState==='visible'&&root.isConnected&&root.getClientRects().length&&session.getSnapshot().status==='bound')commands.invalidate();};
    const directoryTimer=setInterval(refreshDirectory,60000);
    document.addEventListener('visibilitychange',refreshDirectory);
    stops.push(()=>{clearInterval(directoryTimer);document.removeEventListener('visibilitychange',refreshDirectory);});
    function syncContext(snapshot){
      const next=snapshot?.connectionMode==='remote-online'&&isMessagingRoomId(snapshot.roomId)&&validLabel(snapshot.currentUser)?{roomId:snapshot.roomId,selectedDisplayName:snapshot.currentUser}:null;
      if(JSON.stringify(next)===JSON.stringify(lastContext))return;lastContext=next;void session.setContext(next);
    }
    const stopBoard=board.subscribe(syncContext);if(typeof stopBoard!=='function')throw new TypeError('Disposable canonical board required');stops.push(stopBoard);
    syncContext(board.readSnapshot());
    return Object.freeze({getSnapshot:()=>session.getSnapshot(),subscribe:fn=>session.subscribe(fn),open:id=>view.open(id),restore(){const actor=session.getSnapshot(),state=store.getSnapshot();return actor.status==='bound'&&state.status==='ready'?resolver.restore({...actor,conversationId:state.conversationId,joinedAt:state.joinedAt}):Promise.resolve(false);},dispose});
  }catch(error){dispose();throw error;}
}
