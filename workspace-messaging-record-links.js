// Shared links from a task/schedule to the message it was created from.
// One link per business record, stored only in the authorized messaging area:
// anyone who can read the record and is currently allowed to read the source
// message may open it. Rules check the reader's own binding and membership on
// each link, so a parent read can never bypass them. Links are keyed by record,
// and record creators by stable personId (never the device UID), so a future
// account login inherits them unchanged. Business records stay untouched: no
// body, title, sender or attachment is copied.
import {isConversationId,isMessageId,isMessagingRoomId,isPersonId,isMessagingTimestamp} from './workspace-messaging-core.js';
const types=new Set(['task','schedule']);
const fail=status=>({status});
const keyOk=v=>typeof v==='string'&&v.length>0&&new TextEncoder().encode(v).length<=700&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
export const recordLinkKey=ref=>types.has(ref?.type)&&keyOk(ref?.recordId)?ref.type+'/'+ref.recordId:null;
function pathOf({roomId,personId},ref){
  const key=recordLinkKey(ref);
  return isMessagingRoomId(roomId)&&isPersonId(personId)&&key&&ref.roomId===roomId?['messagingV1',roomId,'recordLinks',key].join('/'):null;
}
const denied=error=>/permission.denied/i.test(String(error?.code??error?.message??''));
const errorStatus=error=>denied(error)?'forbidden':'unavailable';
export function createMessagingRecordLinkTransport({db,ref,get,set,serverTimestamp}={}){
  if(!db||[ref,get,set,serverTimestamp].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase database adapters required');
  async function readLink(actor,record){
    const path=pathOf(actor,record);if(!path)return fail('invalid');
    try{
      const value=(await get(ref(db,path))).val();
      if(value===null)return fail('missing');
      if(!isConversationId(value?.conversationId)||!isMessageId(value.messageId)||!isPersonId(value.createdBy)||!isMessagingTimestamp(value.createdAt))return fail('unavailable');
      return {status:'ok',conversationId:value.conversationId,messageId:value.messageId};
    }catch(error){return fail(errorStatus(error));}
  }
  return Object.freeze({
    readLink,
    // Idempotent: Rules accept only the first write of a record's link. A denied
    // retry is accepted when the stored link already points at the same message.
    async writeLink(actor,record,{conversationId,messageId}={}){
      const path=pathOf(actor,record);if(!path||!isConversationId(conversationId)||!isMessageId(messageId))return fail('invalid');
      try{await set(ref(db,path),{conversationId,messageId,createdBy:actor.personId,createdAt:serverTimestamp()});return {status:'ok'};}
      catch(error){
        if(!denied(error))return fail('unavailable');
        const existing=await readLink(actor,record);
        if(existing.status==='ok')return existing.conversationId===conversationId&&existing.messageId===messageId?{status:'ok'}:fail('conflict');
        return fail(existing.status==='unavailable'?'unavailable':'forbidden');
      }
    }
  });
}
