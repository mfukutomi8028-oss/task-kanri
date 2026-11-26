// Individual state, isolated by room, person, conversation and membership epoch.
// The Firebase Rules independently check the current approved UID and membership.
import {isPersonId,isMessagingRoomId,isConversationId,isMessageId,isMessagingTimestamp,compareCursor} from './workspace-messaging-core.js';

const fields=['favorite','muted','archived','pinned'];
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const result=status=>({status});
function pathOf({roomId,personId,conversationId,joinedAt}={}){
  if(!isMessagingRoomId(roomId)||!isPersonId(personId)||!isConversationId(conversationId)||!isMessagingTimestamp(joinedAt))throw new TypeError('Invalid personal state scope');
  return ['messagingV1',roomId,'personal',personId,conversationId,String(joinedAt)].join('/');
}
function cursorOf(value,joinedAt){
  if(!record(value)||!isMessageId(value.id)||!isMessagingTimestamp(value.createdAt)||value.createdAt<=joinedAt)throw new TypeError('Invalid read cursor');
  return {id:value.id,createdAt:value.createdAt};
}
function preferencesOf(raw){
  if(raw!==null&&(!record(raw)||Object.keys(raw).some(k=>!fields.includes(k)||typeof raw[k]!=='boolean')))throw new TypeError('Invalid stored preferences');
  return Object.fromEntries(fields.map(k=>[k,raw?.[k]===true]));
}
function errorStatus(error){return /permission.denied/i.test(String(error?.code??error?.message??''))?'forbidden':'unavailable';}

export function createMessagingPersonalStateTransport({db,ref,get,update,set,runTransaction}={}){
  if(!db||[ref,get,update,set,runTransaction].some(fn=>typeof fn!=='function'))throw new TypeError('Firebase database adapters required');
  async function invoke(scope,work){
    let path;try{path=pathOf(scope);}catch(_){return result('invalid');}
    try{return await work(path);}catch(error){return result(errorStatus(error));}
  }
  return Object.freeze({
    readPersonalState(scope){return invoke(scope,async path=>{
      const [prefs,cursor]=await Promise.all([get(ref(db,path+'/preferences')),get(ref(db,path+'/readCursor'))]);
      const value=cursor.val();return {status:'ok',preferences:preferencesOf(prefs.val()),cursor:value===null?null:cursorOf(value,scope.joinedAt)};
    });},
    setPersonalState(scope){return invoke(scope,async path=>{
      const patch=scope.patch;
      if(!record(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!fields.includes(k)||typeof patch[k]!=='boolean'))return result('invalid');
      await update(ref(db,path+'/preferences'),{...patch});return result('ok');
    });},
    markRead(scope){return invoke(scope,async path=>{
      let requested;try{requested=cursorOf(scope.cursor,scope.joinedAt);}catch(_){return result('invalid');}
      const target=ref(db,path+'/readCursor');
      // A transaction prevents a stale device from moving the cursor backwards.
      const tx=await runTransaction(target,current=>{
        if(current!==null&&compareCursor(cursorOf(current,scope.joinedAt),requested)>=0)return current;
        return requested;
      },{applyLocally:false});
      // Even a stale device submits a no-change transaction so the returned
      // cursor has been checked by the server under the current Rules.
      if(!tx.committed)return result('unavailable');
      const raw=tx.snapshot.val();
      const cursor=cursorOf(raw,scope.joinedAt);
      return compareCursor(cursor,requested)<0?result('unavailable'):{status:'ok',cursor};
    });},
    readBookmark(scope){return invoke(scope,async path=>{
      if(!isMessageId(scope.messageId))return result('invalid');
      const value=(await get(ref(db,path+'/bookmarks/'+scope.messageId))).val();
      if(value!==null&&value!==true)return result('unavailable');
      return {status:'ok',bookmarked:value===true};
    });},
    setBookmark(scope){return invoke(scope,async path=>{
      if(!isMessageId(scope.messageId)||typeof scope.bookmarked!=='boolean')return result('invalid');
      await set(ref(db,path+'/bookmarks/'+scope.messageId),scope.bookmarked?true:null);return result('ok');
    });}
  });
}
