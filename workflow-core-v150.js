// Ver.150 shared workflow sidecar. Keeps workflowV148 storage path for backward compatibility.
(function installWorkflowCoreV150(){
  const FIREBASE_VERSION='10.12.5', APP_NAME='work-board-v150-helper';
  function sanitize(v){return String(v||'default').replace(/[.#$/\[\]]/g,'-').slice(0,60)}
  function room(){try{const q=new URLSearchParams(location.search).get('room');if(q)return sanitize(q)}catch(_){}try{return sanitize(localStorage.getItem('systemTaskRoomId')||'default')}catch(_){return'default'}}
  function currentUser(){try{return String(localStorage.getItem('systemTaskUser')||'').normalize('NFKC').trim()||'default'}catch(_){return'default'}}
  function userKey(name=currentUser()){return sanitize(name||'default')}
  const ROOM_ID=room(), cacheKey=`work-board-workflow-v148:${ROOM_ID}`, taskKey=`system-task-tasks:${ROOM_ID}`;
  let workflow={dependencies:{},savedViews:{},relations:{},reminders:{}}, remote=null, remoteState='loading', initPromise=null;
  function safeJson(v,f){try{return JSON.parse(v)}catch(_){return f}}
  function trueMap(value){const out={};for(const [id,flag] of Object.entries(value&&typeof value==='object'?value:{})){if(flag===true&&String(id||''))out[String(id)]=true}return out}
  function normalize(v){
    const s=v&&typeof v==='object'?v:{};
    const dependencies={};
    for(const [taskId,map] of Object.entries(s.dependencies||{})){const next=trueMap(map);if(Object.keys(next).length)dependencies[String(taskId)]=next}
    const savedViews={};
    for(const [id,item] of Object.entries(s.savedViews||{})){
      if(!item||typeof item!=='object')continue;
      const taskLayout=['board','list','timeline'].includes(item.taskLayout)?item.taskLayout:'';
      const cs=item.columnSort&&item.columnSort.key&&['asc','desc'].includes(item.columnSort.direction)?{key:String(item.columnSort.key),direction:item.columnSort.direction}:null;
      savedViews[String(id)]={taskLayout,columnSort:cs,updatedAt:Number(item.updatedAt||0)};
    }
    const relations={};
    for(const [taskId,map] of Object.entries(s.relations||{})){const next=trueMap(map);delete next[String(taskId)];if(Object.keys(next).length)relations[String(taskId)]=next}
    const reminders={};
    for(const [u,map] of Object.entries(s.reminders||{})){
      const user={};
      for(const [taskId,item] of Object.entries(map&&typeof map==='object'?map:{})){
        if(!item||typeof item!=='object')continue;
        const at=Number(item.at||0);if(!Number.isFinite(at)||at<=0)continue;
        user[String(taskId)]={at,note:String(item.note||'').slice(0,240),updatedAt:Number(item.updatedAt||0)};
      }
      if(Object.keys(user).length)reminders[String(u)]=user;
    }
    return{dependencies,savedViews,relations,reminders};
  }
  function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(workflow))}catch(_){}}
  function load(){workflow=normalize(safeJson(localStorage.getItem(cacheKey)||'{}',{}))}
  function tasks(){const v=safeJson(localStorage.getItem(taskKey)||'[]',[]);return Array.isArray(v)?v:[]}
  function taskMap(){return new Map(tasks().map(t=>[String(t?.id||''),t]))}
  function isCompleted(t){return String(t?.status||'')==='完了'}
  function depIds(id){return Object.keys(workflow.dependencies?.[String(id)]||{})}
  function activeBlockers(id,map=taskMap()){return depIds(id).map(x=>map.get(x)).filter(t=>t&&!isCompleted(t))}
  function relationIds(id){return Object.keys(workflow.relations?.[String(id)]||{})}
  function reminderFor(taskId,user=currentUser()){return workflow.reminders?.[userKey(user)]?.[String(taskId)]||null}
  function remindersFor(user=currentUser()){return{...(workflow.reminders?.[userKey(user)]||{})}}
  function emit(){persist();window.dispatchEvent(new CustomEvent('workflow-v148-update'));window.dispatchEvent(new CustomEvent('workflow-v149-update'));window.dispatchEvent(new CustomEvent('workflow-v150-update'))}
  function notify(message,error=false){let n=document.getElementById('workflowToastV148');if(!n){n=document.createElement('div');n.id='workflowToastV148';n.className='workflow-toast-v148';document.body.appendChild(n)}n.textContent=message;n.classList.toggle('is-error',!!error);n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,3800)}
  function hasRemoteConfig(){const c=window.firebaseConfig||{};return Boolean(c.apiKey&&c.databaseURL)}
  function dependencyState(){return remoteState}
  function dependencyStateReady(){return remoteState==='ready'||remoteState==='local-only'}
  async function initFirebase(){
    if(!hasRemoteConfig()){remoteState='local-only';emit();return null}
    try{
      const[a,d]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`)]);
      const config=window.firebaseConfig||{};
      const app=a.getApps().find(x=>x.name===APP_NAME)||a.initializeApp(config,APP_NAME);
      const db=d.getDatabase(app),rootRef=d.ref(db,`rooms/${ROOM_ID}/workflowV148`);
      remote={...d,db,rootRef};
      d.onValue(rootRef,s=>{workflow=normalize(s.val()||{});remoteState='ready';emit()},e=>{console.warn('Ver.150 workflow subscription failed',e);remoteState='error';emit()});
      return remote;
    }catch(e){console.warn('Ver.150 workflow helper unavailable',e);remoteState='error';emit();return null}
  }
  async function ensureRemote(){if(!initPromise)initPromise=initFirebase();await initPromise;return remote}
  async function writeDependencies(taskId,ids){
    const clean=[...new Set(ids.map(String).filter(id=>id&&id!==String(taskId)))],next=Object.fromEntries(clean.map(id=>[id,true]));
    if(clean.length)workflow.dependencies[String(taskId)]=next;else delete workflow.dependencies[String(taskId)];emit();
    const r=await ensureRemote();
    if(!r){if(remoteState==='local-only')return{ok:true,localOnly:true};notify('前提タスク設定を共同データへ保存できませんでした。',true);return{ok:false}}
    try{const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV148/dependencies/${taskId}`);const tx=await r.runTransaction(target,()=>clean.length?next:null,{applyLocally:false});if(!tx.committed)throw new Error('aborted');return{ok:true}}catch(e){console.warn(e);notify('前提タスク設定を共同データへ保存できませんでした。',true);return{ok:false}}
  }
  async function writeSavedView(id,view){
    workflow.savedViews[String(id)]=view;emit();const r=await ensureRemote();if(!r)return;
    try{const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV148/savedViews/${id}`);await r.runTransaction(target,()=>view,{applyLocally:false})}catch(e){console.warn(e);notify('表示形式の共有保存に失敗しました。',true)}
  }
  function applyRelationsLocal(taskId,ids){
    const id=String(taskId),clean=[...new Set(ids.map(String).filter(x=>x&&x!==id))],before=relationIds(id),all=new Set([...before,...clean]);
    for(const other of all){
      const next={...(workflow.relations?.[other]||{})};
      if(clean.includes(other))next[id]=true;else delete next[id];
      if(Object.keys(next).length)workflow.relations[other]=next;else delete workflow.relations[other];
    }
    if(clean.length)workflow.relations[id]=Object.fromEntries(clean.map(x=>[x,true]));else delete workflow.relations[id];
  }
  async function writeRelations(taskId,ids){
    const id=String(taskId),clean=[...new Set(ids.map(String).filter(x=>x&&x!==id))];applyRelationsLocal(id,clean);emit();
    const r=await ensureRemote();if(!r){if(remoteState==='local-only')return{ok:true,localOnly:true};notify('関連タスクを共同データへ保存できませんでした。',true);return{ok:false}}
    try{
      const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV148/relations`);
      const tx=await r.runTransaction(target,current=>{
        const next=current&&typeof current==='object'?JSON.parse(JSON.stringify(current)):{};
        const previous=Object.keys(next[id]&&typeof next[id]==='object'?next[id]:{}),all=new Set([...previous,...clean]);
        for(const other of all){
          const peer=next[other]&&typeof next[other]==='object'?{...next[other]}:{};
          if(clean.includes(other))peer[id]=true;else delete peer[id];
          if(Object.keys(peer).length)next[other]=peer;else delete next[other];
        }
        if(clean.length)next[id]=Object.fromEntries(clean.map(x=>[x,true]));else delete next[id];
        return next;
      },{applyLocally:false});
      if(!tx.committed)throw new Error('aborted');return{ok:true};
    }catch(e){console.warn(e);notify('関連タスクを共同データへ保存できませんでした。',true);return{ok:false}}
  }
  async function writeReminder(taskId,item,user=currentUser()){
    const u=userKey(user),id=String(taskId),next=item&&Number(item.at)>0?{at:Number(item.at),note:String(item.note||'').slice(0,240),updatedAt:Date.now()}:null;
    workflow.reminders[u]||={};if(next)workflow.reminders[u][id]=next;else delete workflow.reminders[u][id];if(!Object.keys(workflow.reminders[u]).length)delete workflow.reminders[u];emit();
    const r=await ensureRemote();if(!r){if(remoteState==='local-only')return{ok:true,localOnly:true};notify('リマインダーを共同データへ保存できませんでした。',true);return{ok:false}}
    try{const target=r.ref(r.db,`rooms/${ROOM_ID}/workflowV148/reminders/${u}/${id}`);const tx=await r.runTransaction(target,()=>next,{applyLocally:false});if(!tx.committed&&next)throw new Error('aborted');return{ok:true}}catch(e){console.warn(e);notify('リマインダーを保存できませんでした。',true);return{ok:false}}
  }
  load();
  const api={ROOM_ID,cacheKey,taskKey,get workflow(){return workflow},tasks,taskMap,isCompleted,depIds,activeBlockers,relationIds,reminderFor,remindersFor,currentUser,userKey,notify,writeDependencies,writeSavedView,writeRelations,writeReminder,safeJson,dependencyState,dependencyStateReady,ensureRemote};
  window.WorkBoardWorkflowV148=api;window.WorkBoardWorkflowV149=api;window.WorkBoardWorkflowV150=api;document.documentElement.dataset.workflowVersion='150';initPromise=initFirebase();
})();
