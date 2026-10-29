// Ver.544: canonical duplicate merge of two tasks + workflow metadata in ONE room transaction.
// Presentation, confirmation, subscriptions, local cache, and post-commit relation/reminder cleanup remain in Classic.
// Preserve the preexisting read revisions and the cold Firebase null probe. No second task owner.
(function installDuplicateAtomicV544(root) {
  'use strict';
  if (root.WorkBoardDuplicateAtomicV544) return;
  function mergeComments(target,source){const out=[...(Array.isArray(target)?target:[])],seen=new Set(out.map(c=>String(c?.id||'')));for(const c of (Array.isArray(source)?source:[])){const id=String(c?.id||'');if(id&&seen.has(id))continue;out.push(c);if(id)seen.add(id)}return out.slice(-300)}
  function mergeChecklist(target,source){const out=[...(Array.isArray(target)?target:[])],seen=new Set(out.map(x=>String(x?.text||'').normalize('NFKC').trim()));for(const item of (Array.isArray(source)?source:[])){const key=String(item?.text||'').normalize('NFKC').trim();if(!key||seen.has(key))continue;out.push(item);seen.add(key)}return out.slice(0,120)}
  function buildMergedRecords(rawS,rawT,source,target,now,me){
    const sourceDesc=String(rawS.description||'').trim(),targetDesc=String(rawT.description||'').trim();let description=targetDesc;
    if(sourceDesc&&sourceDesc!==targetDesc&&!targetDesc.includes(sourceDesc))description=`${targetDesc}${targetDesc?'\n\n':''}---\n【重複タスク「${rawS.title||''}」から統合】\n${sourceDesc}`;
    const tags=[...new Set([...(Array.isArray(rawT.tags)?rawT.tags:[]),...(Array.isArray(rawS.tags)?rawS.tags:[])])],history=[...(Array.isArray(rawT.history)?rawT.history:[]),{id:`merge-${now}-${source}`,author:me,text:`「${rawS.title||''}」を重複タスクとして統合しました。`,createdAt:now}].slice(-80);
    const targetNext={...rawT,description,tags,comments:mergeComments(rawT.comments,rawS.comments),checklist:mergeChecklist(rawT.checklist,rawS.checklist),history,updatedAt:now,updatedBy:me,revision:Number(rawT.revision||0)+1};
    const sourceNext={...rawS,status:'完了',pinned:false,completedAt:Number(rawS.completedAt||0)||now,completedMemo:rawS.completedMemo||`重複として「${rawT.title||''}」へ統合`,duplicateOf:target,history:[...(Array.isArray(rawS.history)?rawS.history:[]),{id:`duplicate-${now}`,author:me,text:`「${rawT.title||''}」へ重複として統合しました。`,createdAt:now}].slice(-80),updatedAt:now,updatedBy:me,revision:Number(rawS.revision||0)+1};
    return{sourceNext,targetNext};
  }

  function create({ roomId }) {
    if (typeof roomId !== 'string' || !roomId) throw new TypeError('A canonical room id is required');
    async function commit({ remote, source, target, expectedSourceRevision, expectedTargetRevision, now, me }) {
      if (!remote || typeof remote.ref !== 'function' || typeof remote.runTransaction !== 'function') {
        throw new TypeError('An active canonical remote connection is required');
      }
      const r=remote,roomRef=r.ref(r.db,'rooms/'+roomId);
      let conflictReason='';
      const tx=await r.runTransaction(roomRef,current=>{
        if(current===null){conflictReason='cold';return null}
        conflictReason='';
        const room=current&&typeof current==='object'?current:{},rawTasks=room.tasks&&typeof room.tasks==='object'?room.tasks:{},rawS=rawTasks[source],rawT=rawTasks[target];
        if(!rawS||!rawT){conflictReason='missing';return}
        if(Number(rawS.revision||0)!==expectedSourceRevision||Number(rawT.revision||0)!==expectedTargetRevision){conflictReason='revision';return}
        const rawWorkflow=room.workflowV152&&typeof room.workflowV152==='object'?room.workflowV152:{},rawDuplicates=rawWorkflow.duplicates&&typeof rawWorkflow.duplicates==='object'?rawWorkflow.duplicates:{},rawArchives=rawWorkflow.archives&&typeof rawWorkflow.archives==='object'?rawWorkflow.archives:{};
        if(rawDuplicates[source]||rawArchives[source]||rawDuplicates[target]||rawArchives[target]){conflictReason='workflow';return}
        const {sourceNext,targetNext}=buildMergedRecords(rawS,rawT,source,target,now,me),tasks={...rawTasks,[target]:targetNext,[source]:sourceNext},duplicates={...rawDuplicates,[source]:{targetId:target,mergedAt:now,mergedBy:me}},archives={...rawArchives,[source]:{archivedAt:now,archivedBy:me,reason:'duplicate'}};
        return{...room,tasks,workflowV152:{...rawWorkflow,duplicates,archives}};
      },{applyLocally:false});
      const committedValue=tx.snapshot?.val?.();
      if(tx.committed&&committedValue===null)return{ok:false,conflict:true,reason:'missing'};
      if(!tx.committed)return{ok:false,conflict:true,reason:conflictReason||'aborted'};
      const committed=committedValue||{},sourceNext=committed.tasks?.[source],targetNext=committed.tasks?.[target],duplicate=committed.workflowV152?.duplicates?.[source],archive=committed.workflowV152?.archives?.[source];
      if(Number(sourceNext?.revision||0)!==expectedSourceRevision+1||Number(targetNext?.revision||0)!==expectedTargetRevision+1||duplicate?.targetId!==target||archive?.reason!=='duplicate')throw new Error('統合結果を共同データで確認できませんでした。画面を更新して状態を確認してください。');
      return{ok:true};
    }
    return Object.freeze({ commit });
  }
  root.WorkBoardDuplicateAtomicV544 = Object.freeze({ create, buildMergedRecords });
})(window);
