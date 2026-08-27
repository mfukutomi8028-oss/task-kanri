// Ver.149 task-detail tabs: details / comments / history.
(function installTaskDetailTabsV149(){
  const activeTabs=new Map();let scheduled=false;
  function detailTaskId(detail){const key=detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey||'';return key.startsWith('task-delete:')?key.slice(12):''}
  function countFromLabel(root,selector){const text=root?.querySelector(selector)?.textContent||'';const m=text.match(/(\d+)/);return m?Number(m[1]):0}
  function activate(detail,taskId,name,focus=false){
    const tabs=[...detail.querySelectorAll('.task-detail-tab-v149')],panels=[...detail.querySelectorAll('.task-detail-panel-v149')];
    tabs.forEach(tab=>{const on=tab.dataset.tab===name;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',on?'true':'false');tab.tabIndex=on?0:-1});
    panels.forEach(panel=>{panel.hidden=panel.dataset.tabPanel!==name});activeTabs.set(taskId,name);
    if(focus)detail.querySelector(`.task-detail-tab-v149[data-tab="${CSS.escape(name)}"]`)?.focus();
    if(name==='comments')setTimeout(()=>detail.querySelector('#commentText')?.focus(),60);
  }
  function patch(){
    const detail=document.getElementById('detailBody');if(!detail||detail.classList.contains('empty'))return;const taskId=detailTaskId(detail),activity=detail.querySelector(':scope > .activity-section');if(!taskId||!activity||detail.querySelector(':scope > .task-detail-tabs-v149'))return;
    const commentCount=countFromLabel(activity,'label[for^="activityComments-"] span'),historyCount=countFromLabel(activity,'label[for^="activityHistory-"] span');
    const actions=detail.querySelector(':scope > .detail-actions');if(!actions)return;
    const tabBar=document.createElement('div');tabBar.className='task-detail-tabs-v149';tabBar.setAttribute('role','tablist');tabBar.setAttribute('aria-label','タスク詳細の表示切替');
    tabBar.innerHTML=`<button type="button" role="tab" class="task-detail-tab-v149" data-tab="details">詳細</button><button type="button" role="tab" class="task-detail-tab-v149" data-tab="comments">コメント <span>${commentCount}</span></button><button type="button" role="tab" class="task-detail-tab-v149" data-tab="history">履歴 <span>${historyCount}</span></button>`;
    const detailPanel=document.createElement('div');detailPanel.className='task-detail-panel-v149';detailPanel.dataset.tabPanel='details';detailPanel.setAttribute('role','tabpanel');
    const commentsPanel=document.createElement('div');commentsPanel.className='task-detail-panel-v149 task-comments-panel-v149';commentsPanel.dataset.tabPanel='comments';commentsPanel.setAttribute('role','tabpanel');
    const historyPanel=document.createElement('div');historyPanel.className='task-detail-panel-v149 task-history-panel-v149';historyPanel.dataset.tabPanel='history';historyPanel.setAttribute('role','tabpanel');
    [...detail.children].filter(el=>el.classList?.contains('detail-section')&&!el.classList.contains('activity-section')).forEach(section=>detailPanel.appendChild(section));
    const form=activity.querySelector('.comment-form'),comments=activity.querySelector('.activity-comments-panel .history-list'),history=activity.querySelector('.activity-history-panel .history-list');
    const compose=document.createElement('div');compose.className='task-comment-compose-v149';compose.innerHTML='<div><strong>コメントを追加</strong><span>対応状況・業者回答・申し送りをすぐ記録できます。</span></div>';
    if(form){compose.appendChild(form);commentsPanel.appendChild(compose)}
    const commentFeed=document.createElement('section');commentFeed.className='task-comment-feed-v149';commentFeed.innerHTML=`<div class="task-tab-section-head-v149"><strong>コメント</strong><span>${commentCount}件</span></div>`;if(comments)commentFeed.appendChild(comments);commentsPanel.appendChild(commentFeed);
    const historyFeed=document.createElement('section');historyFeed.className='task-history-feed-v149';historyFeed.innerHTML=`<div class="task-tab-section-head-v149"><strong>対応履歴</strong><span>${historyCount}件</span></div>`;if(history)historyFeed.appendChild(history);historyPanel.appendChild(historyFeed);
    activity.remove();actions.insertAdjacentElement('afterend',tabBar);tabBar.insertAdjacentElement('afterend',detailPanel);detailPanel.insertAdjacentElement('afterend',commentsPanel);commentsPanel.insertAdjacentElement('afterend',historyPanel);
    tabBar.querySelectorAll('.task-detail-tab-v149').forEach((tab,index,tabs)=>{tab.addEventListener('click',()=>activate(detail,taskId,tab.dataset.tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let next=index;if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;activate(detail,taskId,tabs[next].dataset.tab,true)})});
    activate(detail,taskId,activeTabs.get(taskId)||'details');
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  function start(){const root=document.getElementById('detailBody');if(root)new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule()}).observe(root,{childList:true,subtree:true});patch()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
