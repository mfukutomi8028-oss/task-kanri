// Ver.149 prerequisite-task semantics and completion guard.
(function installDependenciesV149(){
  const W=window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;if(!W)return;
  let scheduled=false,pendingTimelineTaskId='';
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const norm=v=>String(v||'').normalize('NFKC').trim();
  const isComplete=v=>norm(v)==='完了';
  function detailId(d){const k=d?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return k.startsWith('task-delete:')?k.slice(12):''}
  function blockers(id,map=W.taskMap()){return W.activeBlockers(String(id||''),map)}
  function dependencyReady(){return typeof W.dependencyStateReady==='function'?W.dependencyStateReady():true}
  function dependencyState(){return typeof W.dependencyState==='function'?W.dependencyState():'ready'}
  function blockerNames(id,map=W.taskMap()){return blockers(id,map).map(t=>String(t?.title||'名称未設定'))}
  function blockerMessage(id,map=W.taskMap()){
    const names=blockerNames(id,map),shown=names.slice(0,2).map(x=>`「${x}」`).join('、'),more=names.length>2?`ほか${names.length-2}件`:'';
    return `完了できません。前提タスク${shown?` ${shown}${more}`:''}が未完了です。先に完了するか、前提タスク設定を解除してください。`;
  }
  function guardCompletion(id,{silent=false}={}){
    if(!id)return false;
    if(!dependencyReady()){
      if(!silent)W.notify(dependencyState()==='error'?'前提タスク情報を確認できないため完了できません。通信状態を確認して再試行してください。':'前提タスク情報を確認中です。少し待ってから再試行してください。',true);
      return true;
    }
    const active=blockers(id);if(!active.length)return false;if(!silent)W.notify(blockerMessage(id),true);return true;
  }
  function reaches(start,target,seen=new Set()){
    const s=String(start||''),t=String(target||'');if(!s||!t)return false;if(s===t)return true;if(seen.has(s))return false;seen.add(s);
    return W.depIds(s).some(next=>reaches(next,t,seen));
  }
  function wouldCycle(taskId,candidateId){return reaches(candidateId,taskId,new Set())}
  function patchDetail(map){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;const task=map.get(detailId(detail));if(!task)return;
    const ids=W.depIds(task.id),active=blockers(task.id,map),missing=ids.filter(id=>!map.has(id)),sig=`${task.id}|${ids.join(',')}|${ids.map(id=>map.get(id)?.revision||0).join(',')}|${dependencyState()}`;
    let section=detail.querySelector('.workflow-dependencies-v149');if(section?.dataset.signature===sig){patchCompletionButton(detail,task,active);return}if(section)section.remove();
    const candidates=[...map.values()].filter(x=>x&&x.id!==task.id&&!W.isCompleted(x)&&!ids.includes(String(x.id))&&!wouldCycle(task.id,String(x.id))).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ja'));
    const lead=active.length?`${active.length}件の前提タスクが未完了です。`:ids.length?'前提タスクはすべて完了しています。':'このタスクより先に完了しておくタスクを設定できます。';
    section=document.createElement('section');section.className='detail-section workflow-dependencies-v149';section.dataset.signature=sig;
    section.innerHTML=`<div class="workflow-dependency-head-v149"><div><h4>前提タスク</h4><p>${esc(lead)}</p></div>${active.length?'<span class="workflow-prereq-pending-v149">⏳ 前提タスク未完了</span>':ids.length?'<span class="workflow-prereq-ready-v149">✓ 前提タスク完了</span>':''}</div>${ids.length?`<ul class="workflow-dependency-list-v149">${ids.map(id=>{const b=map.get(id),done=Boolean(b&&W.isCompleted(b)),gone=!b;return`<li><span class="workflow-dependency-state-v149 ${done?'is-done':gone?'is-missing':'is-pending'}">${done?'✓ 完了':gone?'削除済み':'未完了'}</span><span class="workflow-dependency-title-v149">${esc(b?.title||'削除済みのタスク')}</span><button type="button" class="ghost-button" data-remove-dependency-v149="${esc(id)}">解除</button></li>`}).join('')}</ul>`:''}<div class="workflow-dependency-add-v149"><select data-dependency-select-v149><option value="">前提タスクを選択</option>${candidates.map(x=>`<option value="${esc(x.id)}">${esc(x.title||'名称未設定')}</option>`).join('')}</select><button type="button" class="ghost-button" data-add-dependency-v149 ${candidates.length?'':'disabled'}>＋ 前提タスクを追加</button></div><p class="workflow-dependency-help-v149">${active.length?'前提タスクが未完了の間はこのタスクを完了できません。内容の編集や、完了以外の状態変更は可能です。':'前提タスクがすべて完了すると、このタスクを通常どおり完了できます。'}</p>${missing.length?'<p class="workflow-dependency-note-v149">削除済みの前提タスクは完了制限の対象外です。不要な関係は「解除」で整理できます。</p>':''}`;
    const first=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"] .detail-section, .detail-section');first?first.insertAdjacentElement('afterend',section):detail.appendChild(section);
    section.querySelector('[data-add-dependency-v149]')?.addEventListener('click',async()=>{const id=section.querySelector('[data-dependency-select-v149]')?.value||'';if(!id)return;if(wouldCycle(task.id,id)){W.notify('循環する前提タスク関係は設定できません。',true);return}const r=await W.writeDependencies(task.id,[...ids,id]);if(r.ok)W.notify('前提タスクを追加しました。')});
    section.querySelectorAll('[data-remove-dependency-v149]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.removeDependencyV149||'';const r=await W.writeDependencies(task.id,ids.filter(x=>x!==id));if(r.ok)W.notify('前提タスク設定を解除しました。')}));
    patchCompletionButton(detail,task,active);
  }
  function patchCompletionButton(detail,task,active){
    const button=detail.querySelector('[data-action="done"]');if(!button)return;const blocked=active.length>0||!dependencyReady();button.classList.toggle('workflow-completion-guard-v149',blocked);button.title=blocked?(active.length?blockerMessage(task.id):'前提タスク情報を確認後に完了できます。'):'タスクを完了にする';button.setAttribute('aria-disabled',blocked?'true':'false');
  }
  function patchSurfaces(map){
    document.querySelectorAll('.task-card[data-task-id],tr[data-task-id],.timeline-task[data-task-id],.attention-item[data-task-id]').forEach(node=>{const task=map.get(String(node.dataset.taskId||''));if(!task)return;const active=blockers(task.id,map),sig=`${task.revision||0}|${active.map(x=>x.id).join(',')}`;if(node.dataset.depV149===sig)return;node.dataset.depV149=sig;node.querySelectorAll('.workflow-prereq-inline-v149').forEach(x=>x.remove());node.classList.toggle('workflow-has-prereq-pending-v149',active.length>0);if(active.length){const badge=document.createElement('span');badge.className='badge workflow-prereq-inline-v149';badge.textContent=`⏳ 前提タスク未完了 ${active.length}`;(node.querySelector('.task-meta,.timeline-task-line')||node.cells?.[2]||node.querySelector('span')||node).appendChild(badge)}})
  }
  function stop(event){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation()}
  function taskFromDetail(){const d=document.getElementById('detailBody');return detailId(d)}
  function selectedBulkBlocked(){const map=W.taskMap(),ids=[...document.querySelectorAll('#listView [data-bulk-id]:checked')].map(x=>String(x.dataset.bulkId||''));return ids.filter(id=>blockers(id,map).length>0)}
  function parseDragId(event){try{const raw=event.dataTransfer?.getData('text/plain')||'';const p=raw?JSON.parse(raw):null;return p?.kind==='task'?String(p.id||''):''}catch(_){return''}}
  document.addEventListener('click',event=>{
    const mover=event.target.closest?.('[data-move-to-timeline]');if(mover)pendingTimelineTaskId=String(mover.dataset.moveToTimeline||'');
    const done=event.target.closest?.('#detailBody [data-action="done"]');if(done){const id=taskFromDetail();if(guardCompletion(id)){stop(event);return}}
    const bulk=event.target.closest?.('#listView [data-bulk-apply]');if(bulk){const action=document.querySelector('#listView [data-bulk-action]')?.value||'',target=document.querySelector('#listView [data-bulk-target]')?.value||'';if(action==='complete'||(action==='status'&&isComplete(target))){if(!dependencyReady()){stop(event);guardCompletion('__check__');return}const blocked=selectedBulkBlocked();if(blocked.length){stop(event);W.notify(`一括完了できません。選択したタスクのうち${blocked.length}件に未完了の前提タスクがあります。`,true);return}}}
    const confirmTimeline=event.target.closest?.('#confirmTimelineMove');if(confirmTimeline&&isComplete(document.getElementById('timelineMoveStatus')?.value)){const id=pendingTimelineTaskId;if(guardCompletion(id)){stop(event);const t=W.taskMap().get(id),s=document.getElementById('timelineMoveStatus');if(t&&s)s.value=t.status||s.value;return}}
  },true);
  document.addEventListener('change',event=>{
    const select=event.target;if(select?.matches?.('.detail-status-select-v146')&&isComplete(select.value)){const id=taskFromDetail();if(guardCompletion(id)){stop(event);select.value=select.dataset.currentStatus||W.taskMap().get(id)?.status||select.value;return}}
  },true);
  document.addEventListener('submit',event=>{
    if(event.target?.id!=='taskForm')return;const id=String(document.getElementById('taskId')?.value||''),status=document.getElementById('taskStatus')?.value||'';if(id&&isComplete(status)&&guardCompletion(id)){stop(event);const current=W.taskMap().get(id),select=document.getElementById('taskStatus');if(current&&select)select.value=current.status||select.value;return}
  },true);
  document.addEventListener('drop',event=>{
    const target=event.target?.closest?.('[data-task-drop-status],[data-timeline-status]');if(!target)return;const status=target.dataset.taskDropStatus||target.dataset.timelineStatus||'';if(!isComplete(status))return;const id=parseDragId(event);if(id&&guardCompletion(id)){stop(event);return}
  },true);
  function patch(){const map=W.taskMap();patchDetail(map);patchSurfaces(map)}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  window.addEventListener('workflow-v148-update',schedule);window.addEventListener('workflow-v149-update',schedule);
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule()}).observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true});
  setInterval(schedule,60000);window.WorkBoardCompletionGuardV149={guardCompletion,blockers,wouldCycle};patch();
})();
