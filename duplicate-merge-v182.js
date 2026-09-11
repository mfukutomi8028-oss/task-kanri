// Ver.182 duplicate merge extracted from archive-duplicate-v153.js without changing merge behavior.
(function installDuplicateMergeV182(){
  const W=window.WorkBoardWorkflowV152;if(!W)return;
  let scheduled=false;
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function detailId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function dependencyUse(id){const map=W.taskMap(),own=(W.depIds?.(id)||[]).length,others=[...map.keys()].filter(other=>other!==id&&(W.depIds?.(other)||[]).includes(id));return{own,others}}
  function mergeComments(target,source){const out=[...(Array.isArray(target)?target:[])],seen=new Set(out.map(c=>String(c?.id||'')));for(const c of (Array.isArray(source)?source:[])){const id=String(c?.id||'');if(id&&seen.has(id))continue;out.push(c);if(id)seen.add(id)}return out.slice(-300)}
  function mergeChecklist(target,source){const out=[...(Array.isArray(target)?target:[])],seen=new Set(out.map(x=>String(x?.text||'').normalize('NFKC').trim()));for(const item of (Array.isArray(source)?source:[])){const key=String(item?.text||'').normalize('NFKC').trim();if(!key||seen.has(key))continue;out.push(item);seen.add(key)}return out.slice(0,120)}
  function syncDuplicateCache(source,target,now,me){
    try{
      const side=W.v152;if(!side)return;
      side.duplicates||={};side.archives||={};
      side.duplicates[source]={targetId:target,mergedAt:now,mergedBy:me};
      side.archives[source]={archivedAt:now,archivedBy:me,reason:'duplicate'};
      localStorage.setItem(`work-board-workflow-v152:${W.ROOM_ID}`,JSON.stringify(side));
      window.dispatchEvent(new CustomEvent('workflow-v152-update'));
    }catch(_){ }
  }
  async function mergeDuplicate(sourceId,targetId){
    const source=String(sourceId),target=String(targetId);if(!source||!target||source===target)return;
    const map=W.taskMap(),s=map.get(source),t=map.get(target);if(!s||!t)return W.notify('統合対象のタスクを確認できませんでした。',true);
    const deps=dependencyUse(source);if(deps.own||deps.others.length){W.notify('このタスクは前提タスク関係に使われています。誤って作業順序を変えないよう、前提タスク設定を整理してから重複統合してください。',true);return}
    if(!confirm(`「${s.title}」を「${t.title}」へ重複として統合しますか？\n\n元タスクは完了・アーカイブされ、説明・コメント・タグ・チェックリストを統合先へ引き継ぎます。`))return;
    const r=await W.ensureRemote?.(),now=Date.now(),me=W.currentUser?.()||'';if(!r){W.notify('重複統合は共同編集ONで利用できます。',true);return}
    try{
      const sourceRef=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks/${source}`),targetRef=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks/${target}`);
      const [sourceSnap,targetSnap]=await Promise.all([r.get(sourceRef),r.get(targetRef)]),rawS=sourceSnap.val(),rawT=targetSnap.val();
      if(!rawS||!rawT)throw new Error('統合対象のタスクが共同データ上に見つかりません。画面を更新して再試行してください。');
      if(Number(rawS.revision||0)!==Number(s.revision||0)||Number(rawT.revision||0)!==Number(t.revision||0))throw new Error('他の利用者による更新を検出しました。最新内容を確認してから再試行してください。');
      const sourceDesc=String(rawS.description||'').trim(),targetDesc=String(rawT.description||'').trim();let description=targetDesc;
      if(sourceDesc&&sourceDesc!==targetDesc&&!targetDesc.includes(sourceDesc))description=`${targetDesc}${targetDesc?'\n\n':''}---\n【重複タスク「${rawS.title||''}」から統合】\n${sourceDesc}`;
      const tags=[...new Set([...(Array.isArray(rawT.tags)?rawT.tags:[]),...(Array.isArray(rawS.tags)?rawS.tags:[])])],history=[...(Array.isArray(rawT.history)?rawT.history:[]),{id:`merge-${now}-${Math.random().toString(36).slice(2,7)}`,author:me,text:`「${rawS.title||''}」を重複タスクとして統合しました。`,createdAt:now}].slice(-80);
      const targetNext={...rawT,description,tags,comments:mergeComments(rawT.comments,rawS.comments),checklist:mergeChecklist(rawT.checklist,rawS.checklist),history,updatedAt:now,updatedBy:me,revision:Number(rawT.revision||0)+1};
      const sourceNext={...rawS,status:'完了',pinned:false,completedAt:Number(rawS.completedAt||0)||now,completedMemo:rawS.completedMemo||`重複として「${rawT.title||''}」へ統合`,duplicateOf:target,history:[...(Array.isArray(rawS.history)?rawS.history:[]),{id:`duplicate-${now}`,author:me,text:`「${rawT.title||''}」へ重複として統合しました。`,createdAt:now}].slice(-80),updatedAt:now,updatedBy:me,revision:Number(rawS.revision||0)+1};
      const roomRef=r.ref(r.db,`rooms/${W.ROOM_ID}`),updates={};
      updates[`tasks/${target}`]=targetNext;updates[`tasks/${source}`]=sourceNext;
      updates[`workflowV152/duplicates/${source}`]={targetId:target,mergedAt:now,mergedBy:me};
      updates[`workflowV152/archives/${source}`]={archivedAt:now,archivedBy:me,reason:'duplicate'};
      await r.update(roomRef,updates);
      const [verifySource,verifyTarget]=await Promise.all([r.get(sourceRef),r.get(targetRef)]);
      if(Number(verifySource.val()?.revision||0)!==sourceNext.revision||Number(verifyTarget.val()?.revision||0)!==targetNext.revision)throw new Error('統合結果を共同データで確認できませんでした。画面を更新して状態を確認してください。');
      syncDuplicateCache(source,target,now,me);
      const sourceRelations=W.relationIds?.(source)||[],targetRelations=W.relationIds?.(target)||[];
      if(sourceRelations.length){const rel=await W.writeRelations(target,[...new Set([...targetRelations,...sourceRelations].filter(x=>x!==source))]);if(rel?.ok!==false)await W.writeRelations(source,[])}
      await W.writeReminder?.(source,null);
      W.notify('重複タスクを統合しました。');document.getElementById('closeDetail')?.click();window.WorkBoardArchiveV182?.renderAll?.();
    }catch(e){console.warn('Ver.182 duplicate merge failed',e);W.notify(String(e?.message||'重複統合に失敗しました。'),true)}
  }
  function patchDetail(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;
    const id=detailId(detail),task=W.taskMap().get(id);if(!task)return;
    if(W.duplicateOf?.(id)||W.isArchived?.(id)){detail.querySelector('.workflow-duplicate-form-v152')?.remove();return}
    const section=detail.querySelector('.workflow-organize-v153');if(!section){window.WorkBoardArchiveV182?.renderAll?.();return}
    const map=W.taskMap(),latest=Math.max(0,...[...map.values()].map(t=>Number(t.updatedAt||0))),sig=`${id}|${task.status||''}|${task.revision||0}|${latest}|${map.size}`;let form=section.querySelector('.workflow-duplicate-form-v152');if(form?.dataset.signature===sig)return;form?.remove();
    const candidates=[...map.values()].filter(t=>t&&String(t.id)!==id&&!W.isArchived?.(t.id)&&!W.duplicateOf?.(t.id)).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    form=document.createElement('div');form.className='workflow-duplicate-form-v152';form.dataset.signature=sig;
    form.innerHTML=`<label><span>重複として統合</span><select data-duplicate-target-v153><option value="">統合先タスクを選択</option>${candidates.map(t=>`<option value="${esc(t.id)}">${esc(t.title||'名称未設定')}［${esc(t.status||'')}］</option>`).join('')}</select></label><button type="button" class="ghost-button" data-merge-duplicate-v153>重複として統合</button>`;
    const note=section.querySelector('.workflow-organize-note-v152');note?note.insertAdjacentElement('beforebegin',form):section.appendChild(form);
    form.querySelector('[data-merge-duplicate-v153]')?.addEventListener('click',()=>{const target=form.querySelector('[data-duplicate-target-v153]')?.value||'';if(!target)return W.notify('統合先タスクを選択してください。',true);mergeDuplicate(id,target)});
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patchDetail()})}
  window.WorkBoardDuplicateV182=Object.freeze({mergeDuplicate,schedule});
  window.addEventListener('workflow-v152-update',schedule);
  window.addEventListener('workboard:archive-v182-detail-rendered',schedule);
  const detailRoot=document.getElementById('detailBody');if(detailRoot)new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length||x.type==='attributes'))schedule()}).observe(detailRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
  patchDetail();
})();
