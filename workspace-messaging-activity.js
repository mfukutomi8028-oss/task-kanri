// Watch small metadata only for the active conversation. The authenticated
// history API and Firebase Rules remain authoritative; never trust a signal
// as permission or as message content.
import {isMessagingRoomId,isConversationId,isPersonId,isMessagingTimestamp} from './workspace-messaging-core.js';
export const isMessagingActivityToken=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const noop=()=>{};
const safely=fn=>{try{fn();}catch(_){/* Cleanup must not prevent other cleanup. */}};
function bound(session,roomId){
  const actor=session.getSnapshot();
  return actor?.status==='bound'&&actor.roomId===roomId&&isPersonId(actor.personId)?actor.personId:null;
}
export function createFirebaseMessagingActivityTransport({db,session,ref,onValue}={}){
  if(!db||typeof session?.getSnapshot!=='function'||typeof ref!=='function'||typeof onValue!=='function')throw new TypeError('Firebase activity adapters required');
  function observeActivity({roomId,conversationId}={},onChange,onError){
    if(typeof onChange!=='function'||typeof onError!=='function')throw new TypeError('Activity callbacks required');
    const personId=isMessagingRoomId(roomId)&&isConversationId(conversationId)?bound(session,roomId):null;
    if(!personId){safely(onError);return noop;}
    const root='messagingV1/'+roomId,stops=new Set();
    let closed=false,queued=false,epoch=null;
    const current=()=>!closed&&bound(session,roomId)===personId;
    function stop(){if(closed)return;closed=true;for(const dispose of stops)safely(dispose);stops.clear();}
    function fail(){if(closed)return;const report=current();stop();if(report)safely(onError);}
    function refresh(){
      if(queued||!current())return;queued=true;
      queueMicrotask(()=>{queued=false;if(current())safely(onChange);});
    }
    function watch(path,receive){
      if(!current())return;
      try{
        const dispose=onValue(ref(db,path),snapshot=>{if(!current())return;try{receive(snapshot.val());}catch(_){fail();}},fail);
        if(typeof dispose!=='function'){fail();return;}
        // Firebase adapters may invoke callbacks before returning the disposer.
        if(closed)safely(dispose);else stops.add(dispose);
      }catch(_){fail();}
    }
    watch(root+'/control/'+conversationId+'/members/'+personId,member=>{
      if(member?.active!==true||!isMessagingTimestamp(member.joinedAt)||epoch!==null&&member.joinedAt!==epoch){fail();return;}
      if(epoch!==null)return;
      epoch=member.joinedAt;
      const personal=root+'/personal/'+personId+'/'+conversationId+'/'+epoch;
      watch(root+'/activity/'+conversationId,value=>{if(value!==null&&!isMessagingActivityToken(value)){fail();return;}refresh();});
      watch(personal+'/readCursor',refresh);
      watch(personal+'/preferences',refresh);
      refresh();
    });
    return stop;
  }
  return Object.freeze({observeActivity});
}
