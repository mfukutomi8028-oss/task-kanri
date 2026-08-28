// Ver.153 contextual archive UI + safer atomic duplicate merge.
(function installArchiveDuplicateV153(){
  const W=window.WorkBoardWorkflowV152;if(!W)return;
  const AUTO_ARCHIVE_DAYS=90,DAY=86400000;let scheduled=false,modal=null,context=null,badge=null,search='',kind='all';
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function detailId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function archivedIds(){return [...new Set([...Object.keys(W.v152?.archives||{}),...Object.keys(W.v152?.duplicates||{})])]}
  function hiddenIds(){return new Set(archivedIds())}
  function openTask(id){const target=String(id||'');if(!target)return;closeModal();let node=document.querySelector(`[data-task-id="${CSS.escape(target)}"]`);if(node){node.click();return}document.querySelector('.nav-item[data-layout="tasks"]')?.click();document.querySelector('[data-task-layout="list"]')?.click();document.getElementById('resetFilters')?.click();const task=W.taskMap().get(target),q=document.getElementById('searchInput');if(task&&q){q.value=task.title||'';q.dispatchEvent(new Event('input',{bubbles:true}))}setTimeout(()=>document.querySelector(`[data-task-id="${CSS.escape(target)}"]`)?.click(),140)}
  function removeLegacyNav(){document.querySelectorAll('.workflow-archive-nav-v152').forEach(node=>node.remove())}
  function isCompletedTaskContext(){
    const taskLayout=document.querySelector('.nav-item[data-layout="tasks"]')?.classList.contains('active');
    if(!taskLayout)return false;
    const doneScope=document.querySelector('.nav-filter[data-filter="done"]')?.classList.contains('active');
    const statusDone=document.getElementById('statusFilter')?.value==='完了';
    return Boolean(doneScope||statusDone);
  }
  function ensureContext(){
    if(context?.isConnected)return;
    const anchor=document.querySelector('.task-control-row');if(!anchor)return;
    context=document.createElement('section');context.className='workflow-archive-context-v153';context.hidden=true;
    context.innerHTML='<div class="workflow-archive-context-copy-v153"><strong>完了タスクの整理</strong><span>アーカイブ済みの完了タスクは、通常の一覧から分けて確認・復元できます。</span></div><button type="button" class="ghost-button workflow-archive-access-v153" data-open-archive-v153><span>アーカイブ済みを表示</span><strong class="workflow-archive-access-badge-v153">0</strong></button>';
    anchor.insertAdjacentElement('afterend',context);badge=context.querySelector('.workflow-archive-access-badge-v153');context.querySelector('[data-open-archive-v153]')?.addEventListener('click',openModal);
  }
  function ensureModal(){
    if(modal?.isConnected)return;
    modal=document.createElement('div');modal.className='workflow-archive-shell-v153';modal.hidden=true;
    modal.innerHTML=`<div class="workflow-archive-backdrop-v153" data-close-archive-v153></div><section class="workflow-archive-modal-v153" role="dialog" aria-modal="true" aria-label="アーカイブ済みタスク"><header><div><small>COMPLETED TASK ARCHIVE</small><h3>アーカイブ済みタスク</h3><p>完了タスクを整理した保管場所です。削除ではないため、必要なタスクはいつでも復元できます。</p></div><button type="button" class="icon-button" data-close-archive-v153 aria-label="閉じる">×</button></header><div class="workflow-archive-tools-v153"><input type="search" placeholder="件名・内容で検索" data-archive-search-v153><div class="workflow-archive-tabs-v153" role="group" aria-label="アーカイブ種別"><button type="button" data-archive-kind-v153="all" class="active">すべて</button><button type="button" data-archive-kind-v153="archive">通常</button><button type="button" data-archive-kind-v153="duplicate">重複統合</button></div></div><div class="workflow-archive-summary-v153" data-archive-summary-v153></div><div class="workflow-archive-list-v152 workflow-archive-list-v153" data-archive-list-v153></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-archive-v153]').forEach(x=>x.addEventListener('click',closeModal));
    modal.querySelector('[data-archive-search-v153]')?.addEventListener('input',e=>{search=e.target.value.trim().normalize('NFKC').toLowerCase();renderModal()});
    modal.querySelectorAll('[data-archive-kind-v153]').forEach(x=>x.addEventListener('click',()=>{kind=x.dataset.archiveKindV153;renderModal()}));
  }
  function openModal(){ensureModal();modal.hidden=false;document.body.classList.add('workflow-modal-open-v153');renderModal();setTimeout(()=>modal.querySelector('[data-archive-search-v153]')?.focus(),0)}
  function closeModal(){if(modal)modal.hidden=true;document.body.classList.remove('workflow-modal-open-v153')}
  function renderModal(){
    ensureModal();const map=W.taskMap(),allIds=archivedIds(),all=allIds.map(id=>{const dup=W.duplicateInfo?.(id),info=W.archiveInfo?.(id)||{archivedAt:Number(dup?.mergedAt||0),archivedBy:String(dup?.mergedBy||''),reason:'duplicate'};return{id,info,task:map.get(id),dup}}).filter(x=>x.task);
    const entries=all.filter(x=>kind==='all'||(kind==='duplicate'?Boolean(x.dup):!x.dup)).filter(x=>{if(!search)return true;const s=`${x.task.title||''} ${x.task.description||''} ${x.task.completedMemo||''}`.normalize('NFKC').toLowerCase();return s.includes(search)}).sort((a,b)=>Number(b.info.archivedAt)-Number(a.info.archivedAt));
    const list=modal.querySelector('[data-archive-list-v153]'),summary=modal.querySelector('[data-archive-summary-v153]');
    modal.querySelectorAll('[data-archive-kind-v153]').forEach(x=>x.classList.toggle('active',x.dataset.archiveKindV153===kind));
    if(summary)summary.textContent=`アーカイブ ${all.length}件 ／ 表示 ${entries.length}件`;
    if(!entries.length){list.innerHTML='<div class="workflow-inbox-empty-v152"><strong>該当するアーカイブはありません</strong><span>検索条件または種別を変更してください。</span></div>';return}
    list.innerHTML=entries.map(({id,info,task,dup})=>`<article class="workflow-archive-item-v152"><div><span class="workflow-archive-kind-v152 ${dup?'is-duplicate':''}">${dup?'重複統合':'アーカイブ'}</span><strong>${esc(task.title||'名称未設定')}</strong><small>${esc(task.completedAt?new Date(task.completedAt).toLocaleDateString('ja-JP'):'完了日不明')} · ${esc(info.archivedBy||'')}</small>${dup?`<em>統合先：${esc(map.get(dup.targetId)?.title||'タスク')}</em>`:''}</div><div class="workflow-archive-actions-v152">${dup?`<button type="button" class="ghost-button" data-open-canonical-v153="${esc(dup.targetId)}">統合先を見る</button>`:`<button type="button" class="ghost-button" data-restore-archive-v153="${esc(id)}">復元</button>`}</div></article>`).join('');
    list.querySelectorAll('[data-restore-archive-v153]').forEach(b=>b.addEventListener('click',async()=>{const r=await W.unarchiveTask(b.dataset.restoreArchiveV153);if(r?.ok){W.notify('タスクをアーカイブから復元しました。');renderAll()}}));
    list.querySelectorAll('[data-open-canonical-v153]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.openCanonicalV153)));
  }
  function patchVisibility(){const hidden=hiddenIds();document.querySelectorAll('[data-task-id]').forEach(node=>{const id=String(node.dataset.taskId||'');if(!id)return;const hide=hidden.has(id);node.classList.toggle('workflow-task-archived-v152',hide);node.hidden=hide});document.querySelectorAll('.board-column').forEach(col=>{const count=[...col.querySelectorAll('.task-card[data-task-id]')].filter(x=>!x.hidden).length,em=col.querySelector('.column-head em');if(em&&em.textContent!==String(count))em.textContent=String(count)})}
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
      W.notify('重複タスクを統合しました。');document.getElementById('closeDetail')?.click();renderAll();
    }catch(e){console.warn('Ver.153 duplicate merge failed',e);W.notify(String(e?.message||'重複統合に失敗しました。'),true)}
  }
  function patchDetail(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;
    const id=detailId(detail),task=W.taskMap().get(id);if(!task)return;
    if(W.duplicateOf?.(id)||W.isArchived?.(id)){detail.querySelector('.workflow-organize-v153,.workflow-organize-v152')?.remove();return}
    const map=W.taskMap(),latest=Math.max(0,...[...map.values()].map(t=>Number(t.updatedAt||0))),sig=`${id}|${task.status||''}|${task.revision||0}|${latest}|${map.size}`;let existing=detail.querySelector('.workflow-organize-v153');if(existing?.dataset.signature===sig)return;detail.querySelector('.workflow-organize-v152')?.remove();existing?.remove();
    const panel=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"]')||detail,candidates=[...map.values()].filter(t=>t&&String(t.id)!==id&&!W.isArchived?.(t.id)&&!W.duplicateOf?.(t.id)).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)),section=document.createElement('section');section.className='detail-section workflow-organize-v152 workflow-organize-v153';section.dataset.signature=sig;
    section.innerHTML=`<div class="workflow-organize-head-v152"><div><h4>整理</h4><p>重複したタスクの統合や、完了タスクのアーカイブを行います。</p></div></div>${W.isCompleted(task)?'<button type="button" class="ghost-button workflow-archive-task-v152">▣ アーカイブ</button>':''}<div class="workflow-duplicate-form-v152"><label><span>重複として統合</span><select data-duplicate-target-v153><option value="">統合先タスクを選択</option>${candidates.map(t=>`<option value="${esc(t.id)}">${esc(t.title||'名称未設定')}［${esc(t.status||'')}］</option>`).join('')}</select></label><button type="button" class="ghost-button" data-merge-duplicate-v153>重複として統合</button></div><p class="workflow-organize-note-v152">統合元は削除せずアーカイブに残すため、経緯を後から確認できます。</p>`;
    panel.appendChild(section);
    section.querySelector('.workflow-archive-task-v152')?.addEventListener('click',async()=>{const r=await W.archiveTask(id,'manual');if(r?.ok){W.notify('完了タスクをアーカイブしました。');document.getElementById('closeDetail')?.click();renderAll()}});
    section.querySelector('[data-merge-duplicate-v153]')?.addEventListener('click',()=>{const target=section.querySelector('[data-duplicate-target-v153]')?.value||'';if(!target)return W.notify('統合先タスクを選択してください。',true);mergeDuplicate(id,target)});
  }
  async function autoArchive(){const cutoff=Date.now()-AUTO_ARCHIVE_DAYS*DAY,targets=[...W.taskMap().values()].filter(t=>t&&W.isCompleted(t)&&Number(t.completedAt||0)>0&&Number(t.completedAt)<cutoff&&!W.isArchived?.(t.id)&&!W.duplicateOf?.(t.id)).slice(0,20);for(const task of targets)await W.archiveTask(task.id,'auto')}
  function renderAll(){
    removeLegacyNav();ensureContext();ensureModal();patchVisibility();patchDetail();
    const count=archivedIds().length;if(badge)badge.textContent=String(count);if(context)context.hidden=!isCompletedTaskContext();
    if(modal&&!modal.hidden)renderModal();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderAll()})}
  window.addEventListener('workflow-v152-update',schedule);
  const mainRoot=document.getElementById('mainContent'),detailRoot=document.getElementById('detailBody'),navRoot=document.querySelector('.nav');
  [mainRoot,detailRoot,navRoot].filter(Boolean).forEach(root=>new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length||x.type==='attributes'))schedule()}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']}));
  document.getElementById('statusFilter')?.addEventListener('change',schedule);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)closeModal()});
  renderAll();setTimeout(autoArchive,2500);setInterval(autoArchive,6*60*60*1000);
})();
