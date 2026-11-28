// Trusted server-side boundary for links from a business record to the message
// it was created from. Never import this into the browser.
//
// The browser cannot choose which record a link points at. For one authorized
// source message, the server issues fresh, unguessable record ids and writes
// their links in the same request; the browser then creates the records with
// those ids through the unchanged business save path. A link therefore exists
// from the moment its record is created, and only for ids issued for that
// message, never for an existing record. An id whose record is never created
// keeps an unreachable link (no record shows it, links cannot be listed).
// The per-person reservation index makes a retried request return the same ids,
// so an unknown save result never creates duplicate records.
// Business data under rooms/{room} has no authentication: this proves the link
// targets a record newly created for that message, not who owns or edits it.
import {readApprovedMessagingActor} from './messaging-authorization.mjs';
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId} from '../workspace-messaging-core.js';

export const RECORD_ORIGIN_TTL_MS=7*86400000;
export const RECORD_ORIGIN_OPEN_MAX=50;
export const RECORD_ORIGIN_BATCH_MAX=200;
// Push-key shape (8 time characters + 12 random characters), so issued ids look
// and sort like the ids the board already generates.
export const isIssuedRecordId=value=>typeof value==='string'&&/^-[0-9A-Za-z_-]{19}$/.test(value);
const PUSH_CHARS='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
const isRequestId=value=>typeof value==='string'&&/^q_[0-9a-f]{32}$/.test(value);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const collections=Object.freeze({task:'tasks',schedule:'schedules'});
const fail=status=>({status});
const requestFields=['token','expectedPersonId','roomId','conversationId','messageId','requestId','recordType','count'];
const idsOf=value=>Array.isArray(value)?value:isRecord(value)?Object.keys(value).sort((a,b)=>Number(a)-Number(b)).map(key=>value[key]):[];
function decodeEntry(raw){
  if(!isRecord(raw))return null;
  const ids=idsOf(raw.ids);
  if(!isConversationId(raw.conversationId)||!isMessageId(raw.messageId)||!Object.hasOwn(collections,raw.recordType)
    ||!isMessagingTimestamp(raw.createdAt)||!isMessagingTimestamp(raw.expiresAt)
    ||ids.length<1||ids.length>RECORD_ORIGIN_BATCH_MAX||!ids.every(isIssuedRecordId)||new Set(ids).size!==ids.length)return null;
  return {conversationId:raw.conversationId,messageId:raw.messageId,recordType:raw.recordType,createdAt:raw.createdAt,expiresAt:raw.expiresAt,ids};
}
// 8 characters of time plus 72 random bits from a CSPRNG for every id (never an
// increment of a previous id), so an issued id cannot be predicted by others.
export function issueRecordId(now,random=bytes=>crypto.getRandomValues(new Uint8Array(bytes))){
  let time=now,prefix='';
  for(let i=0;i<8;i++){prefix=PUSH_CHARS.charAt(time%64)+prefix;time=Math.floor(time/64);}
  const bytes=random(12);let suffix='';
  for(let i=0;i<12;i++)suffix+=PUSH_CHARS.charAt(bytes[i]%64);
  return prefix+suffix;
}

/**
 * @param {{auth:any, database:any, serverTimestamp:unknown, clock?:()=>number, random?:(bytes:number)=>Uint8Array}} options
 */
export function createFirebaseMessagingRecordOriginService({auth,database,serverTimestamp,clock=Date.now,random=undefined}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function'||serverTimestamp===undefined||typeof clock!=='function')throw new TypeError('Firebase Admin adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  const base=roomId=>'messagingV1/'+roomId;
  async function actorFor(request){
    const actor=await readApprovedMessagingActor({token:request.token,roomId:request.roomId,verifyToken:t=>auth.verifyIdToken(t,true),
      readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid)});
    return actor&&(request.expectedPersonId===undefined||actor.personId===request.expectedPersonId)?actor:null;
  }
  // The source must be a visible message of a conversation the person belongs to now.
  async function sourceVisible(roomId,personId,conversationId,messageId){
    const control=await read(base(roomId)+'/control/'+conversationId);
    const member=control?.members?.[personId];
    if(control?.status!=='active'||member?.active!==true||!isMessagingTimestamp(member.joinedAt))return false;
    const message=await read(base(roomId)+'/messages/'+conversationId+'/'+messageId);
    return isRecord(message)&&isMessagingTimestamp(message.createdAt)&&message.createdAt>member.joinedAt&&(message.deletedAt===undefined||message.deletedAt===null);
  }
  const live=(rows,now)=>Object.entries(isRecord(rows)?rows:{}).filter(([key,row])=>{const entry=isRequestId(key)?decodeEntry(row):null;return entry&&entry.expiresAt>now;});
  async function reserve(request){
    if(!isRecord(request)||Object.keys(request).some(key=>!requestFields.includes(key))
      ||typeof request.token!=='string'||request.token.length<1||request.token.length>16384||!isMessagingRoomId(request.roomId)
      ||request.expectedPersonId!==undefined&&!isPersonId(request.expectedPersonId)
      ||!isConversationId(request.conversationId)||!isMessageId(request.messageId)||!isRequestId(request.requestId)
      ||!Object.hasOwn(collections,request.recordType)||!Number.isInteger(request.count)||request.count<1
      ||request.count>(request.recordType==='task'?1:RECORD_ORIGIN_BATCH_MAX))return fail('invalid');
    try{
      const actor=await actorFor(request);if(!actor)return fail('forbidden');
      const {roomId,conversationId,messageId,requestId,recordType,count}=request;
      if(!await sourceVisible(roomId,actor.personId,conversationId,messageId))return fail('forbidden');
      const indexPath=base(roomId)+'/recordOrigins/'+actor.personId,now=clock();
      const same=entry=>entry.conversationId===conversationId&&entry.messageId===messageId&&entry.recordType===recordType&&entry.ids.length===count;
      const answer=entry=>({status:'ok',requestId,recordType,ids:entry.ids});
      // A retried request returns its first ids; their links were written before
      // the index entry was committed.
      const rows=await read(indexPath),known=decodeEntry(isRecord(rows)?rows[requestId]:null);
      if(known&&known.expiresAt>now)return same(known)?answer(known):fail('conflict');
      if(live(rows,now).length>=RECORD_ORIGIN_OPEN_MAX)return fail('full');
      const ids=Array.from({length:count},()=>issueRecordId(now,random));
      if(!ids.every(isIssuedRecordId)||new Set(ids).size!==count)return fail('unavailable');
      // Links first (fixed values for brand-new ids), then the index entry in a
      // transaction: an entry is never visible without its links.
      const links={};
      for(const id of ids)links[base(roomId)+'/recordLinks/'+recordType+'/'+id]={conversationId,messageId,createdBy:actor.personId,createdAt:serverTimestamp};
      await database.ref().update(links);
      let outcome=null;
      const committed=await database.ref(indexPath).transaction(current=>{
        const next=Object.fromEntries(live(current,now));
        const existing=decodeEntry(next[requestId]);
        if(existing){outcome=same(existing)?answer(existing):fail('conflict');return next;}
        if(Object.keys(next).length>=RECORD_ORIGIN_OPEN_MAX){outcome=fail('full');return next;}
        next[requestId]={conversationId,messageId,recordType,createdAt:now,expiresAt:now+RECORD_ORIGIN_TTL_MS,ids};
        outcome=answer({ids});return next;
      });
      if(!committed.committed||!outcome)return fail('unavailable');
      // Access revoked while reserving: the ids are useless to the caller.
      if(!await actorFor(request))return fail('forbidden');
      return outcome;
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({reserve});
}
