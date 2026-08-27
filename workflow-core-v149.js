// Ver.149 shared workflow sidecar. Keeps Ver.148 storage paths for backward compatibility.
(function installWorkflowCoreV149(){
  const FIREBASE_VERSION='10.12.5', APP_NAME='work-board-v149-helper';
  function sanitize(v){return String(v||'default').replace(/[.#$/\[\]]/g,'-').slice(0,60)}
  function room(){try{const q=new URLSearchParams(location.search).get('room');if(q)return sanitize(q)}catch(_){}try{return sanitize(localStorage.getItem('systemTaskRoomId')||'default')}catch(_){return'default'}}
  const ROOM_ID=room(), cacheKey=`work-board-workflow-v148:${ROOM_ID}`, taskKey=`system-task-tasks:${ROOM_ID}`;
  let workflow={dependencies:{},savedViews:{}}, remote=null, remoteState='loading', initPromise=null;
  function safeJson(v,f){try{return JSON.parse(v)}catch(_){return f}}
  function normalize(v){
    const s=v&&typeof v==='object'?v:{};
    const dependencies={};
    for(const [taskId,map] of Object.entries(s.dependencies||{})){
      const ids=Object.entries(map&&typeof map==='object'?map:{}).filter(([,x])=>x===true).map(([id])=>String(id||'')).filter(Boolean);
      if(ids.length)dependencies[String(taskId)]=Object.fromEntries(ids.map(id=>[id,true]));
    }
    const savedViews={};
    for(const [id,item] of Object.entries(s.savedViews||{})){
      if(!item||typeof item!=='object')continue;
      const taskLayout=['board','list','timeline'].includes(item.taskLayout)?item.taskLayout:'';
      const cs=item.columnSort&&item.columnSort.key&&['asc','desc'].includes(item.columnSort.direction)?{key:String(item.columnSort.key),direction:item.columnSort.direction}:null;
      savedViews[String(id)]={taskLayout,columnSort:cs,updatedAt:Number(item.updatedAt||0)};
    }
    return{dependencies,savedViews};
  }
  function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(workflow))}catch(_){}}
  function load(){workflow=normalize(safeJson(localStorage.getItem(cacheKey)||'{}',{}))}
  function tasks(){const v=safeJson(localStorage.getItem(taskKey)||'[]',[]);return Array.isArray(v)?v:[]}
  function taskMap(){return new Map(tasks().map(t=>[String(t?.id||''),t]))}
  function isCompleted(t){return String(t?.status||'')==='完了'}
  function depIds(id){return Object.keys(workflow.dependencies?.[String(id)]||{})}
  function activeBlockers(id,map=taskMap()){return depIds(id).map(x=>map.get(x)).filter(t=>t&&!isCompleted(t))}
  function emit(){persist();window.dispatchEvent(new CustomEvent('workflow-v148-update'));window.dispatchEvent(new CustomEvent('workflow-v149-update'))}
  function notify(message,error=false){let n=document.getElementById('workflowToastV148');if(!n){n=document.createElement('div');n.id='workflowToastV148';n.className='workflow-toast-v148';document.body.appendChild(n)}n.textContent=message;n.classList.toggle('is-error',!!error);n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,3600)}
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
      d.onValue(rootRef,s=>{workflow=normalize(s.val()||{});remoteState='ready';emit()},e=>{console.warn('Ver.149 workflow subscription failed',e);remoteState='error';emit()});
      return remote;
    }catch(e){console.warn('Ver.149 workflow helper unavailable',e);remoteState='error';emit();return null}
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
  load();
  const api={ROOM_ID,cacheKey,taskKey,get workflow(){return workflow},tasks,taskMap,isCompleted,depIds,activeBlockers,notify,writeDependencies,writeSavedView,safeJson,dependencyState,dependencyStateReady,ensureRemote};
  window.WorkBoardWorkflowV148=api;window.WorkBoardWorkflowV149=api;document.documentElement.dataset.workflowVersion='149';initPromise=initFirebase();
})();
