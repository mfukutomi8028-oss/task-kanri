// Read-only access to the shared link from a task/schedule to the message it was
// created from. Links are written only by the messaging server, for record ids
// it issued for one authorized source message (see
// security/messaging-record-origin-service.mjs); the browser never writes them.
// Rules check the reader's own binding and membership on each link, so a parent
// read can never bypass them. Records are keyed by stable personId-free ids, so
// a future account login keeps every link unchanged.
import {isConversationId,isMessageId,isMessagingRoomId,isPersonId,isMessagingTimestamp} from './workspace-messaging-core.js';
const types=new Set(['task','schedule']);
const fail=status=>({status});
const keyOk=v=>typeof v==='string'&&v.length>0&&new TextEncoder().encode(v).length<=700&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
export const recordLinkKey=ref=>types.has(ref?.type)&&keyOk(ref?.recordId)?ref.type+'/'+ref.recordId:null;
function pathOf({roomId,personId},ref){
  const key=recordLinkKey(ref);
  return isMessagingRoomId(roomId)&&isPersonId(personId)&&key&&ref.roomId===roomId?['messagingV1',roomId,'recordLinks',key].join('/'):null;
}
// Earlier candidates kept unsaved link intents (record and message ids) in this
// browser. Links are now issued by the server, so those entries are removed.
const LEGACY_PENDING_PREFIX='wb-messaging-pending-links-v1|';
export function removeLegacyPendingLinks(storage){
  try{
    const keys=[];for(let i=0;i<(storage?.length??0);i++){const key=storage.key(i);if(typeof key==='string'&&key.startsWith(LEGACY_PENDING_PREFIX))keys.push(key);}
    for(const key of keys)storage.removeItem(key);
    return keys.length;
  }catch(_){return 0;}
}
const denied=error=>/permission.denied/i.test(String(error?.code??error?.message??''));
export function createMessagingRecordLinkTransport({db,ref,get}={}){
  if(!db||[ref,get].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase database adapters required');
  return Object.freeze({
    async readLink(actor,record){
      const path=pathOf(actor,record);if(!path)return fail('invalid');
      try{
        const value=(await get(ref(db,path))).val();
        if(value===null)return fail('missing');
        if(!isConversationId(value?.conversationId)||!isMessageId(value.messageId)||!isPersonId(value.createdBy)||!isMessagingTimestamp(value.createdAt))return fail('unavailable');
        return {status:'ok',conversationId:value.conversationId,messageId:value.messageId};
      }catch(error){return fail(denied(error)?'forbidden':'unavailable');}
    }
  });
}
