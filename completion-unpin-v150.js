// Ver.150: completed tasks must never remain pinned.
(function installCompletionUnpinV150(){
  const W=window.WorkBoardWorkflowV150||window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;if(!W)return;
  const inFlight=new Set();let remoteBound=false,localTimer=0;
  const completed=t=>String(t?.status||'')==='完了';
  function localRepair(){
    if(W.dependencyState?.()!=='local-only')return;
    const tasks=W.tasks(),targets=tasks.filter(t=>t&&completed(t)&&t.pinned===true);if(!targets.length)return;
    const ids=new Set(targets.map(t=>String(t.id||'')));const next=tasks.map(t=>ids.has(String(t?.id||''))?{...t,pinned:false,revision:Number(t.revision||0)+1}:t);
    try{localStorage.setItem(W.taskKey,JSON.stringify(next));if(typeof window.loadLocalTasks==='function')window.loadLocalTasks();else if(typeof window.render==='function')window.render()}catch(e){console.warn('Ver.150 local auto-unpin failed',e)}
  }
  async function repairRemoteTask(task,remote){
    const id=String(task?.id||'');if(!id||inFlight.has(id)||!completed(task)||task.pinned!==true)return;inFlight.add(id);
    try{
      const target=remote.ref(remote.db,`rooms/${W.ROOM_ID}/tasks/${id}`);
      await remote.runTransaction(target,current=>{
        if(!current||String(current.status||'')!=='完了'||current.pinned!==true)return;
        return{...current,pinned:false,revision:Number(current.revision||0)+1};
      },{applyLocally:false});
    }catch(e){console.warn('Ver.150 auto-unpin failed',id,e)}finally{inFlight.delete(id)}
  }
  async function bindRemote(){
    const remote=await W.ensureRemote?.();if(!remote){localRepair();if(!localTimer)localTimer=setInterval(localRepair,1500);return}if(remoteBound)return;remoteBound=true;
    const tasksRef=remote.ref(remote.db,`rooms/${W.ROOM_ID}/tasks`);
    remote.onValue(tasksRef,snapshot=>{const value=snapshot.val()||{};Object.entries(value).forEach(([id,t])=>repairRemoteTask({...t,id},remote))},e=>console.warn('Ver.150 auto-unpin subscription failed',e));
  }
  window.addEventListener('workflow-v150-update',()=>{if(W.dependencyState?.()==='local-only')localRepair()});
  bindRemote();
})();
