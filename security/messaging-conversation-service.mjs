// Trusted conversation commands. No user-supplied identity, credentials or
// direct client control writes. The persistence adapter must enforce the
// binding and roster revision at the commit boundary.
import {isConversationId,isMessagingRoomId,isMessagingTimestamp,isPersonId} from '../workspace-messaging-core.js';
import {applyConversationCommand} from './messaging-conversation-commands.mjs';
import {createFirebaseMessagingDirectoryServices} from './messaging-directory-service.mjs';
const fail=status=>({status});
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const validLabel=v=>typeof v==='string'&&v.length>0&&v.length<=64&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const validToken=v=>typeof v==='string'&&v.length>0&&v.length<=16384;
const fields=new Set(['token','roomId','conversationId','command','expectedPersonId']);
const peopleFields=new Set(['token','roomId','expectedPersonId']);
function decodeRoster(roster){
  if(!record(roster)||!Number.isSafeInteger(roster.revision)||roster.revision<1||!record(roster.people)||Object.keys(roster.people).length>1000)throw new TypeError('Invalid approved roster');
  const people=Object.entries(roster.people).map(([personId,value])=>{
    if(!isPersonId(personId)||!record(value)||!validLabel(value.displayName))throw new TypeError('Invalid roster person');
    return {personId,displayName:value.displayName};
  });
  return {revision:roster.revision,people};
}
export function createMessagingConversationService({verifyToken,readBinding,readRoster,transactControl,reconcileIndex,clock=Date.now}={}){
  if([verifyToken,readBinding,readRoster,transactControl,reconcileIndex,clock].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted conversation adapters required');
  async function authorize(token,roomId){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    if(!uidKey(identity?.uid))return null;
    const uid=identity.uid,binding=await readBinding({roomId,uid});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId))return null;
    const roster=decodeRoster(await readRoster({roomId}));
    if(!roster.people.some(p=>p.personId===binding.personId))return null;
    return {uid,personId:binding.personId,roster};
  }
  const sameActor=(first,second)=>second!==null&&second.uid===first.uid&&second.personId===first.personId;
  async function execute(request){
    if(!record(request)||Object.keys(request).some(k=>!fields.has(k)))return fail('invalid');
    const {token,roomId,conversationId,command,expectedPersonId}=request;
    if(!validToken(token)||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||expectedPersonId!==undefined&&!isPersonId(expectedPersonId)||!record(command))return fail('invalid');
    try{
      const actor=await authorize(token,roomId);if(!actor||expectedPersonId!==undefined&&actor.personId!==expectedPersonId)return fail('forbidden');
      const {uid,personId,roster}=actor,now=clock();if(!isMessagingTimestamp(now))return fail('unavailable');
      const scope=Object.freeze({uid,personId,roomId,conversationId,rosterRevision:roster.revision});
      const result=await transactControl(scope,current=>applyConversationCommand(current,command,{roomId,conversationId,personId,now,approvedPersonIds:roster.people.map(p=>p.personId)}));
      if(result?.status!=='ok')return fail(result?.status==='forbidden'?'forbidden':'unavailable');
      const decision=result.decision;if(decision?.status!=='ok')return fail(['invalid','forbidden','conflict','limit'].includes(decision?.status)?decision.status:'unavailable');
      // Control is authoritative and committed. An index failure must not cause
      // the caller to create a duplicate group. Repair is separately retryable.
      let indexPending=true;
      try{indexPending=(await reconcileIndex({roomId,conversationId}))?.status!=='ok';}catch(_){/* repair worker can retry */}
      if(!sameActor(actor,await authorize(token,roomId)))return fail('forbidden');
      return {status:'ok',conversationId,revision:decision.control.revision,indexPending};
    }catch(_){return fail('unavailable');}
  }
  async function readPeople(request){
    if(!record(request)||Object.keys(request).some(k=>!peopleFields.has(k))||!validToken(request.token)||!isMessagingRoomId(request.roomId)||request.expectedPersonId!==undefined&&!isPersonId(request.expectedPersonId))return fail('invalid');
    try{
      const actor=await authorize(request.token,request.roomId);if(!actor||request.expectedPersonId!==undefined&&actor.personId!==request.expectedPersonId)return fail('forbidden');
      const final=await authorize(request.token,request.roomId);if(!sameActor(actor,final))return fail('forbidden');
      if(final.roster.revision!==actor.roster.revision)return fail('stale');
      return {status:'ok',roomId:request.roomId,personId:actor.personId,people:[...actor.roster.people].sort((a,b)=>a.personId.localeCompare(b.personId))};
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({execute,readPeople});
}

export function createFirebaseMessagingConversationService({auth,database,withActorDatabase,clock}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function'||typeof withActorDatabase!=='function')throw new TypeError('Scoped Firebase adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  const {index}=createFirebaseMessagingDirectoryServices({auth,database});
  return createMessagingConversationService({clock,verifyToken:token=>auth.verifyIdToken(token,true),readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),readRoster:({roomId})=>read('messagingRosterV1/'+roomId),reconcileIndex:scope=>index.reconcile(scope),
    async transactControl(scope,decide){
      // This override belongs only to a server-owned scoped database instance.
      const override={uid:scope.uid,token:{workboardConversationMutationV1:true,roomId:scope.roomId,conversationId:scope.conversationId,personId:scope.personId,rosterRevision:scope.rosterRevision}};
      try{return await withActorDatabase(override,async db=>{
        const ref=db.ref('messagingV1/'+scope.roomId+'/control/'+scope.conversationId),observer=()=>{};let decision;
        ref.on('value',observer,()=>{});
        try{
          await ref.once('value');
          const tx=await ref.transaction(current=>{decision=decide(current);return decision.changed?decision.control:undefined;},undefined,false);
          if(!decision||decision.changed&&!tx.committed)return fail('unavailable');
          return {status:'ok',decision};
        }finally{ref.off('value',observer);}
      });}catch(error){return fail(/permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable');}
    }
  });
}
