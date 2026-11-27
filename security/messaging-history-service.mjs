// Trusted server-side history boundary. Never import this into the browser.
import {isMessagingRoomId,isPersonId,compareCursor,isConversationId,isMessageId,isMessagingTimestamp,projectMessagingMessage} from '../workspace-messaging-core.js';

const requestFields=new Set(['token','roomId','conversationId','before','limit','expectedPersonId','until']);
// One bounded range read replaces sequential paging when jumping to a known message.
export const HISTORY_RANGE_MAX=300;
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uidKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);
const cursor=value=>isRecord(value)&&Object.keys(value).length===2&&isMessageId(value.id)&&isMessagingTimestamp(value.createdAt);
const status=value=>({status:value});

export function createMessagingHistoryService({verifyToken,readBinding,readMember,readPage,readRange=null}={}) {
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
    if(!isRecord(member)||member.active!==true||!isMessagingTimestamp(member.joinedAt)||member.joinedAt>=Number.MAX_SAFE_INTEGER)return null;
    return {uid,personId,joinedAt:member.joinedAt};
  }
  async function readHistory(request) {
    if(!isRecord(request)||Object.keys(request).some(field=>!requestFields.has(field)))return status('invalid');
    const {token,roomId,conversationId,before=null,limit=50,expectedPersonId,until=null}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)
        ||expectedPersonId!==undefined&&!isPersonId(expectedPersonId)||!Number.isInteger(limit)||limit<1||limit>50||(before!==null&&!cursor(before))
        ||until!==null&&(!isMessageId(until)||typeof readRange!=='function'))return status('invalid');
    try {
      const access=await authorize({token,roomId,conversationId});
      if(!access||expectedPersonId!==undefined&&access.personId!==expectedPersonId)return status('forbidden');
      // The server, not the caller, supplies the join boundary and the query cap.
      let records,rangeMore=null;
      if(until!==null){
        // The target must be a visible (post-join, not deleted) message of this
        // conversation; anything else is reported as missing, never as success.
        const range=await readRange({roomId,conversationId,joinedAt:access.joinedAt,until,before,max:HISTORY_RANGE_MAX});
        if(range?.status==='missing'||range?.status==='too-far')return status(range.status);
        if(range?.status!=='ok'||!Array.isArray(range.records)||range.records.length<1||range.records.length>HISTORY_RANGE_MAX||typeof range.hasMore!=='boolean'||range.records[0]?.id!==until)return status('unavailable');
        records=range.records;rangeMore=range.hasMore;
      }else records=await readPage({roomId,conversationId,joinedAt:access.joinedAt,before,limit});
      if(!Array.isArray(records)||until===null&&records.length>limit)return status('unavailable');
      const messages=[];const ids=new Set();
      for(const raw of records){
        const item=projectMessagingMessage(raw,{roomId,joinedAt:access.joinedAt});
        if(before&&compareCursor(item,before)>=0)return status('unavailable');
        if(ids.has(item.id)||messages.length&&compareCursor(messages.at(-1),item)>=0)return status('unavailable');
        ids.add(item.id);messages.push(item);
      }
      // Do not return records if access was revoked/reassigned while reading.
      // The final check is not a transactional guarantee against all races;
      // real deployments must additionally validate the revocation boundary.
      const latest=await authorize({token,roomId,conversationId});
      if(!latest||latest.uid!==access.uid||latest.personId!==access.personId||latest.joinedAt!==access.joinedAt)return status('forbidden');
      const hasMore=rangeMore??messages.length===limit;
      const nextCursor=hasMore?{createdAt:messages[0].createdAt,id:messages[0].id}:null;
      return {status:'ok',joinedAt:access.joinedAt,messages,nextCursor,hasMore};
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
    // Reads [target, before) in one capped query plus a one-row probe for older history.
    async readRange({roomId,conversationId,joinedAt,until,before,max}) {
      const base='messagingV1/'+roomId+'/messages/'+conversationId;
      const target=await read(base+'/'+until);
      if(!isRecord(target)||!isMessagingTimestamp(target.createdAt)||target.createdAt<=joinedAt||target.deletedAt!==undefined&&target.deletedAt!==null)return {status:'missing'};
      if(before&&compareCursor({createdAt:target.createdAt,id:until},before)>=0)return {status:'missing'};
      let query=database.ref(base).orderByChild('createdAt').startAt(target.createdAt,until);
      if(before)query=query.endBefore(before.createdAt,before.id);
      const snapshot=await query.limitToFirst(max+1).get();
      const records=[];
      snapshot.forEach(child=>{records.push({...child.val(),id:child.key});return false;});
      if(records.length>max)return {status:'too-far'};
      const older=await database.ref(base).orderByChild('createdAt').startAt(joinedAt+1).endBefore(target.createdAt,until).limitToLast(1).get();
      return {status:'ok',records,hasMore:older.exists()};
    },
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
