// Ver.150: non-blocking related tasks + follow-up task creation.
(function installRelationshipsV150(){
  const W=window.WorkBoardWorkflowV150||window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;if(!W)return;
  let scheduled=false;
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function detailId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function openTask(id){
    if(typeof window.selectTask==='function'){window.selectTask(String(id));return}
    const task=W.taskMap().get(String(id)),q=document.getElementById('searchInput');if(task&&q){q.value=task.title||'';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-task-layout="list"]')?.click();setTimeout(()=>document.querySelector(`[data-task-id="${CSS.escape(String(id))}"]`)?.click(),80)}
  }
  async function waitForCreated(id,sourceId){
    for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,150));if(W.taskMap().has(id)){const current=W.relationIds(id);const result=await W.writeRelations(id,[...current,sourceId]);if(result?.ok)W.notify('フォローアップタスクを作成し、元タスクと関連付けました。');return}}
  }
  function createFollowUp(task){
    if(typeof window.openTaskDialog!=='function'){W.notify('新しいタスク画面を開けませんでした。',true);return}
    const newId=`follow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;window.openTaskDialog();
    requestAnimationFrame(()=>{
      const dialog=document.getElementById('taskDialog'),id=document.getElementById('taskId'),title=document.getElementById('taskTitle'),desc=document.getElementById('taskDescription');
      if(!dialog?.open||!id||!title)return;id.value=newId;title.value=`フォロー：${String(task.title||'').slice(0,70)}`;if(desc&&!desc.value)desc.value=`元タスク「${String(task.title||'')}」のフォローアップ。\n`;title.focus();title.select();
      dialog.addEventListener('close',()=>waitForCreated(newId,String(task.id)),{once:true});
    });
  }
  function patch(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;const id=detailId(detail),map=W.taskMap(),task=map.get(id);if(!task)return;
    const ids=W.relationIds(id),sig=`${id}|${ids.join(',')}|${ids.map(x=>map.get(x)?.revision||0).join(',')}`;let section=detail.querySelector('.workflow-relations-v150');if(section?.dataset.signature===sig)return;if(section)section.remove();
    const candidates=[...map.values()].filter(t=>t&&String(t.id)!==id&&!ids.includes(String(t.id))).sort((a,b)=>(W.isCompleted(a)?1:0)-(W.isCompleted(b)?1:0)||Number(b.updatedAt||0)-Number(a.updatedAt||0));
    section=document.createElement('section');section.className='detail-section workflow-relations-v150';section.dataset.signature=sig;
    section.innerHTML=`<div class="workflow-related-head-v150"><div><h4>関連タスク</h4><p>前後関係はないものの、一緒に確認したい案件をつなげます。</p></div><button type="button" class="ghost-button workflow-followup-v150">＋ フォローアップ作成</button></div>${ids.length?`<ul class="workflow-related-list-v150">${ids.map(otherId=>{const t=map.get(otherId);return`<li><button type="button" class="workflow-related-open-v150" data-open-related-v150="${esc(otherId)}"><strong>${esc(t?.title||'削除済みのタスク')}</strong><span>${esc(t?.status||'削除済み')}</span></button><button type="button" class="ghost-button" data-remove-related-v150="${esc(otherId)}">解除</button></li>`}).join('')}</ul>`:'<p class="workflow-related-empty-v150">関連タスクはありません。</p>'}<div class="workflow-related-add-v150"><select data-related-select-v150><option value="">関連付けるタスクを選択</option>${candidates.map(t=>`<option value="${esc(t.id)}">${esc(t.title||'名称未設定')}［${esc(t.status||'')}］</option>`).join('')}</select><button type="button" class="ghost-button" data-add-related-v150 ${candidates.length?'':'disabled'}>＋ 関連付け</button></div>`;
    const panel=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"]')||detail,anchor=panel.querySelector('.workflow-dependencies-v149')||panel.querySelector('.detail-section');anchor?anchor.insertAdjacentElement('afterend',section):panel.appendChild(section);
    section.querySelector('[data-add-related-v150]')?.addEventListener('click',async()=>{const other=section.querySelector('[data-related-select-v150]')?.value||'';if(!other)return;const r=await W.writeRelations(id,[...ids,other]);if(r?.ok)W.notify('関連タスクを追加しました。')});
    section.querySelectorAll('[data-remove-related-v150]').forEach(b=>b.addEventListener('click',async()=>{const other=b.dataset.removeRelatedV150||'';const r=await W.writeRelations(id,ids.filter(x=>x!==other));if(r?.ok)W.notify('関連付けを解除しました。')}));
    section.querySelectorAll('[data-open-related-v150]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.openRelatedV150)));
    section.querySelector('.workflow-followup-v150')?.addEventListener('click',()=>createFollowUp(task));
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  window.addEventListener('workflow-v150-update',schedule);window.addEventListener('workflow-v149-update',schedule);
  const root=document.getElementById('detailBody');if(root)new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule()}).observe(root,{childList:true,subtree:true});patch();
})();
