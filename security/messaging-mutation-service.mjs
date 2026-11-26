// Server-side orchestration. Persistence must enforce the exact supplied actor,
// membership epoch and record at commit time, not just before a transaction.
import {createMessagingMessageCommands} from './messaging-message-commands.mjs';
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,messageIdFor,validateRoomMessageInput} from '../test-harness/messaging-preview/workspace-messaging-core.js';
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const requestFields=new Set(['token','roomId','conversationId','command']);
const commandFields={send:['type','requestId','input'],edit:['type','messageId','expectedRevision','input'],remove:['type','messageId','expectedRevision']};
const fail=status=>({status});

export function createMessagingMutationService({verifyToken,readBinding,readControl,transactMessage,digestKey,clock=Date.now}={}){
  if([verifyToken,readBinding,readControl,transactMessage,clock].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted mutation adapters required');
  const commands=createMessagingMessageCommands({digestKey});
  async function authorize(token,roomId,conversationId){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    const uid=identity?.uid;if(!uidKey(uid))return null;
    const binding=await readBinding({roomId,uid});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId))return null;
    const personId=binding.personId,control=await readControl({roomId,conversationId});
    const member=control?.members?.[personId];
    if(control?.status!=='active'||member?.active!==true||!isMessagingTimestamp(member.joinedAt))return null;
    return {uid,roomId,conversationId,personId,joinedAt:member.joinedAt};
  }
  async function mutate(request){
    if(!record(request)||Object.keys(request).some(k=>!requestFields.has(k)))return fail('invalid');
    const {token,roomId,conversationId,command}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!record(command)||!Object.hasOwn(commandFields,command.type)||Object.keys(command).some(k=>!commandFields[command.type].includes(k)))return fail('invalid');
    const type=command.type;
    let clean;
    try{
      if(type==='send'){
        if(typeof command.requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(command.requestId))return fail('invalid');
        clean={type,requestId:command.requestId,input:validateRoomMessageInput(command.input,roomId)};
      }else{
        if(!isMessageId(command.messageId)||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<1)return fail('invalid');
        clean={type,messageId:command.messageId,expectedRevision:command.expectedRevision};
        if(type==='edit')clean.input=validateRoomMessageInput(command.input,roomId);
      }
    }catch(_){return fail('invalid');}
    try{
      const access=await authorize(token,roomId,conversationId);
      if(!access)return fail('forbidden');
      const messageId=type==='send'?messageIdFor(access.personId,clean.requestId):clean.messageId;
      if(!messageId.startsWith('msg_'+access.personId+'_'))return fail('forbidden');
      const now=clock();if(!isMessagingTimestamp(now)||now<=access.joinedAt)return fail('conflict');
      const scope=Object.freeze({...access,messageId});
      const result=await transactMessage(scope,current=>commands.apply(current,clean,{...access,now,active:true,conversationStatus:'active'}));
      if(result?.status!=='ok')return fail(result?.status==='forbidden'?'forbidden':'unavailable');
      const latest=await authorize(token,roomId,conversationId);
      if(!latest||latest.uid!==access.uid||latest.personId!==access.personId||latest.joinedAt!==access.joinedAt)return fail('forbidden');
      const decision=result.decision;
      if(type==='send'&&decision?.status==='sent'&&decision.id===messageId)return {status:'sent',id:messageId};
      if(type!=='send'&&decision?.status==='ok'&&decision.message?.id===messageId)return {status:'ok',message:decision.message};
      return fail(['invalid','conflict','forbidden'].includes(decision?.status)?decision.status:'unavailable');
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({mutate});
}

// The factory must create a server-only Admin database instance with this exact
// databaseAuthVariableOverride and dispose it after the callback. Never mint a
// client authentication token containing this reserved service scope.
export function createFirebaseMessagingMutationService({auth,database,withActorDatabase,digestKey,clock}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function'||typeof withActorDatabase!=='function')throw new TypeError('Scoped Firebase adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  return createMessagingMutationService({digestKey,clock,
    verifyToken:token=>auth.verifyIdToken(token,true),
    readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),
    readControl:({roomId,conversationId})=>read('messagingV1/'+roomId+'/control/'+conversationId),
    async transactMessage(scope,decide){
      const override={uid:scope.uid,token:{workboardMessageMutationV1:true,roomId:scope.roomId,conversationId:scope.conversationId,personId:scope.personId,joinedAt:scope.joinedAt,messageId:scope.messageId}};
      try{
        return await withActorDatabase(override,async db=>{
          const ref=db.ref('messagingV1/'+scope.roomId+'/messages/'+scope.conversationId+'/'+scope.messageId);
          const listener=()=>{};let decision;
          ref.on('value',listener,()=>{});
          try{
            await ref.once('value');
            const result=await ref.transaction(current=>{
              decision=decide(current);
              return decision.changed?decision.record:undefined;
            },undefined,false);
            if(!decision||decision.changed&&!result.committed)return fail('unavailable');
            return {status:'ok',decision};
          }finally{ref.off('value',listener);}
        });
      }catch(error){return fail(/permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable');}
    }
  });
}
