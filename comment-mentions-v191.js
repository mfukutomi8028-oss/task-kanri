// Ver.156: compact searchable multi-select mention picker + comment selection focus guard.
(function installCommentMentionPickerV156(){
  const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150;
  if(!W)return;

  let shell=null;
  let targetTextarea=null;
  let insertRange={start:0,end:0};
  let selected=new Set();
  let scheduled=false;
  const nativeFocus=HTMLElement.prototype.focus;

  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
  const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');

  function users(){
    const values=W.users?.()||[];
    const current=String(W.currentUser?.()||'');
    return [...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))]
      .filter(name=>name!==current);
  }

  function protectTextarea(textarea){
    if(!textarea||textarea.dataset.commentFocusGuardV156==='true')return;
    textarea.dataset.commentFocusGuardV156='true';
    textarea.focus=function(options){
      if(this.dataset.allowProgrammaticFocusV156==='true'){
        nativeFocus.call(this,options);
      }
    };
  }

  function allowTextareaFocus(textarea,callback){
    if(!textarea)return;
    textarea.dataset.allowProgrammaticFocusV156='true';
    try{
      nativeFocus.call(textarea,{preventScroll:true});
      callback?.();
    }finally{
      delete textarea.dataset.allowProgrammaticFocusV156;
    }
  }

  function ensureShell(){
    if(shell?.isConnected)return shell;
    shell=document.createElement('div');
    shell.className='workflow-mention-shell-v156';
    shell.hidden=true;
    shell.innerHTML=`
      <div class="workflow-mention-backdrop-v156" data-close-mention-v156></div>
      <section class="workflow-mention-dialog-v156" role="dialog" aria-modal="true" aria-labelledby="workflowMentionTitleV156">
        <header>
          <div>
            <small>MENTION</small>
            <h3 id="workflowMentionTitleV156">メンションするユーザー</h3>
            <p>複数選択できます。選択したユーザーをコメント入力欄へまとめて追加します。</p>
          </div>
          <button type="button" class="icon-button" data-close-mention-v156 aria-label="閉じる">×</button>
        </header>
        <div class="workflow-mention-search-v156">
          <label for="workflowMentionSearchV156">ユーザーを検索</label>
          <input id="workflowMentionSearchV156" type="search" autocomplete="off" placeholder="名前で検索" />
        </div>
        <div class="workflow-mention-summary-v156">
          <span data-mention-result-count-v156></span>
          <strong data-mention-selected-count-v156>0人選択</strong>
        </div>
        <div class="workflow-mention-users-v156" data-mention-users-v156></div>
        <footer>
          <button type="button" class="ghost-button" data-close-mention-v156>キャンセル</button>
          <button type="button" class="primary-button" data-apply-mentions-v156 disabled>選択したユーザーを追加</button>
        </footer>
      </section>`;
    document.body.appendChild(shell);

    shell.querySelectorAll('[data-close-mention-v156]').forEach(button=>button.addEventListener('click',closePicker));
    shell.querySelector('[data-apply-mentions-v156]')?.addEventListener('click',applyMentions);
    shell.querySelector('#workflowMentionSearchV156')?.addEventListener('input',renderUsers);
    shell.querySelector('[data-mention-users-v156]')?.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-mention-user-v156]');
      if(!button)return;
      const name=button.dataset.mentionUserV156||'';
      if(!name)return;
      if(selected.has(name))selected.delete(name);else selected.add(name);
      renderUsers();
    });
    return shell;
  }

  function renderUsers(){
    ensureShell();
    const search=shell.querySelector('#workflowMentionSearchV156');
    const query=normalize(search?.value||'');
    const all=users();
    const visible=all.filter(name=>!query||normalize(name).includes(query));
    const list=shell.querySelector('[data-mention-users-v156]');
    const resultCount=shell.querySelector('[data-mention-result-count-v156]');
    const selectedCount=shell.querySelector('[data-mention-selected-count-v156]');
    const apply=shell.querySelector('[data-apply-mentions-v156]');

    if(resultCount)resultCount.textContent=query?`${visible.length} / ${all.length}人`:`${all.length}人`;
    if(selectedCount)selectedCount.textContent=`${selected.size}人選択`;
    if(apply)apply.disabled=selected.size===0;

    if(!all.length){
      list.innerHTML='<div class="workflow-mention-empty-v156"><strong>メンションできるユーザーがいません</strong><span>自分以外のユーザーが登録されると、ここから選択できます。</span></div>';
      return;
    }
    if(!visible.length){
      list.innerHTML='<div class="workflow-mention-empty-v156"><strong>該当するユーザーがいません</strong><span>検索条件を変えてください。</span></div>';
      return;
    }

    list.innerHTML=visible.map(name=>{
      const checked=selected.has(name);
      return `<button type="button" class="workflow-mention-user-v156 ${checked?'is-selected':''}" data-mention-user-v156="${esc(name)}" role="checkbox" aria-checked="${checked?'true':'false'}">
        <span class="workflow-mention-check-v156">${checked?'✓':''}</span>
        <span class="workflow-mention-name-v156">@${esc(name)}</span>
      </button>`;
    }).join('');
  }

  function openPicker(textarea){
    if(!textarea)return;
    protectTextarea(textarea);
    targetTextarea=textarea;
    insertRange={
      start:Number.isFinite(textarea.selectionStart)?textarea.selectionStart:textarea.value.length,
      end:Number.isFinite(textarea.selectionEnd)?textarea.selectionEnd:textarea.value.length
    };
    selected=new Set();
    ensureShell();
    const search=shell.querySelector('#workflowMentionSearchV156');
    if(search)search.value='';
    renderUsers();
    shell.hidden=false;
    document.body.classList.add('workflow-mention-open-v156');
    requestAnimationFrame(()=>search?.focus());
  }

  function closePicker(){
    if(!shell)return;
    shell.hidden=true;
    document.body.classList.remove('workflow-mention-open-v156');
    targetTextarea=null;
    selected.clear();
  }

  function applyMentions(){
    const textarea=targetTextarea;
    if(!textarea||!selected.size)return;
    const names=[...selected];
    const token=names.map(name=>`@${name}`).join(' ')+' ';
    const start=Math.max(0,Math.min(insertRange.start,textarea.value.length));
    const end=Math.max(start,Math.min(insertRange.end,textarea.value.length));
    textarea.value=textarea.value.slice(0,start)+token+textarea.value.slice(end);
    const caret=start+token.length;
    closePicker();
    allowTextareaFocus(textarea,()=>textarea.setSelectionRange(caret,caret));
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function patchMentionHelper(){
    const form=document.querySelector('#detailBody .task-comments-panel-v149 .comment-form, #detailBody #commentForm');
    if(!form)return;
    const textarea=form.querySelector('textarea');
    if(!textarea)return;
    protectTextarea(textarea);

    let helper=form.querySelector('.workflow-mention-helper-v153,.workflow-mention-helper-v152,.workflow-mention-helper-v156');
    if(!helper){
      helper=document.createElement('div');
      helper.className='workflow-mention-helper-v152 workflow-mention-helper-v153 workflow-mention-helper-v156';
      textarea.insertAdjacentElement('beforebegin',helper);
    }
    if(helper.dataset.mentionPickerV156==='true')return;

    helper.dataset.mentionPickerV156='true';
    helper.classList.add('workflow-mention-helper-v156');
    helper.innerHTML=`
      <button type="button" class="workflow-mention-open-button-v156" data-open-mention-picker-v156>
        <span aria-hidden="true">@</span>
        <strong>メンション</strong>
        <em>ユーザーを選択</em>
      </button>`;
    helper.querySelector('[data-open-mention-picker-v156]')?.addEventListener('click',()=>openPicker(textarea));
  }

  function patch(){
    patchMentionHelper();
    document.querySelectorAll('#detailBody textarea#commentText').forEach(protectTextarea);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;patch()});
  }

  const detail=document.getElementById('detailBody');
  if(detail)new MutationObserver(mutations=>{
    if(mutations.some(mutation=>mutation.addedNodes.length||mutation.removedNodes.length))schedule();
  }).observe(detail,{childList:true,subtree:true});

  window.addEventListener('workflow-v152-update',schedule);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&shell&&!shell.hidden)closePicker();
  });

  patch();
})();