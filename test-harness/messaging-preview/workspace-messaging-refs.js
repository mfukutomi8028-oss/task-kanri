// Resolve current business data through the canonical board bridge. The host
// provides current authorization, not a saved title or the selected name alone.
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId,projectMessagingMessage,validateRoomMessageInput,compareCursor} from './workspace-messaging-core.js';
const unavailable=()=>({status:'unavailable'});
const types=new Set(['task','schedule','memo']);
const validContext=c=>c&&isMessagingRoomId(c.roomId)&&isPersonId(c.personId)&&isConversationId(c.conversationId)&&isMessagingTimestamp(c.joinedAt);
const contextKey=c=>JSON.stringify([c.roomId,c.personId,c.conversationId,c.joinedAt]);
const normalizeRef=(ref,context)=>validateRoomMessageInput({body:'reference',refs:[ref]},context.roomId).refs[0];
function project(raw,context){try{return projectMessagingMessage(raw,context);}catch(_){return null;}}
const readableMessages=(messages,context)=>validContext(context)&&Array.isArray(messages)?messages.map(m=>project(m,context)).filter(m=>m&&m.deletedAt==null).sort((a,b)=>compareCursor(b,a)):[];
export function createMessagingReferenceResolver({readSnapshot,readMemos,canRead,readMessage,openRecord,restoreConversation}={}){
  if([readSnapshot,readMemos,canRead,readMessage,openRecord,restoreConversation].some(fn=>typeof fn!=='function'))throw new TypeError('Authorized business bridge required');
  let returnLocation=null;
  async function resolve(ref,context){
    try{
      if(!validContext(context))return unavailable();const normalized=normalizeRef(ref,context);
      if(await canRead({kind:'record',ref:normalized},context)!==true)return unavailable();
      const snapshot=await readSnapshot();if(snapshot?.roomId!==context.roomId)return unavailable();
      const list=normalized.type==='task'?snapshot.tasks:normalized.type==='schedule'?snapshot.schedules:await readMemos();
      const item=Array.isArray(list)?list.find(x=>x?.id===normalized.recordId):null;
      if(!item||typeof item.title!=='string'||!item.title.trim())return unavailable();
      if(await canRead({kind:'record',ref:normalized},context)!==true||(await readSnapshot())?.roomId!==context.roomId)return unavailable();
      const result={status:'available',ref:normalized,title:item.title};
      if(normalized.type==='task'&&typeof item.status==='string')result.currentState=item.status;
      if(normalized.type==='schedule'){if(typeof item.startAt==='string')result.startAt=item.startAt;if(typeof item.endAt==='string')result.endAt=item.endAt;}
      return result;
    }catch(_){return unavailable();}
  }
  async function resolveQuote(messageId,context){
    try{
      if(!validContext(context)||!isMessageId(messageId)||await canRead({kind:'message',messageId},context)!==true)return unavailable();
      const raw=await readMessage({roomId:context.roomId,conversationId:context.conversationId,messageId});const m=project(raw,context);
      if(!m||m.id!==messageId||m.deletedAt!=null||await canRead({kind:'message',messageId},context)!==true)return unavailable();
      return {status:'available',messageId,senderId:m.senderId,excerpt:Array.from(m.body.replace(/\s+/g,' ').trim()).slice(0,160).join('')};
    }catch(_){return unavailable();}
  }
  return Object.freeze({resolve,resolveQuote,
    async shareRecord(ref,context){const result=await resolve(ref,context);return result.status==='available'?result.ref:null;},
    async open(ref,context,location){
      if(!validContext(context)||!location||location.conversationId!==context.conversationId||!isMessageId(location.messageId)||!Number.isFinite(location.scrollTop)||location.scrollTop<0||typeof location.query!=='string')return false;
      const found=await resolve(ref,context);if(found.status!=='available')return false;
      try{
        if(await canRead({kind:'record',ref:found.ref},context)!==true)return false;
        returnLocation={key:contextKey(context),location:{conversationId:location.conversationId,messageId:location.messageId,scrollTop:location.scrollTop,query:location.query}};
        if(await openRecord(found.ref,context)===true)return true;
      }catch(_){}returnLocation=null;return false;
    },
    async restore(context){
      const previous=returnLocation;returnLocation=null;
      if(!previous||!validContext(context)||previous.key!==contextKey(context))return false;
      try{return await restoreConversation(previous.location,context)===true;}catch(_){return false;}
    },clear(){returnLocation=null;}
  });
}
const limitOf=value=>Number.isInteger(value)&&value>0?Math.min(value,50):50;
const within=(m,from,to)=>(from==null||m.createdAt>=from)&&(to==null||m.createdAt<to);
export async function searchLoadedMessages(messages,{query='',context,resolver,from=null,to=null,senderId=null,limit=50}={}){
  const matches=[];const needle=String(query).trim().toLocaleLowerCase();
  for(const m of readableMessages(messages,context)){
    if(!within(m,from,to)||senderId!==null&&m.senderId!==senderId)continue;
    let hit=!needle||m.body.toLocaleLowerCase().includes(needle);
    if(!hit&&resolver)for(const ref of m.refs){const item=await resolver.resolve(ref,context);if(item.status==='available'&&item.title.toLocaleLowerCase().includes(needle)){hit=true;break;}}
    if(hit)matches.push(m);if(matches.length>=limitOf(limit))break;
  }
  return {scope:'loaded',matches};
}
export async function selectSharedData(messages,{context,resolver,type=null,from=null,to=null,limit=50}={}){
  if(!resolver||type!==null&&!types.has(type)&&type!=='url')return [];
  const rows=[],seen=new Set();
  for(const m of readableMessages(messages,context)){
    if(!within(m,from,to))continue;
    if(type===null||types.has(type))for(const ref of m.refs){
      if(type!==null&&ref.type!==type)continue;const key=JSON.stringify([ref.type,ref.recordId]);if(seen.has(key))continue;
      const item=await resolver.resolve(ref,context);if(item.status!=='available')continue;
      seen.add(key);rows.push({...item,type:ref.type,messageId:m.id,createdAt:m.createdAt});if(rows.length>=limitOf(limit))return rows;
    }
    if(type===null||type==='url')for(const token of m.body.match(/https?:\/\/[^\s<>"']+/gi)??[]){
      try{const url=new URL(token);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||seen.has(url.href))continue;seen.add(url.href);rows.push({type:'url',url:url.href,messageId:m.id,createdAt:m.createdAt});if(rows.length>=limitOf(limit))return rows;}catch(_){}
    }
  }
  return rows;
}
