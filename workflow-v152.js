// Ver.152 shared UX sidecar: reliable reminders, inbox, archives, and duplicate metadata.
(function installWorkflowV152(){
  const Base=window.WorkBoardWorkflowV150||window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;
  if(!Base)return;
  const ROOM_ID=Base.ROOM_ID, cacheKey=`work-board-workflow-v152:${ROOM_ID}`;
  let data={inbox:{},archives:{},duplicates:{}},remote=null,remoteState='loading',initPromise=null;
  const safeJson=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};
  const sanitize=v=>String(v||'default').replace(/[.#$/\[\]]/g,'-').slice(0,100);
  const userKey=name=>Base.userKey?Base.userKey(name):sanitize(name||Base.currentUser?.()||'default');
  function normalize(raw){
    const s=raw&&typeof raw==='object'?raw:{};
    const inbox={};
    for(const [u,map] of Object.entries(s.inbox||{})){
      const next={};
      for(const [id,item] of Object.entries(map&&typeof map==='object'?map:{})){
        if(!item||typeof item!=='object')continue;
        const taskId=String(item.taskId||'');if(!taskId)continue;
        next[String(id)]={taskId,type:String(item.type||'update'),title:String(item.title||'更新があります').slice(0,120),body:String(item.body||'').slice(0,300),actor:String(item.actor||''),createdAt:Number(item.createdAt||0),readAt:Number(item.readAt||0)};
      }
      if(Object.keys(next).length)inbox[String(u)]=next;
    }
    const archives={};
    for(const [id,item] of Object.entries(s.archives||{}))if(item&&typeof item==='object')archives[String(id)]={archivedAt:Number(item.archivedAt||0),archivedBy:String(item.archivedBy||''),reason:String(item.reason||'manual')};
    const duplicates={};
    for(const [id,item] of Object.entries(s.duplicates||{}))if(item&&typeof item==='object'&&item.targetId)duplicates[String(id)]={targetId:String(item.targetId),mergedAt:Number(item.mergedAt||0),mergedBy:String(item.mergedBy||'')};
    return{inbox,archives,duplicates};
  }
  function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(data))}catch(_){}}
  function load(){data=normalize(safeJson(localStorage.getItem(cacheKey)||'{}',{}))}
  function emit(){persist();window.dispatchEvent(new CustomEvent('workflow-v152-update'))}
  function currentUser(){return Base.currentUser?.()||'default'}
  function users(){try{const list=JSON.parse(localStorage.getItem(`system-task-users:${ROOM_ID}`)||'[]');return Array.isArray(list)&&list.length?list.map(x=>String(x).trim()).filter(Boolean):[currentUser()]}catch(_){return[currentUser()]}}
  async function initRemote(){
    const r=await Base.ensureRemote?.();
    if(!r){remoteState=Base.dependencyState?.()==='local-only'?'local-only':'error';emit();return null}
    remote=r;const root=r.ref(r.db,`rooms/${ROOM_ID}/workflowV152`);
    r.onValue(root,s=>{data=normalize(s.val()||{});remoteState='ready';emit()},e=>{console.warn('Ver.152 sidecar subscription failed',e);remoteState='error';emit()});
    return r;
  }
  async function ensureRemote(){if(!initPromise)initPromise=initRemote();await initPromise;return remote}
  function emitBase(){try{localStorage.setItem(Base.cacheKey,JSON.stringify(Base.workflow))}catch(_){}['workflow-v148-update','workflow-v149-update','workflow-v150-update','workflow-v152-update'].forEach(name=>window.dispatchEvent(new CustomEvent(name)))}
  // The v152 sidecar is the only reminder cache/event owner. The shared
  // repository performs its existing expected-base child transaction.
  const normalizeReminderValue=window.WorkBoardReminderPersistenceV541.normalizeReminderValue;
  function applyReminderLocal(user,id,value){
    const next=normalizeReminderValue(value);
    Base.workflow.reminders||={};Base.workflow.reminders[user]||={};
    if(next)Base.workflow.reminders[user][id]=next;else delete Base.workflow.reminders[user][id];
    if(!Object.keys(Base.workflow.reminders[user]).length)delete Base.workflow.reminders[user];
    emitBase();
  }
  const reminderPersistence=window.WorkBoardReminderPersistenceV541.create({
    roomId:ROOM_ID,
    getReminders:()=>Base.workflow.reminders,
    ensureRemote:()=>Base.ensureRemote?.(),
    getDependencyState:()=>Base.dependencyState?.(),
    applyLocal:applyReminderLocal,
    notify:(...args)=>Base.notify(...args),
    log:(...args)=>console.warn(...args)
  });
  async function writeReminder(taskId,item,user=currentUser(),expectedReminder){
    return reminderPersistence.write(taskId, item, userKey(user), expectedReminder, arguments.length >= 4);
  }
  Base.writeReminder=writeReminder;
  function inboxFor(user=currentUser()){return{...(data.inbox?.[userKey(user)]||{})}}
  function unreadCount(user=currentUser()){return Object.values(inboxFor(user)).filter(x=>!x.readAt).length}
  async function writeInboxEvent(recipient,eventId,event){
    const u=userKey(recipient),id=sanitize(eventId),item={taskId:String(event.taskId||''),type:String(event.type||'update'),title:String(event.title||'更新があります').slice(0,120),body:String(event.body||'').slice(0,300),actor:String(event.actor||''),createdAt:Number(event.createdAt||Date.now()),readAt:0};if(!item.taskId)return{ok:false};
    data.inbox[u]||={};if(!data.inbox[u][id])data.inbox[u][id]=item;emit();
    const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only',localOnly:remoteState==='local-only'};
    try{const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/inbox/${u}/${id}`);await r.runTransaction(target,current=>current||item,{applyLocally:false});return{ok:true}}catch(e){console.warn('Ver.152 inbox write failed',e);return{ok:false}}
  }
  // The v152 sidecar stays the sole inbox cache, subscription and bulk reader.
  // The shared read writer handles the existing expected-readAt child transaction.
  const normalizeReadAt=window.WorkBoardInboxReadV542.normalizeReadAt;
  function applyInboxReadLocal(user,id,value){
    const item=data.inbox?.[user]?.[id];if(!item)return false;
    item.readAt=normalizeReadAt(value);emit();return true;
  }
  const inboxReadPersistence=window.WorkBoardInboxReadV542.create({
    roomId:ROOM_ID,
    getInbox:()=>data.inbox,
    ensureRemote,
    getRemoteState:()=>remoteState,
    applyLocal:applyInboxReadLocal,
    notify:(...args)=>Base.notify(...args),
    log:(...args)=>console.warn(...args)
  });
  async function markInboxRead(eventId,read=true,user=currentUser(),expectedReadAt){
    return inboxReadPersistence.write(eventId,read,userKey(user),expectedReadAt,arguments.length>=4);
  }
  async function markAllInboxRead(user=currentUser()){
    const u=userKey(user),map=data.inbox?.[u]||{},targets=Object.entries(map).filter(([,item])=>item&&typeof item==='object'&&!normalizeReadAt(item.readAt)).map(([id,item])=>({id,expectedReadAt:normalizeReadAt(item.readAt)}));
    if(!targets.length)return{ok:true,count:0,conflicts:0};
    const results=await Promise.all(targets.map(target=>markInboxRead(target.id,true,user,target.expectedReadAt)));
    const conflicts=results.filter(result=>result?.conflict).length;
    return{ok:results.every(result=>result?.ok),count:targets.length,conflicts};
  }
  // The workflow sidecar still exclusively owns subscriptions, optimistic
  // local cache, and update events. Shared archive persistence owns just the
  // revision-checked write and restore policy.
  function applyArchiveLocal(id,value){
    const next=window.WorkBoardArchivePersistenceV540.normalize(value);
    if(next)data.archives[id]=next;else delete data.archives[id];
    emit();
  }
  function isArchived(taskId){return Boolean(data.archives?.[String(taskId)])}
  function archiveInfo(taskId){return data.archives?.[String(taskId)]||null}
  const archivePersistence=window.WorkBoardArchivePersistenceV540.create({
    roomId:ROOM_ID,
    getArchives:()=>data.archives,
    ensureRemote,
    getRemoteState:()=>remoteState,
    currentUser,
    applyLocal:applyArchiveLocal,
    notify:(message,error)=>Base.notify(message,error),
    log:(...args)=>console.warn(...args)
  });
  async function archiveTask(taskId,reason='manual',expectedArchive){
    return archivePersistence.archive(taskId, reason, expectedArchive, arguments.length >= 3);
  }
  async function unarchiveTask(taskId,expectedArchive){
    return archivePersistence.restore(taskId, expectedArchive, arguments.length >= 2);
  }
  function normalizeDuplicateValue(value){
    if(!value||typeof value!=='object'||!value.targetId)return null;
    return{targetId:String(value.targetId),mergedAt:Number(value.mergedAt||0),mergedBy:String(value.mergedBy||'')};
  }
  function sameDuplicateValue(left,right){
    const a=normalizeDuplicateValue(left),b=normalizeDuplicateValue(right);
    if(!a||!b)return !a&&!b;
    return a.targetId===b.targetId&&a.mergedAt===b.mergedAt&&a.mergedBy===b.mergedBy;
  }
  function applyDuplicateLocal(id,value){const next=normalizeDuplicateValue(value);if(next)data.duplicates[id]=next;else delete data.duplicates[id];emit()}
  function duplicateOf(taskId){return data.duplicates?.[String(taskId)]?.targetId||''}
  function duplicateInfo(taskId){return data.duplicates?.[String(taskId)]||null}
  async function markDuplicate(sourceId,targetId,expectedDuplicate){
    const id=String(sourceId),previous=normalizeDuplicateValue(data.duplicates?.[id]||null),expected=arguments.length>=3?normalizeDuplicateValue(expectedDuplicate):previous,item={targetId:String(targetId),mergedAt:Date.now(),mergedBy:currentUser()};
    applyDuplicateLocal(id,item);const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only',localOnly:remoteState==='local-only'};
    try{
      const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/duplicates/${id}`);let conflict=false;
      const tx=await r.runTransaction(target,current=>{if(!sameDuplicateValue(current,expected)){conflict=true;return}return item},{applyLocally:false});
      if(!tx.committed){const latest=normalizeDuplicateValue(tx.snapshot?.val?.());applyDuplicateLocal(id,latest);if(conflict){Base.notify('別の端末で重複統合情報が更新されています。最新の内容を反映しました。',true);return{ok:false,conflict:true}}throw new Error('duplicate-transaction-aborted')}
      applyDuplicateLocal(id,tx.snapshot?.val?.());return{ok:true};
    }catch(e){console.warn('Ver.152 duplicate metadata write failed',e);applyDuplicateLocal(id,previous);return{ok:false,error:String(e?.message||e)}}
  }
  load();
  const api=Object.assign({},Base,{ensureV152Remote:ensureRemote,currentUser,users,writeReminder,inboxFor,unreadCount,writeInboxEvent,markInboxRead,markAllInboxRead,isArchived,archiveInfo,archiveTask,unarchiveTask,duplicateOf,duplicateInfo,markDuplicate});
  Object.defineProperties(api,{v152:{enumerable:true,get:()=>data},v152State:{enumerable:true,get:()=>remoteState}});
  window.WorkBoardWorkflowV152=api;document.documentElement.dataset.workflowVersion='152';initPromise=initRemote();
})();