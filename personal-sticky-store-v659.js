/*
 * Origin's login-free personal sticky storage.
 * The selected board display name is a VIEW FILTER, not an identity proof.
 * This store uses the board's existing /rooms path so different devices can
 * show the same user's notes. Do not put confidential data in this collection.
 */
import {
  newSticky, updateSticky, canDeleteSticky, isStickyNote, isStickyId, isStickyRoomId,
  stickyList, planStickyPlacement, planMobileMove
} from './personal-sticky-core-v659.js';

const COMMAND_FIELDS=Object.freeze({
  'sticky.content':'content','sticky.appearance':'appearance',
  'sticky.layout':'layout','sticky.mobile':'mobile'
});
const COMMANDS=new Set(['sticky.create','sticky.delete','sticky.mobileMove',...Object.keys(COMMAND_FIELDS)]);

export function userKeyFromDisplayName(value) {
  // Reuse the application's normalized 12-character user labels, not Auth UIDs.
  const label=String(value??'').normalize('NFKC').replace(/\s+/g,'').slice(0,12);
  if(!label)return '';
  const bytes=new TextEncoder().encode(label);
  const key='u_'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return isStickyId(key)?key:'';
}

/**
 * Single board-owned store. setContext() follows the already selected user and
 * the board's active connection, rather than opening a separate login flow.
 *
 * Remote: rooms/{roomId}/personalStickyNotes/{displayNameKey}/{noteId}
 * Local-only fallback: browser localStorage, explicitly not multi-device.
 * Remote failures never fall back to another writable local copy.
 */
export function createBoardPersonalStickyStore({roomId,storage=null}={}) {
  if(!isStickyRoomId(roomId))throw new TypeError('Valid board room required');
  const subscribers=new Set();
  let disposed=false,generation=0,unsubscribeDb=null,selectedKey='',selection='',mode='initializing';
  let database=null,api=null,status='locked',storageMode='none',notes=Object.create(null);

  const snapshot=()=>Object.freeze({
    status,ownerUid:selectedKey,ownerRoom:roomId,storageMode,
    notes:Object.freeze(Object.values(notes).filter(isStickyNote).map(note=>structuredClone(note)))
  });
  const notify=()=>{
    const current=snapshot();
    for(const listener of [...subscribers]) {
      try{listener(current)}catch(error){console.error('Sticky subscriber failed',error)}
    }
  };
  const reset=()=>{
    generation++;
    if(unsubscribeDb){unsubscribeDb();unsubscribeDb=null}
    notes=Object.create(null);
    selectedKey='';status='locked';storageMode='none';
    notify();
  };
  const localKey=key=>`system-task-sticky-v659:${roomId}:${key}`;
  const remotePath=(key,id='')=>`rooms/${roomId}/personalStickyNotes/${key}${id?'/'+id:''}`;
  const readLocal=key=>{
    const json=storage.getItem(localKey(key));
    if(!json)return Object.create(null);
    const parsed=JSON.parse(json);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid sticky storage data');
    const safe=Object.create(null);
    for(const [id,note] of Object.entries(parsed)){
      if(!isStickyId(id)||!isStickyNote(note)||note.id!==id||note.ownerUid!==key||note.roomId!==roomId)
        throw new Error('Invalid stored sticky note');
      safe[id]=note;
    }
    return safe;
  };
  function setContext({user='',mode:nextMode='initializing',database:nextDatabase=null,firebase=null}={}) {
    if(disposed)return;
    const key=userKeyFromDisplayName(user);
    const validRemote=nextMode==='remote-online' && nextDatabase
      && firebase && ['ref','onValue','runTransaction'].every(name=>typeof firebase[name]==='function');
    const nextStorageMode=nextMode==='local-only'?'local':validRemote?'shared':'none';
    const nextApi=validRemote?firebase:null;
    if(selectedKey===key&&selection===String(user)&&mode===nextMode
      && database===nextDatabase&&api===nextApi)return;

    reset();
    selection=String(user);mode=nextMode;database=nextDatabase;api=nextApi;
    if(!key){status='locked';notify();return;}
    if(nextStorageMode==='local' && storage){
      try{
        notes=readLocal(key);
        selectedKey=key;storageMode='local';status='ready';notify();
      }catch{
        status='error';notify();
      }
      return;
    }
    if(nextStorageMode==='shared'){
      const activeGeneration=generation;
      selectedKey=key;storageMode='shared';status='loading';notify();
      try{
        unsubscribeDb=api.onValue(api.ref(database,remotePath(key)),snapshotValue=>{
          if(disposed||activeGeneration!==generation)return;
          const incoming=snapshotValue.val()||{},safe=Object.create(null);
          for(const [id,note] of Object.entries(incoming)){
            if(isStickyId(id)&&isStickyNote(note)&&note.id===id
              && note.ownerUid===key&&note.roomId===roomId)safe[id]=note;
          }
          notes=safe;status='ready';notify();
        },()=>{
          if(activeGeneration!==generation)return;
          notes=Object.create(null);status='error';notify();
        });
      }catch{notes=Object.create(null);status='error';notify();}
      return;
    }
    status=nextMode==='remote-degraded'?'error':'loading';
    notify();
  }
  async function dispatch(command={}) {
    if(disposed || status!=='ready'
      || command.ownerUid!==selectedKey || command.ownerRoom!==roomId)
      return {ok:false,error:'unavailable'};
    const kind=String(command.type||'');
    if(!COMMANDS.has(kind))return {ok:false,error:'unsupported-command'};
    if(kind==='sticky.create'&&Object.keys(notes).length>=200)return {ok:false,error:'limit-reached'};
    const placement=kind==='sticky.create'?planStickyPlacement(Object.values(notes)):null;
    const id=kind==='sticky.create'
      ? (globalThis.crypto?.randomUUID?.()
        ?? 'note_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14))
      : String(command.id||'');
    if(!isStickyId(id))return {ok:false,error:'invalid-id'};
    const move=kind==='sticky.mobileMove'?planMobileMove(Object.values(notes),id,command.direction):null;
    if(kind==='sticky.mobileMove'&&!move)return {ok:false,error:'reorder-unavailable'};
    const capturedGeneration=generation,capturedUser=selectedKey,now=Date.now();
    let reason='';
    const apply=current=>{
      if(disposed||generation!==capturedGeneration||status!=='ready'||selectedKey!==capturedUser){
        reason='user-changed';return undefined;
      }
      if(kind==='sticky.create'){
        if(current){reason='already-exists';return undefined;}
        const created=newSticky({id,ownerUid:capturedUser,roomId,now,
          x:Number(command.x??placement.x),y:Number(command.y??placement.y),
          zIndex:placement.zIndex,order:placement.order});
        if(!created.ok){reason=created.error;return undefined;}
        return created.note;
      }
      if(!isStickyNote(current)||current.id!==id||current.ownerUid!==capturedUser
        ||current.roomId!==roomId){reason='record-not-found';return undefined;}
      if(kind==='sticky.delete'){
        if(!canDeleteSticky(current,{ownerUid:capturedUser,roomId,expectedRevisions:command.expectedRevisions})){
          reason='conflict';return undefined;
        }
        return null;
      }
      const updated=updateSticky(current,{
        field:kind==='sticky.mobileMove'?'mobile':COMMAND_FIELDS[kind],
        expectedRevision:move?.expectedRevision??command.expectedRevision,
        values:move?{order:move.order}:command.values,
        ownerUid:capturedUser,roomId,now
      });
      if(!updated.ok){reason=updated.error;return undefined;}
      return updated.note;
    };
    try{
      if(storageMode==='local'){
        const current=notes[id]||null,next=apply(current);
        if(next===undefined)return {ok:false,error:reason||'conflict'};
        const updated={...notes};
        if(next===null)delete updated[id];else updated[id]=next;
        // Persist before telling the UI that a write succeeded.
        storage.setItem(localKey(capturedUser),JSON.stringify(updated));
        if(disposed||generation!==capturedGeneration)return {ok:false,error:'user-changed'};
        notes=updated;notify();
        return {ok:true,id,note:next};
      }
      if(storageMode!=='shared'||!database||!api)return {ok:false,error:'unavailable'};
      const result=await api.runTransaction(api.ref(database,remotePath(capturedUser,id)),apply,{applyLocally:false});
      if(disposed||generation!==capturedGeneration||selectedKey!==capturedUser||status!=='ready')
        return {ok:false,error:'user-changed'};
      return result.committed?{ok:true,id,note:result.snapshot?.val?.()??null}
        :{ok:false,error:reason||'conflict'};
    }catch{return {ok:false,error:'write-failed'}}
  }
  return Object.freeze({
    readSnapshot:snapshot,setContext,dispatch,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('Listener required');
      if(disposed)throw new Error('Sticky store destroyed');
      subscribers.add(listener);listener(snapshot());
      return()=>subscribers.delete(listener);
    },
    list:filters=>stickyList(notes,filters),
    destroy(){
      if(disposed)return;
      disposed=true;reset();subscribers.clear();
    }
  });
}
