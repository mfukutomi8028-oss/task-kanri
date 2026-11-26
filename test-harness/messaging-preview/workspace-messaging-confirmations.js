// Explicit confirmations are separate from read cursors. Firebase Rules check
// current membership, the immutable target epoch, and the active message round.
import {isMessagingRoomId,isConversationId,isMessageId,isPersonId,isMessagingTimestamp} from './workspace-messaging-core.js';
const fail=status=>({status});
function pathOf(scope,own){
  const {roomId,conversationId,messageId,round,personId}=scope??{};
  if(!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isMessageId(messageId)||!Number.isSafeInteger(round)||round<1||!isPersonId(personId))throw new TypeError('Invalid confirmation scope');
  return ['messagingV1',roomId,'confirmationReceipts',conversationId,messageId,String(round),...(own?[personId]:[])].join('/');
}
function timestamp(value){if(!isMessagingTimestamp(value))throw new TypeError('Invalid confirmation timestamp');return value;}
export function createMessagingConfirmationTransport({db,ref,get,runTransaction,serverTimestamp}={}){
  if(!db||[ref,get,runTransaction,serverTimestamp].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase adapters required');
  async function invoke(scope,own,work){
    let target;try{target=pathOf(scope,own);}catch(_){return fail('invalid');}
    try{return await work(ref(db,target));}catch(error){return fail(/permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable');}
  }
  return Object.freeze({
    readOwnConfirmation(scope){return invoke(scope,true,async target=>{
      const raw=(await get(target)).val();return {status:'ok',confirmedAt:raw===null?null:timestamp(raw)};
    });},
    confirm(scope){return invoke(scope,true,async target=>{
      // Keep the first server timestamp even for concurrent retries from another device.
      const tx=await runTransaction(target,current=>current===null?serverTimestamp():timestamp(current),{applyLocally:false});
      if(!tx.committed)return fail('unavailable');
      return {status:'ok',confirmedAt:timestamp(tx.snapshot.val())};
    });},
    readReceipts(scope){return invoke(scope,false,async target=>{
      const raw=(await get(target)).val();if(raw===null)return {status:'ok',receipts:{}};
      if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>99||Object.keys(raw).some(id=>!isPersonId(id)))return fail('unavailable');
      return {status:'ok',receipts:Object.fromEntries(Object.entries(raw).map(([id,value])=>[id,timestamp(value)]))};
    });}
  });
}
