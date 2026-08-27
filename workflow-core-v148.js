// Ver.148 shared workflow sidecar for dependencies and saved-view metadata.
(function installWorkflowCoreV148(){
  const FIREBASE_VERSION='10.12.5', APP_NAME='work-board-v148-helper';
  function sanitize(v){return String(v||'default').replace(/[.#$/\[\]]/g,'-').slice(0,60)}
  function room(){try{const q=new URLSearchParams(location.search).get('room');if(q)return sanitize(q)}catch(_){}try{return sanitize(localStorage.getItem('systemTaskRoomId')||'default')}catch(_){return'default'}}
  const ROOM_ID=room(), cacheKey=`work-board-workflow-v148:${ROOM_ID}`, taskKey=`system-task-tasks:${ROOM_ID}`;
  let workflow={dependencies:{},savedViews:{}}, remote=null;
  function safeJson(v,f){try{return JSON.parse(v)}catch(_){return f}}
  function normalize(v){const s=v&&typeof v==='object'?v:{};const dependencies={};for(const [taskId,map] of Object.entries(s.dependencies||{})){const ids=Object.entries(map&&typeof map==='object'?map:{}).filter(([,x])=>x===true).map(([id])=>String(id||'')).filter(Boolean);if(ids.length)dependencies[String(taskId)]=Object.fromEntries(ids.map(id=>[id,true]))}const savedViews={};for(const [id,item] of Object.entries(s.savedViews||{})){if(!item||typeof item!=='object')continue;const taskLayout=['board','list','timeline'].includes(item.taskLayout)?item.taskLayout:'';const cs=item.columnSort&&item.columnSort.key&&['asc','desc'].includes(item.columnSort.direction)?{key:String(item.columnSort.key),direction:item.columnSort.direction}:null;savedViews[String(id)]={taskLayout,columnSort:cs,updatedAt:Number(item.updatedAt||0)}}return{dependencies,savedViews}}
  function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(workflow))}catch(_){}}
  function load(){workflow=normalize(safeJson(localStorage.getItem(cacheKey)||'{}',{}))}
  function tasks(){const v=safeJson(localStorage.getItem(taskKey)||'[]',[]);return Array.isArray(v)?v:[]}
  function taskMap(){return new Map(tasks().map(t=>[String(t?.id||''),t]))}
  function isCompleted(t){return String(t?.status||'')==='完了'}
  function depIds(id){return Object.keys(workflow.dependencies?.[String(id)]||{})}
  function activeBlockers(id,map=taskMap()){return depIds(id).map(x=>map.get(x)).filter(t=>t&&!isCompleted(t))}
  function emit(){persist();window.dispatchEvent(new CustomEvent('workflow-v148-update'))}
  function notify(message,error=false){let n=document.getElementById('workflowToastV148');if(!n){n=document.createElement('div');n.id='workflowToastV148';n.className='workflow-toast-v148';document.body.appendChild(n)}n.textContent=message;n.classList.toggle('is-error',!!error);n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,3200)}
  async function initFirebase(){const config=window.firebaseConfig||{};if(!config.apiKey||!config.databaseURL)return;try{const[a,d]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`)]);const app=a.getApps().find(x=>x.name===APP_NAME)||a.initializeApp(config,APP_NAME);const db=d.getDatabase(app),rootRef=d.ref(db,`rooms/${ROOM_ID}/workflowV148`);remote={...d,db,rootRef};d.onValue(rootRef,s=>{workflow=normalize(s.val()||{});emit()},e=>console.warn('Ver.148 workflow subscription failed',e))}catch(e){console.warn('Ver.148 workflow helper local-only',e)}}
  async function writeDependencies(taskId,ids){const clean=[...new Set(ids.map(String).filter(id=>id&&id!==String(taskId)))],next=Object.fromEntries(clean.map(id=>[id,true]));if(clean.length)workflow.dependencies[String(taskId)]=next;else delete workflow.dependencies[String(taskId)];emit();if(!remote)return{ok:true,localOnly:true};try{const target=remote.ref(remote.db,`rooms/${ROOM_ID}/workflowV148/dependencies/${taskId}`);const r=await remote.runTransaction(target,()=>clean.length?next:null,{applyLocally:false});if(!r.committed)throw new Error('aborted');return{ok:true}}catch(e){console.warn(e);notify('依存関係を共同データへ保存できませんでした。',true);return{ok:false}}}
  async function writeSavedView(id,view){workflow.savedViews[String(id)]=view;emit();if(!remote)return;try{const target=remote.ref(remote.db,`rooms/${ROOM_ID}/workflowV148/savedViews/${id}`);await remote.runTransaction(target,()=>view,{applyLocally:false})}catch(e){console.warn(e);notify('表示形式の共有保存に失敗しました。',true)}}
  load();window.WorkBoardWorkflowV148={ROOM_ID,cacheKey,taskKey,get workflow(){return workflow},tasks,taskMap,isCompleted,depIds,activeBlockers,notify,writeDependencies,writeSavedView,safeJson};document.documentElement.dataset.workflowVersion='148';initFirebase();
})();
