// Trusted attachment link and download boundary. An attachment claim is not a
// grant to download: the live canonical message must contain the same ID.
import {createHash} from 'node:crypto';
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,messageIdFor} from '../test-harness/messaging-preview/workspace-messaging-core.js';
const fail=status=>({status});
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ids=v=>Array.isArray(v)&&v.length>=1&&v.length<=5&&Array.from(v).every(uuid)&&new Set(v).size===v.length;
const requestFields=new Set(['token','roomId','conversationId','expectedPersonId','messageId','attachmentId']);
const claimFields=new Set(['roomId','conversationId','personId','joinedAt','requestId','messageId','attachmentIds']);
const mimeTypes=new Set(['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv']);
const safeFilename=v=>typeof v==='string'&&v===v.trim()&&Array.from(v).length>=1&&Array.from(v).length<=200&&!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v);
const size=v=>Number.isSafeInteger(v)&&v>=1&&v<=5000000;
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const sameActor=(a,b)=>a!==null&&b!==null&&a.uid===b.uid&&a.personId===b.personId&&a.joinedAt===b.joinedAt;
export function createMessagingAttachmentAccessService({verifyToken,readBinding,readControl,readMessage,readLedger,reserveDownload,readObject,claimBatch}={}){
  if([verifyToken,readBinding,readControl,readMessage,readLedger,reserveDownload,readObject,claimBatch].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted attachment access adapters required');
  async function authorize({token,roomId,conversationId,expectedPersonId}){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    const uid=identity?.uid;if(!uidKey(uid))return null;
    const binding=await readBinding({roomId,uid});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId)||binding.personId!==expectedPersonId)return null;
    const control=await readControl({roomId,conversationId}),member=control?.members?.[binding.personId];
    if(control?.id!==conversationId||control.roomId!==roomId||!['active','archived'].includes(control.status)||member?.active!==true||!isMessagingTimestamp(member.joinedAt))return null;
    return {uid,personId:binding.personId,joinedAt:member.joinedAt};
  }
  async function verifiedReference({roomId,conversationId,messageId,attachmentId},actor){
    const message=await readMessage({roomId,conversationId,messageId});
    if(!record(message)||message.id!==messageId||!isPersonId(message.senderId)||!messageId.startsWith('msg_'+message.senderId+'_')||!isMessagingTimestamp(message.createdAt)||message.createdAt<=actor.joinedAt||!Number.isSafeInteger(message.revision)||message.revision<1||message.deletedAt!=null||!ids(message.attachmentIds)||!message.attachmentIds.includes(attachmentId))return null;
    const row=await readLedger(attachmentId);
    if(!record(row)||row.attachmentId!==attachmentId||row.roomId!==roomId||row.conversationId!==conversationId||row.state!=='attached'||row.messageId!==messageId||row.uploaderId!==message.senderId||!isMessagingTimestamp(row.joinedAt)||row.joinedAt>=message.createdAt||typeof row.requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(row.requestId)||messageIdFor(row.uploaderId,row.requestId)!==messageId||!Number.isInteger(row.slot)||row.slot<0||row.slot>4||!safeFilename(row.filename)||!mimeTypes.has(row.mime)||!size(row.actualBytes)||row.actualBytes!==row.declaredBytes||!hash(row.sha256))return null;
    return {revision:message.revision,createdAt:message.createdAt,filename:row.filename,mime:row.mime,bytes:row.actualBytes,sha256:row.sha256};
  }
  async function download(request){
    if(!record(request)||Object.keys(request).some(k=>!requestFields.has(k)))return fail('invalid');
    const {token,roomId,conversationId,expectedPersonId,messageId,attachmentId}=request;
    if(typeof token!=='string'||!token||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isPersonId(expectedPersonId)||!isMessageId(messageId)||!uuid(attachmentId))return fail('invalid');
    try{
      const actor=await authorize(request);if(!actor)return fail('forbidden');
      const reference=await verifiedReference(request,actor);if(!reference)return fail('forbidden');
      if(!sameActor(actor,await authorize(request)))return fail('forbidden');
      // Charge before fetching. Failed or revoked reads remain charged rather
      // than allowing a retry/refund race to bypass the free-tier budget.
      const budget=await reserveDownload({roomId,personId:actor.personId,bytes:reference.bytes});
      if(budget?.status!=='ok')return fail(budget?.status==='limit'?'limit':'unavailable');
      const bytes=await readObject(attachmentId);
      if(!(bytes instanceof Uint8Array)||bytes.byteLength!==reference.bytes||createHash('sha256').update(bytes).digest('hex')!==reference.sha256)return fail('unavailable');
      const finalActor=await authorize(request);if(!sameActor(actor,finalActor))return fail('forbidden');
      const latest=await verifiedReference(request,finalActor);
      if(!latest||Object.keys(reference).some(key=>latest[key]!==reference[key])||!sameActor(actor,await authorize(request)))return fail('forbidden');
      return {status:'ok',filename:reference.filename,mime:reference.mime,bytes};
    }catch(_){return fail('unavailable');}
  }
  // Internal-only operation: the mutation service supplies the authenticated
  // sender and epoch. The SQL adapter must claim the entire batch atomically.
  async function claim(target){
    if(!record(target)||Object.keys(target).some(k=>!claimFields.has(k)))return fail('invalid');
    const {roomId,conversationId,personId,joinedAt,requestId,messageId,attachmentIds}=target;
    if(!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isPersonId(personId)||!isMessagingTimestamp(joinedAt)||typeof requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(requestId)||messageId!==messageIdFor(personId,requestId)||!ids(attachmentIds))return fail('invalid');
    try{
      const result=await claimBatch({roomId,conversationId,personId,joinedAt,requestId,messageId,attachmentIds:[...attachmentIds]});
      return fail(['ok','invalid','conflict','expired','forbidden'].includes(result?.status)?result.status:'unavailable');
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({download,claim});
}
