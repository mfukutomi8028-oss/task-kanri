// Ver.154 task detail information architecture + quick pin.
(function installTaskDetailLayoutV154(){
  const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150||window.WorkBoardWorkflowV149||window.WorkBoardWorkflowV148;
  if(!W)return;
  const activeTabs=new Map(),pinPending=new Set();
  let scheduled=false,dialogTabsInstalled=false,detailHome=null,detailNextSibling=null,taskDialogObserver=null;
  function detailId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function activate(detail,taskId,name,focus=false){
    const tabs=[...detail.querySelectorAll('.task-detail-tab-v149')],panels=[...detail.querySelectorAll('.task-detail-panel-v149')];
    tabs.forEach(tab=>{const on=tab.dataset.tab===name;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',on?'true':'false');tab.tabIndex=on?0:-1});
    panels.forEach(panel=>{panel.hidden=panel.dataset.tabPanel!==name});activeTabs.set(taskId,name);
    if(focus)detail.querySelector(`.task-detail-tab-v149[data-tab="${CSS.escape(name)}"]`)?.focus();
    if(name==='comments'&&!detail.classList.contains('task-dialog-detail-active-v320'))setTimeout(()=>detail.querySelector('#commentText')?.focus(),60);
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
      button.dataset.pinned=target?'true':'false';button.classList.toggle('is-pinned',target);button.textContent=target?'固定解除':'固定';W.notify(target?'タスクを固定表示にしました。':'固定表示を解除しました。');
    }catch(error){console.warn('Ver.154 quick pin failed',error);W.notify(String(error?.message||'固定表示の更新に失敗しました。'),true);button.textContent=oldText}
    finally{button.disabled=false;pinPending.delete(id)}
  }
  function patchQuickPin(detail,taskId){
    const task=W.taskMap().get(taskId),actions=detail.querySelector(':scope > .detail-actions .sub-actions');if(!task||!actions)return;
    let button=actions.querySelector('[data-quick-pin-v154]');if(!button){button=document.createElement('button');button.type='button';button.className='ghost-button detail-quick-pin-v154';button.dataset.quickPinV154=taskId;const favorite=actions.querySelector('[data-action="favorite"]');favorite?favorite.insertAdjacentElement('beforebegin',button):actions.prepend(button);button.addEventListener('click',()=>togglePin(taskId,button))}
    const pinned=Boolean(task.pinned);if(!pinPending.has(taskId)){button.dataset.pinned=pinned?'true':'false';button.classList.toggle('is-pinned',pinned);button.textContent=pinned?'固定解除':'固定';button.title=pinned?'固定表示を解除する':'このタスクを固定表示する'}
  }
  function patchArchiveExplanation(){
    document.querySelectorAll('.workflow-archive-context-copy-v153 span').forEach(node=>{node.textContent='完了から90日経過したタスクは自動でアーカイブされます。完了タスクは「関連・整理」から手動でアーカイブすることもでき、ここから確認・復元できます。'});
    document.querySelectorAll('.workflow-archive-modal-v153>header p').forEach(node=>{node.textContent='完了タスクの保管場所です。完了から90日で自動アーカイブされるほか、手動で整理したタスクもここに入ります。削除ではないため、通常アーカイブはいつでも復元できます。'});
  }
  function ensureDialogUxStyles(){
    if(document.getElementById('taskDialogUxV320Styles'))return;
    const style=document.createElement('style');style.id='taskDialogUxV320Styles';style.textContent=`
#taskDialog.task-dialog-tabs-enabled-v319{width:min(1120px,calc(100vw - 28px));max-width:1120px}
.task-dialog-detail-panel-v319>.detail-body.task-dialog-detail-active-v320{padding:18px 24px 28px;background:linear-gradient(180deg,#f8fbfd,#fff 180px)}
.task-dialog-detail-active-v320>.detail-actions{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin:8px 0 14px;padding:12px;border:1px solid #dfeaf1;border-radius:16px;background:#fff;box-shadow:0 8px 22px rgba(28,66,92,.05)}
.task-dialog-detail-active-v320>.detail-actions>.sub-actions{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px!important}
.task-dialog-detail-active-v320>.detail-actions button{min-height:42px}
.task-dialog-detail-active-v320>.task-detail-tabs-v149{position:sticky;top:0;z-index:4;margin:0 -24px 16px;padding:8px 24px;background:rgba(248,251,253,.96);backdrop-filter:blur(10px);border-top:1px solid #e4edf3;border-bottom:1px solid #dfe9f0}
.task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:14px 16px;align-items:start}
.task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]>.detail-section{margin:0;padding:16px;border:1px solid #dfeaf1;border-radius:16px;background:#fff;box-shadow:0 5px 16px rgba(28,66,92,.035)}
.task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]>.detail-section:has(>.checklist){grid-column:1}
.task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]>.task-metadata-section-v154{grid-column:2;grid-row:1/span 8;position:sticky;top:68px}
.task-dialog-detail-active-v320 .task-metadata-section-v154 .detail-grid{grid-template-columns:1fr 1fr}
.task-dialog-detail-active-v320 .checklist{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#taskDialog .task-dialog-detail-active-v320 .check-item{display:grid!important;grid-template-columns:22px minmax(0,1fr)!important;align-items:start!important;gap:9px!important;margin:0!important;padding:11px 12px!important;border-radius:12px!important;background:#f7fbff!important;color:#284a62!important;font-weight:750!important;line-height:1.45!important;cursor:pointer}
#taskDialog .task-dialog-detail-active-v320 .check-item input[type="checkbox"]{display:block!important;appearance:auto!important;width:18px!important;height:18px!important;min-width:18px!important;margin:2px 0 0!important;padding:0!important;accent-color:#3f9de0}
#taskDialog .task-dialog-detail-active-v320 .check-item>span{min-width:0!important;text-decoration:none}
#taskDialog .task-dialog-detail-active-v320 .check-item.done>span{text-decoration:line-through;color:#8294a2}
.task-dialog-detail-active-v320 .task-comments-panel-v149{display:flex!important;flex-direction:column;gap:12px}
.task-dialog-detail-active-v320 .task-comment-feed-v149{order:1;margin:0}
.task-dialog-detail-active-v320 .task-comment-feed-v149 .history-list{display:grid;gap:10px;max-height:none!important;overflow:visible!important}
.task-dialog-detail-active-v320 .task-comment-feed-v149 .history-item,.task-dialog-detail-active-v320 .task-comment-feed-v149 .comment{padding:12px 14px;border-radius:14px}
.task-dialog-detail-active-v320 .task-comment-compose-v149{order:2;position:sticky;bottom:-1px;z-index:5;margin:4px 0 0;padding:10px 12px;border:1px solid #d8e6ef;border-radius:15px;background:rgba(255,255,255,.97);box-shadow:0 -8px 24px rgba(28,66,92,.08)}
.task-dialog-detail-active-v320 .task-comment-compose-v149>div:first-child{display:none}
.task-comment-compose-toggle-v320{display:none;width:100%;min-height:42px;border:1px solid #cfe0eb;border-radius:12px;background:#f7fbfd;color:#24536f;font:inherit;font-weight:900;cursor:pointer}
.task-dialog-detail-active-v320 .task-comment-compose-toggle-v320{display:flex;align-items:center;justify-content:center;gap:7px}
.task-dialog-detail-active-v320 .task-comment-compose-v149 .comment-form{display:none!important;margin-top:10px}
.task-dialog-detail-active-v320 .task-comment-compose-v149.is-open-v320 .comment-form{display:grid!important;gap:8px}
.task-dialog-detail-active-v320 .task-comment-compose-v149.is-open-v320 textarea{min-height:88px!important;max-height:170px}
.task-dialog-detail-active-v320 .task-history-panel-v149 .history-list{max-height:none!important;overflow:visible!important}
@media(max-width:900px){
  .task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]{grid-template-columns:1fr}
  .task-dialog-detail-active-v320 .task-detail-panel-v149[data-tab-panel="details"]>.task-metadata-section-v154{grid-column:1;grid-row:auto;position:static}
  .task-dialog-detail-active-v320 .checklist{grid-template-columns:1fr}
  .task-dialog-detail-active-v320>.detail-actions>.sub-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;document.head.appendChild(style)
  }
  function enhanceDialogDetail(detail){
    ensureDialogUxStyles();detail.dataset.dialogUxVersion='320';
    detail.querySelectorAll('.task-comment-compose-v149').forEach(compose=>{
      if(compose.querySelector('.task-comment-compose-toggle-v320'))return;
      const button=document.createElement('button');button.type='button';button.className='task-comment-compose-toggle-v320';button.setAttribute('aria-expanded','false');button.textContent='＋ コメントを書く';
      button.addEventListener('click',()=>{const open=!compose.classList.contains('is-open-v320');compose.classList.toggle('is-open-v320',open);button.setAttribute('aria-expanded',open?'true':'false');button.textContent=open?'入力欄を閉じる':'＋ コメントを書く';if(open)setTimeout(()=>compose.querySelector('#commentText, textarea')?.focus(),0)});
      compose.prepend(button)
    })
  }

  // Ver.319: reuse the canonical right-side detail DOM inside the existing-task
  // editor instead of maintaining a second detail renderer. Closing the dialog
  // restores the same node to the right-side panel, so both entry points remain live.
  function installTaskDialogViewEditTabs(){
    if(dialogTabsInstalled)return;
    const dialog=document.getElementById('taskDialog'),form=document.getElementById('taskForm'),detail=document.getElementById('detailBody');
    const head=form?.querySelector?.(':scope > .dialog-head');if(!dialog||!form||!detail||!head)return;
    dialogTabsInstalled=true;detailHome=detail.parentNode;detailNextSibling=detail.nextSibling;
    const tabs=document.createElement('div');tabs.className='task-dialog-view-tabs-v319';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','タスクの表示切替');tabs.innerHTML='<button type="button" class="task-dialog-view-tab-v319" id="taskDialogDetailTabV319" data-task-dialog-tab-v319="detail" role="tab" aria-controls="taskDialogDetailPanelV319">詳細</button><button type="button" class="task-dialog-view-tab-v319" id="taskDialogEditTabV319" data-task-dialog-tab-v319="edit" role="tab" aria-controls="taskForm">編集</button>';
    const detailPanel=document.createElement('section');detailPanel.id='taskDialogDetailPanelV319';detailPanel.className='task-dialog-detail-panel-v319';detailPanel.setAttribute('role','tabpanel');detailPanel.setAttribute('aria-labelledby','taskDialogDetailTabV319');detailPanel.hidden=true;
    head.remove();dialog.prepend(head);head.insertAdjacentElement('afterend',tabs);tabs.insertAdjacentElement('afterend',detailPanel);form.classList.add('task-dialog-edit-panel-v319');form.setAttribute('role','tabpanel');form.setAttribute('aria-labelledby','taskDialogEditTabV319');dialog.classList.add('task-dialog-tabs-enabled-v319');dialog.dataset.viewEditTabsV319='true';
    const detailTab=tabs.querySelector('[data-task-dialog-tab-v319="detail"]'),editTab=tabs.querySelector('[data-task-dialog-tab-v319="edit"]');
    const matches=()=>{const id=String(document.getElementById('taskId')?.value||'');return Boolean(id&&detailId(detail)===id&&!detail.classList.contains('empty'))};
    const restore=()=>{detail.classList.remove('task-dialog-detail-active-v320');detail.querySelectorAll('.task-comment-compose-v149.is-open-v320').forEach(node=>node.classList.remove('is-open-v320'));detail.querySelectorAll('.task-comment-compose-toggle-v320').forEach(button=>{button.setAttribute('aria-expanded','false');button.textContent='＋ コメントを書く'});if(!detailHome||detail.parentNode===detailHome)return;if(detailNextSibling?.parentNode===detailHome)detailHome.insertBefore(detail,detailNextSibling);else detailHome.appendChild(detail)};
    const activateDialogTab=(name,focus=false)=>{const canDetail=matches(),showDetail=name==='detail'&&canDetail;detailTab.hidden=!canDetail;detailTab.classList.toggle('active',showDetail);detailTab.setAttribute('aria-selected',showDetail?'true':'false');detailTab.tabIndex=showDetail?0:-1;editTab.classList.toggle('active',!showDetail);editTab.setAttribute('aria-selected',showDetail?'false':'true');editTab.tabIndex=showDetail?-1:0;detailPanel.hidden=!showDetail;form.hidden=showDetail;if(showDetail){if(detail.parentNode!==detailPanel)detailPanel.appendChild(detail);detail.classList.add('task-dialog-detail-active-v320');enhanceDialogDetail(detail)}else detail.classList.remove('task-dialog-detail-active-v320');if(focus)(showDetail?detailTab:(document.getElementById('taskTitle')||editTab)).focus()};
    tabs.addEventListener('click',event=>{const button=event.target.closest?.('[data-task-dialog-tab-v319]');if(button)activateDialogTab(button.dataset.taskDialogTabV319,true)});
    tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const available=[...tabs.querySelectorAll('[data-task-dialog-tab-v319]:not([hidden])')],current=event.target.closest?.('[data-task-dialog-tab-v319]'),index=available.indexOf(current);if(index<0||!available.length)return;event.preventDefault();let next=index;if(event.key==='ArrowLeft')next=(index-1+available.length)%available.length;if(event.key==='ArrowRight')next=(index+1)%available.length;if(event.key==='Home')next=0;if(event.key==='End')next=available.length-1;activateDialogTab(available[next].dataset.taskDialogTabV319,true)});
    detailPanel.addEventListener('click',event=>{if(!event.target.closest?.('[data-action="edit"]'))return;event.preventDefault();event.stopImmediatePropagation();activateDialogTab('edit',true)},true);
    const syncDialog=()=>{if(!dialog.open){restore();return}const existing=matches();tabs.hidden=!existing;detailTab.hidden=!existing;activateDialogTab('edit')};
    dialog.addEventListener('close',()=>{restore();tabs.hidden=true;detailPanel.hidden=true;form.hidden=false});taskDialogObserver=new MutationObserver(syncDialog);taskDialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']});syncDialog();document.documentElement.dataset.userReportedStabilityVersion='319';
  }

  function patchDetail(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;const taskId=detailId(detail);if(!taskId)return;
    const tools=ensureToolsTab(detail,taskId);if(!tools)return;moveWorkflowSections(detail,tools);moveMetadataToBottom(detail);patchQuickPin(detail,taskId);if(detail.classList.contains('task-dialog-detail-active-v320'))enhanceDialogDetail(detail)
  }
  function patch(){installTaskDialogViewEditTabs();patchDetail();patchArchiveExplanation()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  function observe(root){if(!root)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length||x.type==='characterData'))schedule()}).observe(root,{childList:true,subtree:true,characterData:true})}
  ['workflow-v152-update','workflow-v150-update','workflow-v149-update'].forEach(name=>window.addEventListener(name,schedule));observe(document.getElementById('detailBody'));observe(document.getElementById('mainContent'));patch();document.documentElement.dataset.taskDialogUxVersion='320';
})();
