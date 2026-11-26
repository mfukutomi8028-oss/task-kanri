// Shared message decorations. Membership and manager authorization are enforced
// by the database independently of the caller's current UI state.
import {isMessagingRoomId,isConversationId,isMessageId,isPersonId} from './workspace-messaging-core.js';
export const messagingReactionTypes=Object.freeze(['like','thanks','agree','checking','question']);
const validReaction=value=>messagingReactionTypes.includes(value);
const fail=status=>({status});
function pathOf(scope,kind,own=false){
  const {roomId,conversationId,messageId,personId}=scope??{};
  if(!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isMessageId(messageId)||!isPersonId(personId)||kind==='sharedPins'&&!conversationId.startsWith('group_'))throw new TypeError('Invalid shared state scope');
  return ['messagingV1',roomId,kind,conversationId,messageId,...(own?[personId]:[])].join('/');
}
export function createMessagingSharedTransport({db,ref,get,set}={}){
  if(!db||[ref,get,set].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase adapters required');
  async function invoke(scope,kind,own,work){
    let path;try{path=pathOf(scope,kind,own);}catch(_){return fail('invalid');}
    try{return await work(ref(db,path));}catch(error){return fail(/permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable');}
  }
  return Object.freeze({
    readReactions(scope){return invoke(scope,'reactions',false,async target=>{
      const value=(await get(target)).val();if(value===null)return {status:'ok',reactions:{}};
      if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>100||Object.entries(value).some(([id,reaction])=>!isPersonId(id)||!validReaction(reaction)))return fail('unavailable');
      return {status:'ok',reactions:{...value}};
    });},
    setReaction(scope){return invoke(scope,'reactions',true,async target=>{
      if(scope.reaction!==null&&!validReaction(scope.reaction))return fail('invalid');
      await set(target,scope.reaction);return fail('ok');
    });},
    readSharedPin(scope){return invoke(scope,'sharedPins',false,async target=>{
      const value=(await get(target)).val();return value!==null&&value!==true?fail('unavailable'):{status:'ok',pinned:value===true};
    });},
    setSharedPin(scope){return invoke(scope,'sharedPins',false,async target=>{
      if(typeof scope.pinned!=='boolean')return fail('invalid');
      await set(target,scope.pinned?true:null);return fail('ok');
    });}
  });
}
