// Trusted server-side history boundary. Never import this into the browser.
import {isMessagingRoomId,isPersonId,compareCursor,isConversationId,isMessageId,isMessagingTimestamp,projectMessagingMessage} from '../workspace-messaging-core.js';

const requestFields=new Set(['token','roomId','conversationId','before','limit','expectedPersonId','around','after']);
// A jump reads only a window around the target (24 older, the target, 25 newer):
// one page, independent of how far the target is from the latest message.
export const HISTORY_WINDOW_OLDER=24,HISTORY_WINDOW_NEWER=25;
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uidKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);
const cursor=value=>isRecord(value)&&Object.keys(value).length===2&&isMessageId(value.id)&&isMessagingTimestamp(value.createdAt);
const status=value=>({status:value});

export function createMessagingHistoryService({verifyToken,readBinding,readMember,readPage,readWindow=null,readAfter=null}={}) {
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
    const {token,roomId,conversationId,before=null,limit=50,expectedPersonId,around=null,after=null}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)
        ||expectedPersonId!==undefined&&!isPersonId(expectedPersonId)||!Number.isInteger(limit)||limit<1||limit>50||(before!==null&&!cursor(before))
        ||around!==null&&(!isMessageId(around)||before!==null||after!==null||typeof readWindow!=='function')
        ||after!==null&&(!cursor(after)||before!==null||typeof readAfter!=='function'))return status('invalid');
    try {
      const access=await authorize({token,roomId,conversationId});
      if(!access||expectedPersonId!==undefined&&access.personId!==expectedPersonId)return status('forbidden');
      // The server, not the caller, supplies the join boundary and the query cap.
      let records,olderMore=null,newerMore=null;
      if(around!==null){
        // The target must be a visible (post-join, not deleted) message of this
        // conversation; anything else is reported as missing, never as success.
        const view=await readWindow({roomId,conversationId,joinedAt:access.joinedAt,around,older:HISTORY_WINDOW_OLDER,newer:HISTORY_WINDOW_NEWER});
        if(view?.status==='missing')return status('missing');
        if(view?.status!=='ok'||!Array.isArray(view.records)||view.records.length<1||view.records.length>HISTORY_WINDOW_OLDER+1+HISTORY_WINDOW_NEWER
          ||typeof view.hasMore!=='boolean'||typeof view.hasNewer!=='boolean'||!view.records.some(item=>item?.id===around))return status('unavailable');
        records=view.records;olderMore=view.hasMore;newerMore=view.hasNewer;
      }else if(after!==null){
        if(after.createdAt<=access.joinedAt)return status('missing');
        const page=await readAfter({roomId,conversationId,joinedAt:access.joinedAt,after,limit});
        if(page?.status!=='ok'||!Array.isArray(page.records)||page.records.length>limit||typeof page.hasNewer!=='boolean')return status('unavailable');
        records=page.records;newerMore=page.hasNewer;
      }else records=await readPage({roomId,conversationId,joinedAt:access.joinedAt,before,limit});
      if(!Array.isArray(records)||around===null&&records.length>limit)return status('unavailable');
      const messages=[];const ids=new Set();
      for(const raw of records){
        const item=projectMessagingMessage(raw,{roomId,joinedAt:access.joinedAt});
        if(before&&compareCursor(item,before)>=0||after&&compareCursor(item,after)<=0)return status('unavailable');
        if(ids.has(item.id)||messages.length&&compareCursor(messages.at(-1),item)>=0)return status('unavailable');
        ids.add(item.id);messages.push(item);
      }
      // Do not return records if access was revoked/reassigned while reading.
      // The final check is not a transactional guarantee against all races;
      // real deployments must additionally validate the revocation boundary.
      const latest=await authorize({token,roomId,conversationId});
      if(!latest||latest.uid!==access.uid||latest.personId!==access.personId||latest.joinedAt!==access.joinedAt)return status('forbidden');
      const cursorOf=item=>({createdAt:item.createdAt,id:item.id});
      if(after!==null)return {status:'ok',joinedAt:access.joinedAt,messages,hasNewer:newerMore,newerCursor:newerMore&&messages.length?cursorOf(messages.at(-1)):null};
      const hasMore=olderMore??messages.length===limit;
      const nextCursor=hasMore?cursorOf(messages[0]):null;
      if(around!==null){
        if(messages.find(item=>item.id===around)?.deletedAt!=null)return status('missing');
        return {status:'ok',joinedAt:access.joinedAt,messages,nextCursor,hasMore,hasNewer:newerMore,newerCursor:newerMore?cursorOf(messages.at(-1)):null};
      }
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
    // Two bounded queries around the target, each with a one-row probe for more.
    async readWindow({roomId,conversationId,joinedAt,around,older,newer}) {
      const base='messagingV1/'+roomId+'/messages/'+conversationId;
      const target=await read(base+'/'+around);
      if(!isRecord(target)||!isMessagingTimestamp(target.createdAt)||target.createdAt<=joinedAt||target.deletedAt!==undefined&&target.deletedAt!==null)return {status:'missing'};
      const rows=snapshot=>{const list=[];snapshot.forEach(child=>{list.push({...child.val(),id:child.key});return false;});return list;};
      const before=rows(await database.ref(base).orderByChild('createdAt').startAt(joinedAt+1).endBefore(target.createdAt,around).limitToLast(older+1).get());
      const later=rows(await database.ref(base).orderByChild('createdAt').startAfter(target.createdAt,around).limitToFirst(newer+1).get());
      return {status:'ok',records:[...before.slice(-older),{...target,id:around},...later.slice(0,newer)],hasMore:before.length>older,hasNewer:later.length>newer};
    },
    async readAfter({roomId,conversationId,after,limit}) {
      const snapshot=await database.ref('messagingV1/'+roomId+'/messages/'+conversationId).orderByChild('createdAt').startAfter(after.createdAt,after.id).limitToFirst(limit+1).get();
      const records=[];snapshot.forEach(child=>{records.push({...child.val(),id:child.key});return false;});
      return {status:'ok',records:records.slice(0,limit),hasNewer:records.length>limit};
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
