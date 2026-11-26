// Trusted server-side message transitions. The adapter must authenticate the
// actor, check current membership at commit and perform a per-record atomic write.
// No database, HTTP endpoint, or production credentials are configured here.
import {createHmac,createSecretKey,timingSafeEqual} from 'node:crypto';
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,messageIdFor,projectMessagingMessage,validateRoomMessageInput} from '../test-harness/messaging-preview/workspace-messaging-core.js';

const allowed={send:['type','requestId','input'],edit:['type','messageId','expectedRevision','input'],remove:['type','messageId','expectedRevision']};
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const fail=status=>({status});
const validDigest=v=>typeof v==='string'&&v.length===64&&/^[0-9a-f]{64}$/.test(v);

// A newly requested confirmation may only target people who can read the
// original message. Subsequent edits open a fresh round for the same targets.
function confirmationFor(input,previous,context,revision,createdAt){
  if(!input.confirmationRequested)return {};
  let targets=previous?.confirmation?.targets;
  if(!targets){
    if(!record(context.members))throw new TypeError('Missing trusted members');
    targets=Object.fromEntries(Object.entries(context.members).filter(([id,m])=>id!==context.personId&&m?.active===true&&isPersonId(id)&&isMessagingTimestamp(m.joinedAt)&&m.joinedAt<createdAt).map(([id,m])=>[id,m.joinedAt]));
  }
  if(!Object.keys(targets).length||Object.keys(targets).length>99)throw new TypeError('No eligible confirmation recipients');
  return {confirmation:{round:revision,targets:{...targets}}};
}

export function createMessagingMessageCommands({digestKey}={}){
  if(!(digestKey instanceof Uint8Array)||digestKey.byteLength<32)throw new TypeError('A server-only retry digest key is required');
  const secret=createSecretKey(digestKey);
  function fingerprint({roomId,conversationId,personId},requestId,input){
    return createHmac('sha256',secret).update(JSON.stringify(['workboard-message-v1',roomId,conversationId,personId,requestId,input])).digest('hex');
  }
  function apply(current,command,context){
    if(!record(command)||!Object.hasOwn(allowed,command.type)||!record(context)||Object.keys(command).some(k=>!allowed[command.type].includes(k)))return fail('invalid');
    const {roomId,conversationId,personId,joinedAt,active,conversationStatus,now}=context;
    if(!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isPersonId(personId)||!isMessagingTimestamp(joinedAt)||!isMessagingTimestamp(now))return fail('invalid');
    if(active!==true||conversationStatus!=='active'||conversationId.startsWith('self_')&&conversationId!=='self_'+personId||conversationId.startsWith('dm_')&&!conversationId.slice(3).match(/p_[0-9a-f]{32}/g).includes(personId))return fail('forbidden');
    if(now<=joinedAt)return fail('conflict');
    const type=command.type;let id,input,digest;
    try{
      if(type==='send'){
        id=messageIdFor(personId,command.requestId);input=validateRoomMessageInput(command.input,roomId);digest=fingerprint(context,command.requestId,input);
      }else{
        id=command.messageId;
        if(!isMessageId(id)||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<1)return fail('invalid');
        if(type==='edit')input=validateRoomMessageInput(command.input,roomId);
      }
    }catch(_){return fail('invalid');}
    let previous;
    if(current!=null){
      if(!record(current)||current.id!==id||!isMessagingTimestamp(current.createdAt)||!validDigest(current.sendDigest))return fail('unavailable');
      if(current.createdAt<=joinedAt)return fail('forbidden');
      try{previous=projectMessagingMessage(current,{roomId,joinedAt});}catch(_){return fail('unavailable');}
      if(previous.senderId!==personId)return fail('forbidden');
      if(now<Math.max(previous.createdAt,previous.editedAt??0,previous.deletedAt??0))return fail('conflict');
    }
    if(type==='send'){
      if(previous){
        if(!timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(current.sendDigest,'hex')))return fail('conflict');
        return {status:'sent',id,changed:false,record:structuredClone(current),message:previous};
      }
      let confirmation;try{confirmation=confirmationFor(input,null,context,1,now);}catch(_){return fail('invalid');}
      const next={id,senderId:personId,createdAt:now,revision:1,...input,...confirmation,sendDigest:digest};
      return {status:'sent',id,changed:true,record:next,message:projectMessagingMessage(next,{roomId,joinedAt})};
    }
    if(!previous||previous.deletedAt!=null)return fail('forbidden');
    if(previous.revision!==command.expectedRevision||previous.revision>=Number.MAX_SAFE_INTEGER)return fail('conflict');
    if(type==='edit'&&(input.attachmentIds.length!==previous.attachmentIds.length||input.attachmentIds.some((value,i)=>value!==previous.attachmentIds[i])))return fail('conflict');
    const base={id,senderId:previous.senderId,createdAt:previous.createdAt,revision:previous.revision+1,sendDigest:current.sendDigest};
    let confirmation={};
    if(type==='edit')try{confirmation=confirmationFor(input,previous,context,base.revision,base.createdAt);}catch(_){return fail('invalid');}
    const next=type==='remove'?{...base,deletedAt:now}:{...base,...input,...confirmation,editedAt:now};
    return {status:'ok',changed:true,record:next,message:projectMessagingMessage(next,{roomId,joinedAt})};
  }
  return Object.freeze({apply});
}
