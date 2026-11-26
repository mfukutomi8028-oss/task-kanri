// Server-side orchestration. Persistence must enforce the exact supplied actor,
// membership epoch and record at commit time, not just before a transaction.
import {createMessagingMessageCommands} from './messaging-message-commands.mjs';
import {createFirebaseMessagingActivityPublisher} from './messaging-activity-publisher.mjs';
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,messageIdFor,validateRoomMessageInput} from '../test-harness/messaging-preview/workspace-messaging-core.js';
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const requestFields=new Set(['token','roomId','conversationId','command','expectedPersonId']);
const commandFields={send:['type','requestId','input'],edit:['type','messageId','expectedRevision','input'],remove:['type','messageId','expectedRevision']};
const fail=status=>({status});

export function createMessagingMutationService({verifyToken,readBinding,readControl,transactMessage,digestKey,clock=Date.now,publishActivity=null,claimAttachments=null}={}){
  if([verifyToken,readBinding,readControl,transactMessage,clock].some(fn=>typeof fn!=='function')||publishActivity!==null&&typeof publishActivity!=='function'||claimAttachments!==null&&typeof claimAttachments!=='function')throw new TypeError('Trusted mutation adapters required');
  const commands=createMessagingMessageCommands({digestKey});
  async function authorize(token,roomId,conversationId){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    const uid=identity?.uid;if(!uidKey(uid))return null;
    const binding=await readBinding({roomId,uid});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId))return null;
    const personId=binding.personId,control=await readControl({roomId,conversationId});
    const member=control?.members?.[personId];
    if(control?.status!=='active'||member?.active!==true||!isMessagingTimestamp(member.joinedAt))return null;
    return {uid,roomId,conversationId,personId,joinedAt:member.joinedAt,members:control.members,controlRevision:control.revision};
  }
  async function mutate(request){
    if(!record(request)||Object.keys(request).some(k=>!requestFields.has(k)))return fail('invalid');
    const {token,roomId,conversationId,command,expectedPersonId}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||expectedPersonId!==undefined&&!isPersonId(expectedPersonId)||!record(command)||typeof command.type!=='string'||!Object.hasOwn(commandFields,command.type)||Object.keys(command).some(k=>!commandFields[command.type].includes(k)))return fail('invalid');
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
      if(!access||expectedPersonId!==undefined&&access.personId!==expectedPersonId)return fail('forbidden');
      const messageId=type==='send'?messageIdFor(access.personId,clean.requestId):clean.messageId;
      if(!messageId.startsWith('msg_'+access.personId+'_'))return fail('forbidden');
      const now=clock();if(!isMessagingTimestamp(now)||now<=access.joinedAt)return fail('conflict');
      const {members,controlRevision,...actor}=access;
      const requested=clean.input?.confirmationRequested===true;
      if(requested&&(!Number.isSafeInteger(controlRevision)||controlRevision<1))return fail('unavailable');
      if(type==='send'&&clean.input.attachmentIds.length){
        if(!claimAttachments)return fail('unavailable');
        const proposed=commands.apply(null,clean,{...access,now,active:true,conversationStatus:'active'});
        if(proposed.status!=='sent')return fail(proposed.status);
        const claimed=await claimAttachments({roomId,conversationId,personId:access.personId,joinedAt:access.joinedAt,requestId:clean.requestId,messageId,attachmentIds:clean.input.attachmentIds});
        if(claimed?.status!=='ok')return fail(['invalid','conflict','forbidden'].includes(claimed?.status)?claimed.status:claimed?.status==='expired'?'conflict':'unavailable');
        const fresh=await authorize(token,roomId,conversationId);
        if(!fresh||fresh.uid!==access.uid||fresh.personId!==access.personId||fresh.joinedAt!==access.joinedAt)return fail('forbidden');
      }
      const scope=Object.freeze({...actor,messageId,...(requested?{controlRevision}:{})});
      const result=await transactMessage(scope,current=>commands.apply(current,clean,{...access,now,active:true,conversationStatus:'active'}));
      if(result?.status!=='ok')return fail(result?.status==='forbidden'?'forbidden':'unavailable');
      const decision=result.decision;
      const success=type==='send'&&decision?.status==='sent'&&decision.id===messageId?{status:'sent',id:messageId}:type!=='send'&&decision?.status==='ok'&&decision.message?.id===messageId?{status:'ok',message:decision.message}:null;
      // The message is already committed. A failed invalidation must not
      // change its outcome or invite a duplicate send. An idempotent send
      // retry also republishes the signal after a lost response or write.
      let activityPending=false;
      if(success&&publishActivity){
        try{activityPending=(await publishActivity({roomId,conversationId}))?.status!=='ok';}catch(_){activityPending=true;}
      }
      const latest=await authorize(token,roomId,conversationId);
      if(!latest||latest.uid!==access.uid||latest.personId!==access.personId||latest.joinedAt!==access.joinedAt)return fail('forbidden');
      if(success)return activityPending?{...success,activityPending:true}:success;
      return fail(['invalid','conflict','forbidden'].includes(decision?.status)?decision.status:'unavailable');
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({mutate});
}

// The factory must create a server-only Admin database instance with this exact
// databaseAuthVariableOverride and dispose it after the callback. Never mint a
// client authentication token containing this reserved service scope.
export function createFirebaseMessagingMutationService({auth,database,withActorDatabase,digestKey,clock,claimAttachments=null}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function'||typeof withActorDatabase!=='function')throw new TypeError('Scoped Firebase adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  return createMessagingMutationService({digestKey,clock,claimAttachments,publishActivity:createFirebaseMessagingActivityPublisher({database}),
    verifyToken:token=>auth.verifyIdToken(token,true),
    readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),
    readControl:({roomId,conversationId})=>read('messagingV1/'+roomId+'/control/'+conversationId),
    async transactMessage(scope,decide){
      const override={uid:scope.uid,token:{workboardMessageMutationV1:true,roomId:scope.roomId,conversationId:scope.conversationId,personId:scope.personId,joinedAt:scope.joinedAt,messageId:scope.messageId,...(scope.controlRevision===undefined?{}:{controlRevision:scope.controlRevision})}};
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
