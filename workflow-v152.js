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
  async function writeReminder(taskId,item,user=currentUser()){
    const u=userKey(user),id=String(taskId),next=item&&Number(item.at)>0?{at:Number(item.at),note:String(item.note||'').slice(0,240),updatedAt:Date.now()}:null;
    Base.workflow.reminders||={};const previous=Base.workflow.reminders?.[u]?.[id]||null;
    Base.workflow.reminders[u]||={};if(next)Base.workflow.reminders[u][id]=next;else delete Base.workflow.reminders[u][id];if(!Object.keys(Base.workflow.reminders[u]).length)delete Base.workflow.reminders[u];emitBase();
    const r=await Base.ensureRemote?.();if(!r){if(Base.dependencyState?.()==='local-only')return{ok:true,localOnly:true};restoreReminder();Base.notify('リマインダーを保存できませんでした。',true);return{ok:false}}
    function restoreReminder(){Base.workflow.reminders[u]||={};if(previous)Base.workflow.reminders[u][id]=previous;else delete Base.workflow.reminders[u][id];if(!Object.keys(Base.workflow.reminders[u]).length)delete Base.workflow.reminders[u];emitBase()}
    try{
      const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV148/reminders/${u}/${id}`);
      if(next)await r.set(target,next);else await r.remove(target);
      const check=await r.get(target),value=check.val();
      if(next){if(!check.exists()||Number(value?.at||0)!==next.at)throw new Error('reminder-not-persisted')}
      else if(check.exists())throw new Error('reminder-delete-not-persisted');
      return{ok:true};
    }catch(e){console.warn('Ver.152 reminder write failed',e);restoreReminder();Base.notify(next?'リマインダーを保存できませんでした。':'確認済みにできませんでした。通信状態を確認して再試行してください。',true);return{ok:false,error:String(e?.message||e)}}
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
  async function markInboxRead(eventId,read=true,user=currentUser()){
    const u=userKey(user),id=String(eventId),item=data.inbox?.[u]?.[id];if(!item)return{ok:false};const before=item.readAt||0;item.readAt=read?Date.now():0;emit();
    const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only'};
    try{await r.set(r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/inbox/${u}/${id}/readAt`),item.readAt);return{ok:true}}catch(e){item.readAt=before;emit();return{ok:false}}
  }
  async function markAllInboxRead(user=currentUser()){
    const u=userKey(user),now=Date.now(),map=data.inbox?.[u]||{};Object.values(map).forEach(item=>{if(!item.readAt)item.readAt=now});emit();const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only'};
    try{const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/inbox/${u}`);await r.runTransaction(target,current=>{const next=current&&typeof current==='object'?current:{};Object.values(next).forEach(item=>{if(item&&typeof item==='object'&&!item.readAt)item.readAt=now});return next},{applyLocally:false});return{ok:true}}catch(e){return{ok:false}}
  }
  function isArchived(taskId){return Boolean(data.archives?.[String(taskId)])}
  function archiveInfo(taskId){return data.archives?.[String(taskId)]||null}
  async function archiveTask(taskId,reason='manual'){
    const id=String(taskId),item={archivedAt:Date.now(),archivedBy:currentUser(),reason:String(reason||'manual')};data.archives[id]=item;emit();const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only'};
    try{await r.set(r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/archives/${id}`),item);return{ok:true}}catch(e){delete data.archives[id];emit();Base.notify('アーカイブを保存できませんでした。',true);return{ok:false}}
  }
  async function unarchiveTask(taskId){
    const id=String(taskId),before=data.archives[id];delete data.archives[id];emit();const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only'};
    try{await r.remove(r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/archives/${id}`));return{ok:true}}catch(e){if(before)data.archives[id]=before;emit();return{ok:false}}
  }
  function duplicateOf(taskId){return data.duplicates?.[String(taskId)]?.targetId||''}
  function duplicateInfo(taskId){return data.duplicates?.[String(taskId)]||null}
  async function markDuplicate(sourceId,targetId){
    const id=String(sourceId),item={targetId:String(targetId),mergedAt:Date.now(),mergedBy:currentUser()};data.duplicates[id]=item;emit();const r=await ensureRemote();if(!r)return{ok:remoteState==='local-only'};
    try{await r.set(r.ref(r.db,`rooms/${ROOM_ID}/workflowV152/duplicates/${id}`),item);return{ok:true}}catch(e){delete data.duplicates[id];emit();return{ok:false}}
  }
  load();
  const api=Object.assign({},Base,{ensureV152Remote:ensureRemote,currentUser,users,writeReminder,inboxFor,unreadCount,writeInboxEvent,markInboxRead,markAllInboxRead,isArchived,archiveInfo,archiveTask,unarchiveTask,duplicateOf,duplicateInfo,markDuplicate});
  Object.defineProperties(api,{v152:{enumerable:true,get:()=>data},v152State:{enumerable:true,get:()=>remoteState}});
  window.WorkBoardWorkflowV152=api;document.documentElement.dataset.workflowVersion='152';initPromise=initRemote();
})();