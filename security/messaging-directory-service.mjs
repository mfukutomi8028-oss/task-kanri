// Trusted server-side discovery. An index is a candidate list, never a grant.
// No message bodies, entire room collections, or credentials enter this API.
import {isConversationId,isMessagingRoomId,isPersonId} from '../workspace-messaging-core.js';
import {isValidConversationControl} from './messaging-conversation-commands.mjs';
import {readUnreadForMember} from './messaging-unread-summary.mjs';
const fail=status=>({status});
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const uidKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const maxPage=100,maxParticipants=1000;
const preferenceKeys=['favorite','muted','pinned','archived'];
const validIndexRow=row=>record(row)&&isConversationId(row.id)&&Number.isSafeInteger(row.revision)&&row.revision>=1&&['member','pending','inactive'].includes(row.state);
const requestFields=new Set(['token','roomId','after','limit','expectedPersonId']);
const unreadFields=new Set(['token','roomId','conversationId','expectedPersonId']);
async function batches(items,fn){const result=[];for(let i=0;i<items.length;i+=8)result.push(...await Promise.all(items.slice(i,i+8).map(fn)));return result;}
function project(control,personId){
  const member=control.members[personId],invite=control.invites?.[personId];
  if(member?.active===true){
    const row={id:control.id,kind:control.kind,status:control.status,role:member.role,memberCount:Object.values(control.members).filter(m=>m.active).length,joinedAt:member.joinedAt,revision:control.revision,controlUpdatedAt:control.updatedAt};
    if(control.kind==='group')row.title=control.title;
    if(control.kind==='direct')row.peerId=Object.keys(control.members).find(id=>id!==personId);
    return {state:'member',row};
  }
  if(control.kind==='group'&&control.status==='active'&&invite?.state==='pending')return {state:'pending',row:{conversationId:control.id,title:control.title,invitedBy:invite.invitedBy,invitedAt:invite.invitedAt,revision:control.revision}};
  return {state:'inactive'};
}

// Only the trusted control-change/recovery worker calls reconcile. It is not a
// client route. Revisioned tombstones prevent delayed work from reviving rows.
export function createMessagingIndexReconciler({readControl,writeIndexRow,readControlPage}={}){
  if(typeof readControl!=='function'||typeof writeIndexRow!=='function')throw new TypeError('Trusted index adapters required');
  async function reconcile({roomId,conversationId}={}){
    if(!isMessagingRoomId(roomId)||!isConversationId(conversationId))return fail('invalid');
    try{
      const control=await readControl({roomId,conversationId});
      if(!isValidConversationControl(control,conversationId,roomId))return fail('unavailable');
      const people=[...new Set([...Object.keys(control.members),...Object.keys(control.invites??{})])];
      if(people.length>maxParticipants)return fail('limit');
      await batches(people,personId=>writeIndexRow({roomId,personId,conversationId},{revision:control.revision,state:project(control,personId).state}));
      return {status:'ok',revision:control.revision,rows:people.length};
    }catch(_){return fail('unavailable');}
  }
  // Privileged maintenance only: bounded canonical control pages, no history.
  // Failed IDs must remain queued for retry by the eventual recovery worker.
  async function reconcilePage({roomId,after=null,limit=50}={}){
    if(!isMessagingRoomId(roomId)||after!==null&&!isConversationId(after)||!Number.isInteger(limit)||limit<1||limit>50)return fail('invalid');
    if(typeof readControlPage!=='function')return fail('unavailable');
    try{
      const ids=await readControlPage({roomId,after,limit:limit+1});
      if(!Array.isArray(ids)||ids.length>limit+1||ids.some((id,i)=>!isConversationId(id)||(i>0?ids[i-1]:after)!==null&&id<=(i>0?ids[i-1]:after)))return fail('unavailable');
      const page=ids.slice(0,limit),failed=[];
      // Reconcile one conversation at a time: each repair already batches writes.
      for(const conversationId of page){if((await reconcile({roomId,conversationId})).status!=='ok')failed.push(conversationId);}
      return {status:failed.length?'partial':'ok',processed:page.length,failed,hasMore:ids.length>limit,nextCursor:ids.length>limit?page.at(-1):null};
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({reconcile,reconcilePage});
}

export function createMessagingDirectoryService({verifyToken,readBinding,readControl,readIndexPage,readPreferences,readPersonal,readUnreadPage}={}){
  if([verifyToken,readBinding,readControl,readIndexPage].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted directory adapters required');
  async function authorize(token,roomId){
    let identity;try{identity=await verifyToken(token);}catch(_){return null;}
    if(!uidKey(identity?.uid))return null;
    const uid=identity.uid,binding=await readBinding({roomId,uid});
    if(!record(binding)||binding.uid!==uid||binding.roomId!==roomId||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId))return null;
    return {uid,personId:binding.personId};
  }
  async function readDirectory(request){
    if(!record(request)||Object.keys(request).some(key=>!requestFields.has(key)))return fail('invalid');
    const {token,roomId,after=null,limit=maxPage,expectedPersonId}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||expectedPersonId!==undefined&&!isPersonId(expectedPersonId)||after!==null&&!isConversationId(after)||!Number.isInteger(limit)||limit<1||limit>maxPage)return fail('invalid');
    try{
      const access=await authorize(token,roomId);if(!access||expectedPersonId!==undefined&&access.personId!==expectedPersonId)return fail('forbidden');
      const rows=await readIndexPage({roomId,personId:access.personId,after,limit:limit+1});
      if(!Array.isArray(rows)||rows.length>limit+1||rows.some((row,i)=>!validIndexRow(row)||(i>0?rows[i-1].id:after)!==null&&row.id<=(i>0?rows[i-1].id:after)))return fail('unavailable');
      const page=rows.slice(0,limit);
      const projections=await batches(page,async item=>{
        const control=await readControl({roomId,conversationId:item.id});
        if(control===null)return {item,revision:null,state:'inactive'};
        if(!isValidConversationControl(control,item.id,roomId)||control.revision<item.revision)throw Error('Inconsistent control');
        const projection=project(control,access.personId);
        if(projection.state==='member'&&typeof readPreferences==='function'){
          try{
            const prefs=await readPreferences({roomId,personId:access.personId,conversationId:item.id,joinedAt:projection.row.joinedAt});
            projection.row.preferences=prefs===null||record(prefs)&&Object.keys(prefs).every(key=>preferenceKeys.includes(key)&&typeof prefs[key]==='boolean')
              ?Object.fromEntries(preferenceKeys.map(key=>[key,prefs?.[key]===true])):null;
          }catch(_){projection.row.preferences=null;}
        }
        return {item,revision:control.revision,...projection};
      });
      // Recheck the canonical revision before returning. This detects changes
      // during collection, but cannot revoke a response already delivered.
      const unchanged=await batches(projections,async p=>{
        const latest=await readControl({roomId,conversationId:p.item.id});
        return latest===null?p.revision===null:isValidConversationControl(latest,p.item.id,roomId)&&latest.revision===p.revision;
      });
      const final=await authorize(token,roomId);
      if(!final||final.uid!==access.uid||final.personId!==access.personId)return fail('forbidden');
      if(unchanged.some(value=>!value))return fail('stale');
      return {status:'ok',roomId,personId:access.personId,conversations:projections.filter(p=>p.state==='member').map(p=>p.row),invites:projections.filter(p=>p.state==='pending').map(p=>p.row),hasMore:rows.length>limit,nextCursor:rows.length>limit?page.at(-1).id:null};
    }catch(_){return fail('unavailable');}
  }
  // On-demand canonical check, separate from the low-bandwidth directory list.
  async function readUnread(request){
    if(!record(request)||Object.keys(request).some(key=>!unreadFields.has(key)))return fail('invalid');
    const {token,roomId,conversationId,expectedPersonId}=request;
    if(typeof token!=='string'||token.length<1||token.length>16384||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||expectedPersonId!==undefined&&!isPersonId(expectedPersonId))return fail('invalid');
    try{
      const actor=await authorize(token,roomId);if(!actor||expectedPersonId!==undefined&&actor.personId!==expectedPersonId)return fail('forbidden');
      const control=await readControl({roomId,conversationId});
      if(control===null)return fail('forbidden');
      if(!isValidConversationControl(control,conversationId,roomId))return fail('unavailable');
      const member=control.members[actor.personId];if(member?.active!==true)return fail('forbidden');
      const scope={roomId,conversationId,personId:actor.personId,joinedAt:member.joinedAt};
      const summary=await readUnreadForMember({scope,readPersonal,readUnreadPage});
      if(summary.status!=='ok')return summary;
      const latest=await readControl({roomId,conversationId});
      const final=await authorize(token,roomId);
      if(!final||final.uid!==actor.uid||final.personId!==actor.personId||latest===null)return fail('forbidden');
      if(!isValidConversationControl(latest,conversationId,roomId))return fail('unavailable');
      const current=latest.members[actor.personId];
      if(current?.active!==true||current.joinedAt!==scope.joinedAt)return fail('forbidden');
      if(latest.revision!==control.revision)return fail('stale');
      return summary;
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({readDirectory,readUnread});
}

// Keep reconciliation on the server. Index rows are private derived metadata;
// neither clients nor a caller-supplied person ID can choose the discovery scope.
export function createFirebaseMessagingDirectoryServices({auth,database}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function')throw new TypeError('Firebase Admin adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  const root=roomId=>'messagingV1/'+roomId;
  const indexPath=({roomId,personId})=>root(roomId)+'/directoryIndex/'+personId;
  const readControl=({roomId,conversationId})=>read(root(roomId)+'/control/'+conversationId);
  const directory=createMessagingDirectoryService({readControl,verifyToken:token=>auth.verifyIdToken(token,true),readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),
    readPreferences:({roomId,personId,conversationId,joinedAt})=>read(root(roomId)+'/personal/'+personId+'/'+conversationId+'/'+joinedAt+'/preferences'),
    async readPersonal({roomId,personId,conversationId,joinedAt}){
      const path=root(roomId)+'/personal/'+personId+'/'+conversationId+'/'+joinedAt;
      const [cursor,muted]=await Promise.all([read(path+'/readCursor'),read(path+'/preferences/muted')]);
      return {cursor,muted};
    },
    async readUnreadPage({roomId,conversationId,joinedAt,after,limit}){
      let query=database.ref(root(roomId)+'/messages/'+conversationId).orderByChild('createdAt');
      query=after===null?query.startAt(joinedAt+1):query.startAfter(after.createdAt,after.id);
      const snapshot=await query.limitToLast(limit).get(),rows=[];
      snapshot.forEach(child=>{
        const value=child.val();
        if(!record(value)||child.key!==value.id)throw new TypeError('Invalid canonical message');
        rows.push({id:value.id,senderId:value.senderId,createdAt:value.createdAt,deletedAt:value.deletedAt??null});
        return false;
      });return rows;
    },
    async readIndexPage({roomId,personId,after,limit}){
      let q=database.ref(indexPath({roomId,personId})).orderByKey();if(after!==null)q=q.startAfter(after);
      const snapshot=await q.limitToFirst(limit).get(),rows=[];
      snapshot.forEach(child=>{rows.push({...child.val(),id:child.key});return false;});return rows;
    }
  });
  const index=createMessagingIndexReconciler({readControl,async readControlPage({roomId,after,limit}){
    let q=database.ref(root(roomId)+'/control').orderByKey();if(after!==null)q=q.startAfter(after);
    const snapshot=await q.limitToFirst(limit).get(),ids=[];
    snapshot.forEach(child=>{ids.push(child.key);return false;});return ids;
  },async writeIndexRow(scope,next){
    const ref=database.ref(indexPath(scope)+'/'+scope.conversationId);
    // Attach a value observer so the first transaction callback is based on a
    // loaded record rather than a cold SDK null; the server still arbitrates CAS.
    const observer=()=>{};ref.on('value',observer);
    try{
      await ref.once('value');
      let decision;
      const result=await ref.transaction(current=>{
        if(current===null||Number.isSafeInteger(current?.revision)&&current.revision<next.revision){decision='write';return next;}
        if(Number.isSafeInteger(current?.revision)&&(current.revision>next.revision||current.revision===next.revision&&current.state===next.state)){decision='skip';return undefined;}
        decision='invalid';return undefined;
      },undefined,false);
      if(decision==='invalid'||decision==='write'&&!result.committed||decision!=='write'&&decision!=='skip')throw Error('Index transaction unavailable');
    }finally{ref.off('value',observer);}
  }});
  return Object.freeze({directory,index});
}
