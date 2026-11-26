// Trusted upload orchestration. The private bucket and durable quota ledger
// remain inaccessible to clients. A ready upload is not yet a message reference.
import {createHash} from 'node:crypto';
import {isMessagingRoomId,isConversationId,isPersonId,isMessagingTimestamp} from '../test-harness/messaging-preview/workspace-messaging-core.js';
import {inspectMessagingAttachment,readMessagingAttachmentBody,MESSAGING_ATTACHMENT_MAX_BYTES} from './messaging-attachment-content.mjs';
const fail=status=>({status});
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const requestIdValid=v=>typeof v==='string'&&/^q_[0-9a-f]{32}$/.test(v);
const fields=new Set(['token','roomId','conversationId','expectedPersonId','requestId','slot','filename','mime','declaredBytes','body']);
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const scopeFields=['roomId','conversationId','uploaderId','joinedAt','requestId','slot','filename','mime','declaredBytes'];
const sameScope=(row,target)=>record(row)&&scopeFields.every(key=>row[key]===target[key]);
const sameContent=(row,content)=>row.actualBytes===content.bytes&&row.sha256===content.sha256;
const publicResult=(attachmentId,{filename,mime,bytes})=>({status:'ok',attachmentId,filename,mime,bytes});

export function createMessagingAttachmentUploadService({verifyToken,readBinding,readControl,reserve,readLedger,putObject,readObject,finalize,clock=Date.now}={}){
  if([verifyToken,readBinding,readControl,reserve,readLedger,putObject,readObject,finalize,clock].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted attachment adapters required');
  async function authorize(token,roomId,conversationId){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    const uid=identity?.uid;if(!uidKey(uid))return null;
    const binding=await readBinding({uid,roomId});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.active!==true||binding.approved!==true||!isPersonId(binding.personId))return null;
    const control=await readControl({roomId,conversationId}),member=control?.members?.[binding.personId];
    if(control?.id!==conversationId||control.roomId!==roomId||control.status!=='active'||member?.active!==true||!isMessagingTimestamp(member.joinedAt))return null;
    return {uid,personId:binding.personId,joinedAt:member.joinedAt};
  }
  async function upload(request){
    if(!record(request)||Object.keys(request).some(key=>!fields.has(key)))return fail('invalid');
    const {token,roomId,conversationId,expectedPersonId,requestId,slot,filename,mime,declaredBytes,body}=request;
    if(typeof token!=='string'||!token||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isPersonId(expectedPersonId)||!requestIdValid(requestId)||!Number.isInteger(slot)||slot<0||slot>4||typeof filename!=='string'||typeof mime!=='string'||!Number.isSafeInteger(declaredBytes)||declaredBytes<1||declaredBytes>MESSAGING_ATTACHMENT_MAX_BYTES||typeof body?.getReader!=='function')return fail('invalid');
    try{
      const actor=await authorize(token,roomId,conversationId);
      if(!actor||actor.personId!==expectedPersonId)return fail('forbidden');
      const current=async()=>{const a=await authorize(token,roomId,conversationId);return a!==null&&a.uid===actor.uid&&a.personId===actor.personId&&a.joinedAt===actor.joinedAt;};
      let bytes,content;try{bytes=await readMessagingAttachmentBody(body,declaredBytes);content=inspectMessagingAttachment({filename,mime,bytes});}catch(_){return fail('invalid');}
      if(!await current())return fail('forbidden');
      const target={roomId,conversationId,uploaderId:actor.personId,joinedAt:actor.joinedAt,requestId,slot,filename,mime,declaredBytes};
      const reservation=await reserve(target);
      if(reservation?.status!=='ok')return fail(['invalid','conflict','expired','storage-limit','daily-limit'].includes(reservation?.status)?reservation.status:'unavailable');
      const {attachmentId}=reservation;if(!uuid(attachmentId))return fail('unavailable');
      async function checkedLedger(){const row=await readLedger(attachmentId);if(row?.attachmentId!==attachmentId||!sameScope(row,target))return null;return row;}
      let row=await checkedLedger();if(!row)return fail('conflict');
      if(!await current())return fail('forbidden');
      // Never reuse a deleted or attached slot or return another request's row.
      if(row.state==='ready')return sameContent(row,content)?publicResult(attachmentId,content):fail('conflict');
      if(row.state!=='reserved'&&row.state!=='uploaded')return fail('conflict');
      if(!isMessagingTimestamp(row.expiresAt)||row.expiresAt<=clock())return fail('expired');
      // The storage adapter must use create-only writes, not an upsert. If an
      // earlier attempt stored the object but lost its response, verify the
      // actual immutable object before recovering the ledger transition.
      let stored;try{stored=await putObject(attachmentId,bytes,mime);}catch(_){stored=fail('unavailable');}
      if(stored?.status!=='stored'){
        if(!['exists','unavailable'].includes(stored?.status))return fail('unavailable');
        const prior=await readObject(attachmentId);
        if(!(prior instanceof Uint8Array)||prior.byteLength<1||prior.byteLength>MESSAGING_ATTACHMENT_MAX_BYTES)return fail('unavailable');
        if(prior.byteLength!==content.bytes||sha(prior)!==content.sha256)return fail('conflict');
      }
      if(!await current())return fail('forbidden');
      row=await checkedLedger();if(!row)return fail('conflict');
      if(row.state==='ready')return sameContent(row,content)?publicResult(attachmentId,content):fail('conflict');
      if(row.state!=='reserved'&&row.state!=='uploaded')return fail('conflict');
      if(!isMessagingTimestamp(row.expiresAt)||row.expiresAt<=clock())return fail('expired');
      const ready=await finalize({...target,attachmentId,actualBytes:content.bytes,sha256:content.sha256});
      if(!await current())return fail('forbidden');
      // A lost finalize response may still have committed; only the durable
      // ledger can prove readiness. Uncertain objects remain quota-accounted.
      row=await checkedLedger();if(row?.state==='ready'&&sameContent(row,content))return publicResult(attachmentId,content);
      if(row?.state==='ready')return fail('conflict');
      return fail(ready?.status==='expired'?'expired':'unavailable');
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({upload});
}
