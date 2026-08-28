// Ver.153 personal notifications integrated into the Today announcement area.
(function installInboxV153(){
  const W=window.WorkBoardWorkflowV152;if(!W)return;
  let previous=null,scheduled=false,filter='unread',drawer=null,badge=null,pollTimer=0;
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const short=(v,n=90)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1)}…`:s};
  const cleanId=v=>String(v||'').replace(/[.#$/\[\]]/g,'-').slice(0,180);
  function users(){return W.users?.()||[]}
  function mentions(text){const s=String(text||'');return users().filter(name=>name&&s.includes(`@${name}`))}
  function eventId(...parts){return cleanId(parts.filter(Boolean).join('_'))}
  function openTask(id){const target=String(id||'');if(!target)return;closeDrawer();let node=document.querySelector(`[data-task-id="${CSS.escape(target)}"]`);if(node){node.click();return}document.querySelector('.nav-item[data-layout="tasks"]')?.click();document.querySelector('[data-task-layout="list"]')?.click();document.getElementById('resetFilters')?.click();const task=W.taskMap().get(target),q=document.getElementById('searchInput');if(task&&q){q.value=task.title||'';q.dispatchEvent(new Event('input',{bubbles:true}))}setTimeout(()=>document.querySelector(`[data-task-id="${CSS.escape(target)}"]`)?.click(),140)}
  async function deliver(recipient,id,event){if(!recipient||recipient===event.actor)return;await W.writeInboxEvent(recipient,id,event)}
  async function processSnapshot(raw){
    const current=raw&&typeof raw==='object'?raw:{};
    if(previous===null){previous=current;return}
    const jobs=[];
    for(const [id,next] of Object.entries(current)){
      if(!next||typeof next!=='object')continue;
      const before=previous[id]||null,actor=String(next.updatedBy||next.createdBy||'');
      if(!before){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('assign',id,next.revision||next.createdAt),{taskId:id,type:'assign',title:'担当になりました',body:next.title||'',actor,createdAt:Number(next.updatedAt||next.createdAt||Date.now())}));
        continue;
      }
      if(String(before.assignee||'')!==String(next.assignee||'')){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('assign',id,next.revision),{taskId:id,type:'assign',title:'担当になりました',body:next.title||'',actor,createdAt:Number(next.updatedAt||Date.now())}));
      }
      if(String(before.status||'')!==String(next.status||'')){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('status',id,next.revision),{taskId:id,type:'status',title:'状態が変更されました',body:`${before.status||'--'} → ${next.status||'--'}｜${next.title||''}`,actor,createdAt:Number(next.updatedAt||Date.now())}));
      }
      const oldIds=new Set((Array.isArray(before.comments)?before.comments:[]).map(c=>String(c?.id||'')));
      for(const comment of (Array.isArray(next.comments)?next.comments:[])){
        const cid=String(comment?.id||'');if(!cid||oldIds.has(cid))continue;
        const author=String(comment.author||actor||''),mentioned=mentions(comment.text),recipients=new Set(mentioned),assignee=String(next.assignee||'');
        if(assignee)recipients.add(assignee);
        for(const recipient of recipients){
          if(!recipient||recipient===author)continue;
          const isMention=mentioned.includes(recipient);
          jobs.push(deliver(recipient,eventId(isMention?'mention':'comment',id,cid,recipient),{taskId:id,type:isMention?'mention':'comment',title:isMention?'@メンションされました':'コメントが追加されました',body:`${author||'ユーザー'}：${short(comment.text,100)}`,actor:author,createdAt:Number(comment.createdAt||next.updatedAt||Date.now())}));
        }
      }
    }
    previous=current;
    if(jobs.length)await Promise.allSettled(jobs);
  }
  async function bindRemote(){
    const r=await W.ensureRemote?.();
    if(r){const ref=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks`);r.onValue(ref,s=>processSnapshot(s.val()||{}),e=>console.warn('Ver.153 inbox watcher failed',e));return}
    let prevSig='';pollTimer=setInterval(()=>{const map=Object.fromEntries([...W.taskMap().entries()]),sig=JSON.stringify([...W.taskMap().values()].map(t=>[t.id,t.revision]));if(sig!==prevSig){prevSig=sig;processSnapshot(map)}},1500);
  }
  function removeLegacyNav(){document.querySelectorAll('.workflow-inbox-nav-v152').forEach(node=>node.remove())}
  function ensureDrawer(){
    if(drawer?.isConnected)return;
    drawer=document.createElement('div');drawer.className='workflow-inbox-shell-v152 workflow-inbox-shell-v153';drawer.hidden=true;
    drawer.innerHTML=`<div class="workflow-drawer-backdrop-v152" data-close-inbox-v153></div><aside class="workflow-drawer-v152" role="dialog" aria-modal="true" aria-label="自分への通知"><header><div><small>PERSONAL INBOX</small><h3>自分への通知</h3></div><button type="button" class="icon-button" data-close-inbox-v153 aria-label="閉じる">×</button></header><p class="workflow-inbox-help-v153">あなた宛ての担当変更、コメント、@メンション、状態変更だけを表示します。共有ルーム全体の更新履歴は、今日ビューの「全体のお知らせ」で確認できます。</p><div class="workflow-inbox-tabs-v152"><button type="button" data-inbox-filter-v153="unread" class="active">未読</button><button type="button" data-inbox-filter-v153="all">すべて</button><button type="button" class="workflow-mark-all-v152" data-mark-all-v153>すべて既読</button></div><div class="workflow-inbox-list-v152" data-inbox-list-v153></div></aside>`;
    document.body.appendChild(drawer);
    drawer.querySelectorAll('[data-close-inbox-v153]').forEach(x=>x.addEventListener('click',closeDrawer));
    drawer.querySelectorAll('[data-inbox-filter-v153]').forEach(x=>x.addEventListener('click',()=>{filter=x.dataset.inboxFilterV153;renderDrawer()}));
    drawer.querySelector('[data-mark-all-v153]')?.addEventListener('click',async()=>{await W.markAllInboxRead();renderAll()});
  }
  function openDrawer(){ensureDrawer();drawer.hidden=false;document.body.classList.add('workflow-drawer-open-v152');renderDrawer()}
  function closeDrawer(){if(drawer)drawer.hidden=true;document.body.classList.remove('workflow-drawer-open-v152')}
  function formatAge(ms){const d=Date.now()-Number(ms||0);if(d<60000)return'たった今';if(d<3600000)return`${Math.floor(d/60000)}分前`;if(d<86400000)return`${Math.floor(d/3600000)}時間前`;return`${Math.floor(d/86400000)}日前`}
  function renderDrawer(){
    ensureDrawer();
    const list=drawer.querySelector('[data-inbox-list-v153]'),items=Object.entries(W.inboxFor?.()||{}).map(([id,item])=>({id,...item})).sort((a,b)=>(a.readAt?1:0)-(b.readAt?1:0)||Number(b.createdAt)-Number(a.createdAt)),shown=filter==='unread'?items.filter(x=>!x.readAt):items;
    drawer.querySelectorAll('[data-inbox-filter-v153]').forEach(x=>x.classList.toggle('active',x.dataset.inboxFilterV153===filter));
    if(!shown.length){list.innerHTML=`<div class="workflow-inbox-empty-v152"><strong>${filter==='unread'?'未読の通知はありません':'通知はありません'}</strong><span>自分宛ての担当変更、コメント、@メンションなどがここに届きます。</span></div>`;return}
    list.innerHTML=shown.slice(0,120).map(item=>`<article class="workflow-inbox-item-v152 ${item.readAt?'is-read':'is-unread'}"><button type="button" class="workflow-inbox-open-v152" data-inbox-open-v153="${esc(item.id)}"><span class="workflow-inbox-type-v152">${item.type==='mention'?'@':item.type==='comment'?'💬':item.type==='assign'?'👤':'↻'}</span><span><strong>${esc(item.title)}</strong><em>${esc(item.body)}</em><small>${esc(item.actor||'')} ${formatAge(item.createdAt)}</small></span></button><button type="button" class="workflow-inbox-read-v152" data-inbox-read-v153="${esc(item.id)}">${item.readAt?'未読に戻す':'既読'}</button></article>`).join('');
    list.querySelectorAll('[data-inbox-open-v153]').forEach(b=>b.addEventListener('click',async()=>{await W.markInboxRead(b.dataset.inboxOpenV153,true);const item=(W.inboxFor?.()||{})[b.dataset.inboxOpenV153];if(item)openTask(item.taskId)}));
    list.querySelectorAll('[data-inbox-read-v153]').forEach(b=>b.addEventListener('click',async()=>{const item=(W.inboxFor?.()||{})[b.dataset.inboxReadV153];await W.markInboxRead(b.dataset.inboxReadV153,!item?.readAt);renderAll()}));
  }
  function patchTodayActivity(){
    const panel=document.querySelector('#todayView .activity-panel');if(!panel)return;
    const title=panel.querySelector('.activity-title-text');if(title&&title.textContent!=='全体のお知らせ')title.textContent='全体のお知らせ';
    const description=panel.querySelector('.activity-head>div:first-child>p');
    if(description&&description.dataset.workflowV153!=='1'){description.textContent='共有ルーム全体の新規追加・重要更新です。自分宛ての連絡は「自分への通知」で確認できます。';description.dataset.workflowV153='1'}
    const actions=panel.querySelector('.activity-actions');if(!actions)return;
    let entry=actions.querySelector('[data-open-personal-inbox-v153]');
    if(!entry){entry=document.createElement('button');entry.type='button';entry.className='ghost-button workflow-inbox-entry-v153';entry.dataset.openPersonalInboxV153='';entry.innerHTML='<span class="workflow-inbox-entry-icon-v153" aria-hidden="true">✉</span><span>自分への通知</span><strong class="workflow-inbox-entry-badge-v153" hidden>0</strong>';entry.title='担当変更・コメント・@メンションなど、自分宛ての通知を開く';entry.addEventListener('click',openDrawer);actions.prepend(entry)}
    badge=entry.querySelector('.workflow-inbox-entry-badge-v153');
  }
  function patchMentions(){
    const form=document.querySelector('#detailBody .task-comments-panel-v149 .comment-form, #detailBody #commentForm');if(!form||form.querySelector('.workflow-mention-helper-v153,.workflow-mention-helper-v152'))return;
    const textarea=form.querySelector('textarea');if(!textarea)return;
    const others=users().filter(x=>x&&x!==W.currentUser?.());if(!others.length)return;
    const helper=document.createElement('div');helper.className='workflow-mention-helper-v152 workflow-mention-helper-v153';helper.innerHTML=`<span>メンション</span>${others.map(name=>`<button type="button" data-mention-v153="${esc(name)}">@${esc(name)}</button>`).join('')}`;textarea.insertAdjacentElement('beforebegin',helper);
    helper.querySelectorAll('[data-mention-v153]').forEach(b=>b.addEventListener('click',()=>{const token=`@${b.dataset.mentionV153} `,start=textarea.selectionStart??textarea.value.length,end=textarea.selectionEnd??start;textarea.value=textarea.value.slice(0,start)+token+textarea.value.slice(end);textarea.focus();textarea.setSelectionRange(start+token.length,start+token.length)}));
  }
  function renderAll(){
    removeLegacyNav();ensureDrawer();patchTodayActivity();patchMentions();
    const n=W.unreadCount?.()||0;
    const entry=document.querySelector('[data-open-personal-inbox-v153]');badge=entry?.querySelector('.workflow-inbox-entry-badge-v153')||badge;
    if(badge){badge.textContent=String(n);badge.hidden=n===0}
    entry?.classList.toggle('has-unread',n>0);
    if(drawer&&!drawer.hidden)renderDrawer();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderAll()})}
  window.addEventListener('workflow-v152-update',schedule);
  const todayRoot=document.getElementById('todayView'),detailRoot=document.getElementById('detailBody');
  [todayRoot,detailRoot].filter(Boolean).forEach(root=>new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule()}).observe(root,{childList:true,subtree:true}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer&&!drawer.hidden)closeDrawer()});
  renderAll();bindRemote();
})();
