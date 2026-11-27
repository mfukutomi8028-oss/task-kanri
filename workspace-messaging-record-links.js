// Permanent links from a task/schedule to the message it was created from.
// Stored only in the authorized messaging area, keyed by the stable personId
// (never the device UID), so a future account login can inherit them unchanged.
// Business records stay untouched: no body, title, sender or attachment is copied.
import {isConversationId,isMessageId,isMessagingRoomId,isPersonId,isMessagingTimestamp} from './workspace-messaging-core.js';
const types=new Set(['task','schedule']);
const fail=status=>({status});
const keyOk=v=>typeof v==='string'&&v.length>0&&new TextEncoder().encode(v).length<=700&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
export const recordLinkKey=ref=>types.has(ref?.type)&&keyOk(ref?.recordId)?ref.type+'/'+ref.recordId:null;
function pathOf({roomId,personId},ref){
  const key=recordLinkKey(ref);
  return isMessagingRoomId(roomId)&&isPersonId(personId)&&key&&ref.roomId===roomId?['messagingV1',roomId,'recordLinks',personId,key].join('/'):null;
}
const errorStatus=error=>/permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable';
export function createMessagingRecordLinkTransport({db,ref,get,set,serverTimestamp}={}){
  if(!db||[ref,get,set,serverTimestamp].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase database adapters required');
  return Object.freeze({
    async readLink(actor,record){
      const path=pathOf(actor,record);if(!path)return fail('invalid');
      try{
        const value=(await get(ref(db,path))).val();
        if(value===null)return fail('missing');
        if(!isConversationId(value?.conversationId)||!isMessageId(value.messageId)||!isMessagingTimestamp(value.createdAt))return fail('unavailable');
        return {status:'ok',conversationId:value.conversationId,messageId:value.messageId};
      }catch(error){return fail(errorStatus(error));}
    },
    // Idempotent: the key is the record, and Rules only allow rewriting the same target.
    async writeLink(actor,record,{conversationId,messageId}={}){
      const path=pathOf(actor,record);if(!path||!isConversationId(conversationId)||!isMessageId(messageId))return fail('invalid');
      try{
        const existing=(await get(ref(db,path))).val();
        if(existing!==null)return existing?.conversationId===conversationId&&existing.messageId===messageId?{status:'ok'}:fail('conflict');
        await set(ref(db,path),{conversationId,messageId,createdAt:serverTimestamp()});return {status:'ok'};
      }catch(error){return fail(errorStatus(error));}
    }
  });
}
