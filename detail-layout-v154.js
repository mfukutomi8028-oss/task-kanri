// Ver.154 task detail information architecture + quick pin.
(function installTaskDetailLayoutV154(){
  const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150||window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;
  if(!W)return;
  const activeTabs=new Map(),pinPending=new Set();
  let scheduled=false;
  function detailId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function activate(detail,taskId,name,focus=false){
    const tabs=[...detail.querySelectorAll('.task-detail-tab-v149')],panels=[...detail.querySelectorAll('.task-detail-panel-v149')];
    tabs.forEach(tab=>{const on=tab.dataset.tab===name;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',on?'true':'false');tab.tabIndex=on?0:-1});
    panels.forEach(panel=>{panel.hidden=panel.dataset.tabPanel!==name});activeTabs.set(taskId,name);
    if(focus)detail.querySelector(`.task-detail-tab-v149[data-tab="${CSS.escape(name)}"]`)?.focus();
    if(name==='comments')setTimeout(()=>detail.querySelector('#commentText')?.focus(),60);
  }
  function ensureToolsTab(detail,taskId){
    const bar=detail.querySelector(':scope > .task-detail-tabs-v149'),details=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"]');
    if(!bar||!details)return null;
    let tab=bar.querySelector('[data-tab="tools"]');
    if(!tab){tab=document.createElement('button');tab.type='button';tab.className='task-detail-tab-v149 task-detail-tools-tab-v154';tab.dataset.tab='tools';tab.setAttribute('role','tab');tab.textContent='関連・整理';bar.appendChild(tab)}
    let panel=detail.querySelector('.task-detail-panel-v149[data-tab-panel="tools"]');
    if(!panel){panel=document.createElement('div');panel.className='task-detail-panel-v149 task-tools-panel-v154';panel.dataset.tabPanel='tools';panel.setAttribute('role','tabpanel');panel.innerHTML='<div class="task-tools-intro-v154"><strong>関連・整理</strong><span>前提・関連タスク、あとで確認するリマインダー、重複やアーカイブなど、日常的な運用操作をまとめています。</span></div>';const history=detail.querySelector('.task-detail-panel-v149[data-tab-panel="history"]');history?history.insertAdjacentElement('afterend',panel):detail.appendChild(panel)}
    if(bar.dataset.workflowV154!=='true'){
      bar.dataset.workflowV154='true';
      bar.addEventListener('click',event=>{const clicked=event.target.closest?.('.task-detail-tab-v149');if(!clicked)return;activeTabs.set(taskId,clicked.dataset.tab||'details');if(clicked.dataset.tab==='tools')activate(detail,taskId,'tools')},true);
      bar.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const current=event.target.closest?.('.task-detail-tab-v149');if(!current)return;const tabs=[...bar.querySelectorAll('.task-detail-tab-v149')],index=tabs.indexOf(current);if(index<0)return;event.preventDefault();event.stopImmediatePropagation();let next=index;if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;activate(detail,taskId,tabs[next].dataset.tab,true)},true);
    }
    const current=bar.querySelector('.task-detail-tab-v149.active')?.dataset.tab||'details',wanted=activeTabs.get(taskId)||current;
    if(bar.querySelector(`[data-tab="${CSS.escape(wanted)}"]`))activate(detail,taskId,wanted);
    else activate(detail,taskId,'details');
    return panel;
  }
  function moveWorkflowSections(detail,panel){
    const order=['.workflow-dependencies-v149','.workflow-relations-v152','.workflow-reminder-v152','.workflow-organize-v153'];
    for(const selector of order){const section=detail.querySelector(selector);if(section&&section.parentElement!==panel)panel.appendChild(section)}
    const intro=panel.querySelector('.task-tools-intro-v154');if(intro&&panel.firstElementChild!==intro)panel.prepend(intro);
  }
  function moveMetadataToBottom(detail){
    const panel=detail.querySelector('.task-detail-panel-v149[data-tab-panel="details"]');if(!panel)return;
    const metadata=[...panel.children].find(node=>node.classList?.contains('detail-section')&&node.querySelector('.detail-grid .field-card'));
    if(!metadata)return;
    metadata.classList.add('task-metadata-section-v154');
    if(!metadata.querySelector(':scope > .task-metadata-head-v154')){const head=document.createElement('div');head.className='task-metadata-head-v154';head.innerHTML='<strong>タスク情報</strong><span>担当・期限・作成／更新日時などの管理情報</span>';metadata.prepend(head)}
    if(panel.lastElementChild!==metadata)panel.appendChild(metadata);
  }
  async function togglePin(taskId,button){
    const id=String(taskId||'');if(!id||pinPending.has(id))return;const task=W.taskMap().get(id);if(!task)return;
    const target=!Boolean(task.pinned);pinPending.add(id);button.disabled=true;const oldText=button.textContent;button.textContent='更新中…';
    try{
      const r=await W.ensureRemote?.();if(!r){W.notify('現在は共同データへ接続できないため、固定表示はタスク編集から変更してください。',true);return}
      const now=Date.now(),me=W.currentUser?.()||'',eventId=`pin-${now}-${Math.random().toString(36).slice(2,7)}`,taskRef=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks/${id}`);
      const tx=await r.runTransaction(taskRef,current=>{if(!current||typeof current!=='object')return;const history=(Array.isArray(current.history)?current.history:[]).filter(item=>String(item?.id||'')!==eventId);history.push({id:eventId,author:me,text:target?'固定表示を有効化しました。':'固定表示を解除しました。',createdAt:now});return{...current,pinned:target,updatedAt:now,updatedBy:me,revision:Number(current.revision||0)+1,history:history.slice(-80)}},{applyLocally:false});
      if(!tx.committed)throw new Error('固定表示を更新できませんでした。');const verify=await r.get(taskRef);if(Boolean(verify.val()?.pinned)!==target)throw new Error('固定表示の反映を確認できませんでした。');
      button.dataset.pinned=target?'true':'false';button.classList.toggle('is-pinned',target);button.textContent=target?'📌 固定解除':'📌 固定';W.notify(target?'タスクを固定表示にしました。':'固定表示を解除しました。');
    }catch(error){console.warn('Ver.154 quick pin failed',error);W.notify(String(error?.message||'固定表示の更新に失敗しました。'),true);button.textContent=oldText}
    finally{button.disabled=false;pinPending.delete(id)}
  }
  function patchQuickPin(detail,taskId){
    const task=W.taskMap().get(taskId),actions=detail.querySelector(':scope > .detail-actions .sub-actions');if(!task||!actions)return;
    let button=actions.querySelector('[data-quick-pin-v154]');if(!button){button=document.createElement('button');button.type='button';button.className='ghost-button detail-quick-pin-v154';button.dataset.quickPinV154=taskId;const favorite=actions.querySelector('[data-action="favorite"]');favorite?favorite.insertAdjacentElement('beforebegin',button):actions.prepend(button);button.addEventListener('click',()=>togglePin(taskId,button))}
    const pinned=Boolean(task.pinned);if(!pinPending.has(taskId)){button.dataset.pinned=pinned?'true':'false';button.classList.toggle('is-pinned',pinned);button.textContent=pinned?'📌 固定解除':'📌 固定';button.title=pinned?'固定表示を解除する':'このタスクを固定表示する'}
  }
  function patchArchiveExplanation(){
    document.querySelectorAll('.workflow-archive-context-copy-v153 span').forEach(node=>{node.textContent='完了から90日経過したタスクは自動でアーカイブされます。完了タスクは「関連・整理」から手動でアーカイブすることもでき、ここから確認・復元できます。'});
    document.querySelectorAll('.workflow-archive-modal-v153>header p').forEach(node=>{node.textContent='完了タスクの保管場所です。完了から90日で自動アーカイブされるほか、手動で整理したタスクもここに入ります。削除ではないため、通常アーカイブはいつでも復元できます。'});
  }
  function patchDetail(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;const taskId=detailId(detail);if(!taskId)return;
    const tools=ensureToolsTab(detail,taskId);if(!tools)return;moveWorkflowSections(detail,tools);moveMetadataToBottom(detail);patchQuickPin(detail,taskId);
  }
  function patch(){patchDetail();patchArchiveExplanation()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  function observe(root){if(!root)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length||x.type==='characterData'))schedule()}).observe(root,{childList:true,subtree:true,characterData:true})}
  ['workflow-v152-update','workflow-v150-update','workflow-v149-update'].forEach(name=>window.addEventListener(name,schedule));observe(document.getElementById('detailBody'));observe(document.getElementById('mainContent'));patch();
})();
