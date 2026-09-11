// Ver.182 archive UI extracted from archive-duplicate-v153.js without changing archive behavior.
(function installArchiveUiV182(){
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
  function patchDetail(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;
    const id=detailId(detail),task=W.taskMap().get(id);if(!task)return;
    if(W.duplicateOf?.(id)||W.isArchived?.(id)){detail.querySelector('.workflow-organize-v153,.workflow-organize-v152')?.remove();return}
    const map=W.taskMap(),latest=Math.max(0,...[...map.values()].map(t=>Number(t.updatedAt||0))),sig=`${id}|${task.status||''}|${task.revision||0}|${latest}|${map.size}`;let existing=detail.querySelector('.workflow-organize-v153');if(existing?.dataset.signature===sig)return;detail.querySelector('.workflow-organize-v152')?.remove();existing?.remove();
    const panel=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"]')||detail,section=document.createElement('section');section.className='detail-section workflow-organize-v152 workflow-organize-v153';section.dataset.signature=sig;
    section.innerHTML=`<div class="workflow-organize-head-v152"><div><h4>整理</h4><p>重複したタスクの統合や、完了タスクのアーカイブを行います。</p></div></div>${W.isCompleted(task)?'<button type="button" class="ghost-button workflow-archive-task-v152">▣ アーカイブ</button>':''}<p class="workflow-organize-note-v152">統合元は削除せずアーカイブに残すため、経緯を後から確認できます。</p>`;
    panel.appendChild(section);
    section.querySelector('.workflow-archive-task-v152')?.addEventListener('click',async()=>{const r=await W.archiveTask(id,'manual');if(r?.ok){W.notify('完了タスクをアーカイブしました。');document.getElementById('closeDetail')?.click();renderAll()}});
    window.dispatchEvent(new CustomEvent('workboard:archive-v182-detail-rendered',{detail:{taskId:id,signature:sig}}));
  }
  async function autoArchive(){const cutoff=Date.now()-AUTO_ARCHIVE_DAYS*DAY,targets=[...W.taskMap().values()].filter(t=>t&&W.isCompleted(t)&&Number(t.completedAt||0)>0&&Number(t.completedAt)<cutoff&&!W.isArchived?.(t.id)&&!W.duplicateOf?.(t.id)).slice(0,20);for(const task of targets)await W.archiveTask(task.id,'auto')}
  function renderAll(){
    removeLegacyNav();ensureContext();ensureModal();patchVisibility();patchDetail();
    const count=archivedIds().length;if(badge)badge.textContent=String(count);if(context)context.hidden=!isCompletedTaskContext();
    if(modal&&!modal.hidden)renderModal();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderAll()})}
  window.WorkBoardArchiveV182=Object.freeze({renderAll,schedule,detailId,esc});
  window.addEventListener('workflow-v152-update',schedule);
  const mainRoot=document.getElementById('mainContent'),detailRoot=document.getElementById('detailBody'),navRoot=document.querySelector('.nav');
  [mainRoot,detailRoot,navRoot].filter(Boolean).forEach(root=>new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length||x.type==='attributes'))schedule()}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']}));
  document.getElementById('statusFilter')?.addEventListener('change',schedule);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)closeModal()});
  renderAll();setTimeout(autoArchive,2500);setInterval(autoArchive,6*60*60*1000);
})();
