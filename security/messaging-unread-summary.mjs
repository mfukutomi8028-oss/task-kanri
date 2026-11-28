// On-demand canonical unread check for one authorized membership. This is not
// the realtime directory index: never call it for every conversation on refresh.
// The trusted caller must recheck current membership and identity before return.
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,compareCursor} from '../workspace-messaging-core.js';
const LIMIT=101,BADGE_CAP=100;
const fail=status=>({status});
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const cursorOf=({id,createdAt})=>({id,createdAt});
function personalState(raw,joinedAt){
  if(!record(raw)||raw.muted!==null&&typeof raw.muted!=='boolean')throw new TypeError('Invalid personal state');
  if(raw.cursor!==null&&(!record(raw.cursor)||!isMessageId(raw.cursor.id)||!isMessagingTimestamp(raw.cursor.createdAt)||raw.cursor.createdAt<=joinedAt))throw new TypeError('Invalid read cursor');
  return {cursor:raw.cursor===null?null:cursorOf(raw.cursor),muted:raw.muted===true};
}
const sameCursor=(a,b)=>a===null?b===null:b!==null&&compareCursor(a,b)===0;
export async function readUnreadForMember({scope,readPersonal,readUnreadPage}={}){
  if(!isMessagingRoomId(scope?.roomId)||!isConversationId(scope?.conversationId)||!isPersonId(scope?.personId)||!isMessagingTimestamp(scope?.joinedAt)||typeof readPersonal!=='function'||typeof readUnreadPage!=='function')return fail('unavailable');
  const {roomId,conversationId,personId,joinedAt}=scope,target={roomId,conversationId,personId,joinedAt};
  try{
    const first=personalState(await readPersonal(target),joinedAt);
    const rows=await readUnreadPage({...target,after:first.cursor,limit:LIMIT});
    if(!Array.isArray(rows)||rows.length>LIMIT)throw new TypeError('Invalid unread page');
    let previous=first.cursor,latestIncoming=null,unread=0;
    for(const row of rows){
      if(!record(row)||!isMessageId(row.id)||!isPersonId(row.senderId)||!row.id.startsWith('msg_'+row.senderId+'_')||!isMessagingTimestamp(row.createdAt)||row.createdAt<=joinedAt||row.deletedAt!=null&&(!isMessagingTimestamp(row.deletedAt)||row.deletedAt<row.createdAt))throw new TypeError('Invalid unread row');
      const cursor=cursorOf(row);
      if(previous!==null&&compareCursor(previous,cursor)>=0)throw new TypeError('Invalid unread ordering');
      previous=cursor;
      if(row.senderId!==personId&&row.deletedAt==null){unread=Math.min(BADGE_CAP,unread+1);latestIncoming=cursor;}
    }
    const final=personalState(await readPersonal(target),joinedAt);
    if(!sameCursor(first.cursor,final.cursor)||first.muted!==final.muted)return fail('stale');
    // The latest bounded page can hide older unread messages behind own sends
    // or deletions. Never label that lower bound an exact count unless saturated.
    return {status:'ok',...target,unread,latestIncoming,muted:first.muted,complete:rows.length<LIMIT||unread===BADGE_CAP};
  }catch(_){return fail('unavailable');}
}
