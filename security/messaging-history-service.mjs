// Trusted server-side history boundary. Never import this into the browser.
import {isMessagingRoomId,isPersonId,compareCursor,validateMessageInput} from '../test-harness/messaging-preview/workspace-messaging-core.js';

const requestFields=new Set(['token','roomId','conversationId','before','limit']);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const timestamp=value=>Number.isSafeInteger(value)&&value>=0;
const conversationKey=value=>typeof value==='string'&&/^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$/.test(value);
const messageKey=value=>typeof value==='string'&&/^msg_p_[0-9a-f]{32}_q_[0-9a-f]{32}$/.test(value);
const uidKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);
const cursor=value=>isRecord(value)&&Object.keys(value).length===2&&messageKey(value.id)&&timestamp(value.createdAt);
const status=value=>({status:value});

// Return only the fields needed by the UI. Never expose arbitrary database
// fields, old deleted text or cached titles through the privileged read API.
function projectMessage(raw,roomId,joinedAt,before) {
  if(!isRecord(raw)||!messageKey(raw.id)||!isPersonId(raw.senderId)
      ||!raw.id.startsWith('msg_'+raw.senderId+'_')||!timestamp(raw.createdAt)||raw.createdAt<=joinedAt
      ||!Number.isSafeInteger(raw.revision)||raw.revision<1)throw new TypeError('Invalid stored message');
  const key={createdAt:raw.createdAt,id:raw.id};
  if(before&&compareCursor(key,before)>=0)throw new TypeError('History cursor exceeded');
  const base={id:raw.id,senderId:raw.senderId,createdAt:raw.createdAt,revision:raw.revision};
  if(raw.deletedAt!=null){
    if(!timestamp(raw.deletedAt)||raw.deletedAt<raw.createdAt)throw new TypeError('Invalid deletion timestamp');
    return {...base,deletedAt:raw.deletedAt};
  }
  if(raw.editedAt!=null){
    if(!timestamp(raw.editedAt)||raw.editedAt<raw.createdAt)throw new TypeError('Invalid edit timestamp');
    base.editedAt=raw.editedAt;
  }
  const rawRefs=raw.refs??[];
  if(!Array.isArray(rawRefs)||rawRefs.length>20)throw new TypeError('Invalid stored references');
  const refs=rawRefs.map(ref=>{
    if(!isRecord(ref)||ref.roomId!==roomId)throw new TypeError('Cross-room reference');
    return {roomId:ref.roomId,type:ref.type,recordId:ref.recordId};
  });
  if(raw.replyTo!=null&&!messageKey(raw.replyTo))throw new TypeError('Invalid quote reference');
  const input=validateMessageInput({body:raw.body,replyTo:raw.replyTo??null,refs,
    attachmentIds:raw.attachmentIds??[],confirmationRequested:raw.confirmationRequested??false});
  return {...base,...input};
}

export function createMessagingHistoryService({verifyToken,readBinding,readMember,readPage}={}) {
  if([verifyToken,readBinding,readMember,readPage].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted history adapters required');
  async function authorize({token,roomId,conversationId}) {
    let identity;
    try{identity=await verifyToken(token);}catch(_){return null;}
    if(!uidKey(identity?.uid))return null;
    const uid=identity.uid;
    const binding=await readBinding({roomId,uid});
    if(!isRecord(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true
        ||binding.active!==true||!isPersonId(binding.personId))return null;
    const personId=binding.personId;
    const member=await readMember({roomId,conversationId,personId});
    if(!isRecord(member)||member.active!==true||!timestamp(member.joinedAt)||member.joinedAt>=Number.MAX_SAFE_INTEGER)return null;
    return {uid,personId,joinedAt:member.joinedAt};
  }
  async function readHistory(request) {
    if(!isRecord(request)||Object.keys(request).some(field=>!requestFields.has(field)))return status('invalid');
    const {token,roomId,conversationId,before=null,limit=50}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!conversationKey(conversationId)
        ||!Number.isInteger(limit)||limit<1||limit>50||(before!==null&&!cursor(before)))return status('invalid');
    try {
      const access=await authorize({token,roomId,conversationId});
      if(!access)return status('forbidden');
      // The server, not the caller, supplies the join boundary and the query cap.
      const records=await readPage({roomId,conversationId,joinedAt:access.joinedAt,before,limit});
      if(!Array.isArray(records)||records.length>limit)return status('unavailable');
      const messages=[];const ids=new Set();
      for(const raw of records){
        const item=projectMessage(raw,roomId,access.joinedAt,before);
        if(ids.has(item.id)||messages.length&&compareCursor(messages.at(-1),item)>=0)return status('unavailable');
        ids.add(item.id);messages.push(item);
      }
      // Do not return records if access was revoked/reassigned while reading.
      // The final check is not a transactional guarantee against all races;
      // real deployments must additionally validate the revocation boundary.
      const latest=await authorize({token,roomId,conversationId});
      if(!latest||latest.uid!==access.uid||latest.personId!==access.personId||latest.joinedAt!==access.joinedAt)return status('forbidden');
      const hasMore=messages.length===limit;
      const nextCursor=hasMore?{createdAt:messages[0].createdAt,id:messages[0].id}:null;
      return {status:'ok',messages,nextCursor,hasMore};
    }catch(_){return status('unavailable');}
  }
  return Object.freeze({readHistory});
}

// Adapter for an explicitly trusted Firebase Admin Auth + RTDB instance.
// No credentials are embedded; callers provide the initialized instances.
// The module does not configure or deploy a production service.
export function createFirebaseMessagingHistoryService({auth,database}={}) {
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function')throw new TypeError('Firebase Admin adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  return createMessagingHistoryService({
    verifyToken:token=>auth.verifyIdToken(token,true),
    readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),
    readMember:({roomId,conversationId,personId})=>read('messagingV1/'+roomId+'/control/'+conversationId+'/members/'+personId),
    async readPage({roomId,conversationId,joinedAt,before,limit}) {
      if(before&&before.createdAt<=joinedAt)return [];
      let query=database.ref('messagingV1/'+roomId+'/messages/'+conversationId).orderByChild('createdAt').startAt(joinedAt+1);
      if(before)query=query.endBefore(before.createdAt,before.id);
      const snapshot=await query.limitToLast(limit).get();
      const records=[];
      snapshot.forEach(child=>{records.push({...child.val(),id:child.key});return false;});
      return records;
    }
  });
}
