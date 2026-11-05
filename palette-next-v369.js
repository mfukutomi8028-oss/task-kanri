/* Palette NEXT v369 — new UI tree, not a Classic DOM skin.
   All live records and mutations go through WorkBoardPaletteBridge. */
(function installPaletteNextV369() {
  'use strict';
  if (document.getElementById('paletteNextRoot')) return;
  const bridge = window.WorkBoardPaletteBridge;
  if (!bridge || typeof bridge.readSnapshot !== 'function') {
    console.error('Palette NEXT cannot start: canonical adapter is unavailable');
    return;
  }
  const modeController = window.WorkBoardDisplayController;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nav = [
    ['today','今日','◎'],['tasks','タスク','▤'],['todos','ToDo','✓'],
    ['schedule','予定','▦'],['memos','メモ','▤']
  ];
  const state = {
    route:'today', query:'', taskFilter:'all', detail:null,
    selectedDay:new Date().toLocaleDateString('sv-SE'), busy:false,
    snapshot:bridge.readSnapshot(),
    theme:null
  };
  const root = document.createElement('div');
  root.id = 'paletteNextRoot';
  const modeOptions = [
    ['preview','Palette NEXT'],['palette','Palette'],['classic','Classic'],['modern','Modern'],['journal','Journal']
  ];
  const tab = (route,label,glyph,mobile) => '<button type="button" data-pn-route="'+route+
    '" aria-label="'+label+'" title="'+label+'" aria-current="false">'+
    '<span class="pn-symbol" aria-hidden="true">'+glyph+'</span>'+
    (mobile ? label : '<small>'+label+'</small>')+'</button>';
  root.innerHTML =
    '<div class="wb-pn" id="pnApp">'+
    '<aside class="pn-rail" aria-label="Palette NEXT画面メニュー">'+
    '<div class="pn-brand" aria-hidden="true">p.</div>'+
    '<nav class="pn-rail-nav">'+nav.map(([id,label,glyph])=>tab(id,label,glyph,false)).join('')+'</nav>'+
    '<div class="pn-rail-footer">YOUR WORK, YOUR WAY</div></aside>'+
    '<div class="pn-shell"><header class="pn-topbar">'+
    '<div class="pn-top-brand"><span class="pn-top-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'+
    '<div><div class="pn-title">palette. <span class="pn-preview-label">開発版</span></div><div class="pn-subtitle">WORK BOARD · NEXT</div></div></div>'+
    '<div class="pn-top-actions"><label class="pn-search" aria-label="Palette内を検索">'+
    '<span aria-hidden="true">⌕</span><input id="pnSearch" type="search" placeholder="仕事を探す" autocomplete="off"></label>'+
    '<button class="pn-iconbutton" type="button" data-pn-theme aria-label="ライト・ダークを切り替え" title="ライト・ダーク">◐</button>'+
    '<select class="pn-mode" id="pnMode" aria-label="画面デザインを選択">'+
    modeOptions.map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select>'+
    '<button class="pn-button primary" data-pn-create type="button">＋ ToDo</button>'+
    '<button class="pn-preview-back" data-pn-exit type="button" title="元の画面に戻る">← 戻る</button></div></header>'+
    '<main class="pn-workspace" id="pnWorkspace"></main>'+
    '<nav class="pn-mobile-nav" aria-label="Palette NEXTスマホ画面メニュー">'+
    nav.map(([id,label,glyph])=>tab(id,label,glyph,true)).join('')+'</nav></div>'+
    '<button type="button" class="pn-detail-backdrop" data-pn-close hidden aria-label="詳細を閉じる"></button>'+
    '<aside class="pn-detail" id="pnDetail" role="dialog" aria-modal="true" aria-label="詳細" hidden></aside>'+
    '<div class="pn-toast" id="pnToast" role="status" hidden></div></div>';
  document.body.appendChild(root);
  const shell = root.querySelector('#pnApp');
  const workspace = root.querySelector('#pnWorkspace');
  const drawer = root.querySelector('#pnDetail');
  const overlay = root.querySelector('.pn-detail-backdrop');
  let toastTimer = null;
  let lastFocused = null;

  function setTheme() {
    if (state.theme == null) {
      state.theme = document.documentElement.dataset.wbColorMode === 'dark' ? 'dark':'light';
    }
    shell.dataset.theme=state.theme;
  }
  function active() {
    return document.documentElement.dataset.wbPaletteNextPreview === 'true';
  }
  function exitPreview() {
    const url = new URL(location.href);
    url.searchParams.delete('paletteNext');
    history.replaceState(history.state, '', url);
    document.documentElement.removeAttribute('data-wb-palette-next-preview');
    closeDetail();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function syncMode() {
    root.querySelector('#pnMode').value = active() ? 'preview' :
      (modeController?.getMode?.() || document.documentElement.dataset.wbDisplay || 'classic');
    setTheme();
    if (active()) render();
    else closeDetail();
  }
  function notify(text) {
    const el=root.querySelector('#pnToast');
    el.textContent=String(text||'操作を完了できませんでした。');
    el.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.hidden=true,3200);
  }
  function dateParts(dateText) {
    if (!dateText) return '';
    const date=new Date(String(dateText).length===10?dateText+'T00:00:00':dateText);
    if (Number.isNaN(date.getTime())) return '';
    return (date.getMonth()+1)+'/'+date.getDate();
  }
  function localDate(iso) {
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')].join('-');
  }
  function localTime(iso) {
    const d=new Date(iso);
    return Number.isNaN(d.getTime())?'':String(d.getHours()).padStart(2,'0')+':'+
      String(d.getMinutes()).padStart(2,'0');
  }
  function currentDate() {
    const now=new Date();return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+
      '-'+String(now.getDate()).padStart(2,'0');
  }
  function taskRisk(task) {
    if (task.completed) return '完了';
    const now=currentDate();
    if(task.dueDate&&task.dueDate<now)return '期限超過';
    if(task.dueDate===now)return '今日まで';
    return task.priority==='高'?'優先':'';
  }
  function filteredTasks() {
    const user=state.snapshot.currentUser;
    return state.snapshot.tasks.filter(t=> {
      if(!match([t.title,t.description,t.assignee,t.category].join(' ')))return false;
      if(state.taskFilter==='mine'&&t.assignee!==user)return false;
      if(state.taskFilter==='urgent'&&!['期限超過','今日まで'].includes(taskRisk(t)))return false;
      if(state.taskFilter==='done'&&!t.completed)return false;
      return state.taskFilter==='done'||!t.completed;
    });
  }
  function match(text) {
    return String(text||'').normalize('NFKC').toLocaleLowerCase('ja')
      .includes(state.query.normalize('NFKC').toLocaleLowerCase('ja'));
  }
  function noticeList(items,max=3) {
    const data=items.filter(x=>match(x.title+' '+x.action)).slice(0,max);
    return data.length?data.map(item=>
      '<div class="pn-notice"><strong>'+escape(item.title||item.action||'お知らせ')+'</strong>'+
      '<small>'+escape(item.action||'更新')+' · '+dateParts(item.at)+'</small></div>').join('')
      :'<div class="pn-empty">新しいお知らせはありません</div>';
  }
  function todoRow(todo,actions=true) {
    const done=Boolean(todo.completed);
    return '<li><button class="pn-check" type="button" aria-pressed="'+done+
      '" data-pn-cmd="todo.toggle" data-id="'+escape(todo.id)+'" aria-label="'+
      escape(todo.text)+'を'+(done?'未完了に戻す':'完了にする')+'">'+(done?'✓':'')+'</button>'+
      '<span class="pn-todotext'+(done?' done':'')+'">'+escape(todo.text)+'</span>'+
      (actions?'<div class="pn-actions">'+
        '<button type="button" class="pn-smallbtn" data-pn-detail="todo" data-id="'+escape(todo.id)+'" aria-label="詳細を表示">詳細</button>'+
        '<button type="button" class="pn-smallbtn" data-pn-cmd="todo.move" data-direction="up" data-segment="'+(done?'completed':'open')+'" data-id="'+escape(todo.id)+'" aria-label="上へ">↑</button>'+
        '<button type="button" class="pn-smallbtn" data-pn-cmd="todo.move" data-direction="down" data-segment="'+(done?'completed':'open')+'" data-id="'+escape(todo.id)+'" aria-label="下へ">↓</button></div>':'')+'</li>';
  }
  function taskRow(task,index) {
    const risk=taskRisk(task);
    return '<div class="pn-focusrow">'+
      '<span class="pn-focusnum">'+String(index+1).padStart(2,'0')+'</span>'+
      '<button type="button" class="pn-flowtitle" data-pn-detail="task" data-id="'+escape(task.id)+'" style="min-width:0;text-align:left;border:0;background:none;color:inherit;cursor:pointer">'+
      '<strong>'+escape(task.title)+'</strong><small>'+escape(task.category||'未分類')+' · '+
      escape(task.assignee||'担当未設定')+(task.dueDate?' · 期限 '+escape(dateParts(task.dueDate)):'')+'</small></button>'+
      '<span class="pn-rightmark">'+(risk==='期限超過'?'!':'›')+'</span></div>';
  }
  function todayPage() {
    const all=state.snapshot.tasks;
    const focus=state.snapshot.focusTaskIds.map(id=>all.find(task=>task.id===id)).filter(Boolean);
    const todos=state.snapshot.todos.filter(t=>!t.completed).slice(0,5);
    const schedules=state.snapshot.schedules
      .filter(item=>localDate(item.startAt)===state.snapshot.today)
      .sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt))).slice(0,5);
    const overdue=all.filter(t=>taskRisk(t)==='期限超過').length;
    return '<section class="pn-hero"><div><span class="pn-kicker">FOCUS TODAY</span>'+
      '<h1>今日の仕事を、気持ちよく。</h1>'+
      '<p>'+escape(state.snapshot.currentUser||'利用者')+'さんの業務をまとめました。</p>'+
      '<div class="pn-chiprow"><span class="pn-chip">'+focus.length+'件に集中</span>'+
      '<span class="pn-chip">'+todos.length+'件のToDo</span>'+
      (overdue?'<span class="pn-chip warn">期限超過 '+overdue+'件</span>':'')+
      '</div></div><div class="pn-hero-art" aria-hidden="true">✳</div></section>'+
      '<div class="pn-maincols"><div class="pn-stack">'+
      '<section class="pn-sheet"><header class="pn-sheethead"><div><h2>優先する3件</h2><p>期限・状態をもとに整理</p></div>'+
      '<button class="pn-button flat" type="button" data-pn-route="tasks">すべて見る</button></header>'+
      '<div class="pn-sheetbody">'+(focus.length?focus.map(taskRow).join(''):'<div class="pn-empty">優先タスクはありません</div>')+'</div></section>'+
      '<section class="pn-sheet"><header class="pn-sheethead"><div><h2>チェックリスト</h2><p>自分のToDo</p></div>'+
      '<button class="pn-button flat" type="button" data-pn-route="todos">一覧へ</button></header>'+
      '<div class="pn-sheetbody"><ul class="pn-todolist">'+
      (todos.length?todos.map(t=>todoRow(t,false)).join(''):'<li class="pn-empty">未完了のToDoはありません</li>')+
      '</ul></div></section></div><div class="pn-stack">'+
      '<section class="pn-sheet"><header class="pn-sheethead"><h2>今日の予定</h2></header>'+
      '<div class="pn-sheetbody">'+(schedules.length?schedules.map(s=>scheduleRow(s)).join(''):
      '<div class="pn-empty">今日の予定はありません</div>')+'</div></section>'+
      '<section class="pn-sheet"><header class="pn-sheethead"><h2>お知らせ</h2></header>'+
      '<div class="pn-sheetbody">'+noticeList(state.snapshot.notices,4)+'</div></section></div></div>';
  }
  function pageHead(kicker,title,description) {
    return '<header class="pn-pagehead"><div><span class="pn-kicker">'+escape(kicker)+'</span>'+
      '<h1>'+escape(title)+'</h1><p>'+escape(description)+'</p></div></header>';
  }
  function todoPage() {
    const todos=state.snapshot.todos.filter(todo=>match(todo.text+' '+todo.memo));
    const open=todos.filter(todo=>!todo.completed),done=todos.filter(todo=>todo.completed);
    const percent=todos.length?Math.round(done.length/todos.length*100):0;
    return pageHead('MY CHECKLIST','ToDoを片づける','小さなやることを、気持ちよく。')+
      '<section class="pn-sheet" style="margin-bottom:14px"><div class="pn-sheetbody">'+
      '<div style="display:flex;justify-content:space-between;gap:8px"><strong>達成度 '+percent+'%</strong>'+
      '<span class="pn-chip">未完了 '+open.length+'件</span></div>'+
      '<div class="pn-progress"><i style="width:'+percent+'%"></i></div>'+
      '<form class="pn-compose" data-pn-form="todo"><input id="pnTodoInput" name="text" maxlength="220" required placeholder="次にやることを追加" aria-label="ToDoの内容">'+
      '<button class="pn-button primary" type="submit" '+(state.busy?'disabled':'')+'>＋ 追加</button>'+
      '<textarea name="memo" maxlength="4000" rows="2" placeholder="メモ（任意）"></textarea></form>'+
      '<p class="pn-formhelp">既存のToDo保存・競合処理を使用します。表示は現在のユーザーの項目のみです。</p></div></section>'+
      '<div class="pn-maincols"><section class="pn-sheet"><header class="pn-sheethead"><h2>これから</h2><span class="pn-chip">'+open.length+'件</span></header>'+
      '<div class="pn-sheetbody"><ul class="pn-todolist">'+
      (open.length?open.map(t=>todoRow(t)).join(''):'<li class="pn-empty">すべて完了しています</li>')+
      '</ul></div></section><section class="pn-sheet"><header class="pn-sheethead"><h2>完了履歴</h2>'+
      '<span class="pn-chip good">'+done.length+'件</span></header>'+
      '<div class="pn-sheetbody"><ul class="pn-todolist">'+
      (done.length?done.map(t=>todoRow(t)).join(''):'<li class="pn-empty">完了した項目はありません</li>')+
      '</ul></div></section></div>';
  }
  function taskPage() {
    const filters=[['all','未完了'],['mine','自分の担当'],['urgent','期限が近い'],['done','完了']];
    const tasks=filteredTasks().sort((a,b)=>
      (a.dueDate||'9999').localeCompare(b.dueDate||'9999') ||
      (Number(b.pinned)-Number(a.pinned)));
    return pageHead('WORK FLOW','仕事の流れ','必要なタスクだけを、見渡せる一覧で。')+
      '<div class="pn-flowtabs" aria-label="タスクの絞り込み">'+
      filters.map(([key,label])=>'<button class="pn-filter" type="button" data-pn-filter="'+key+
        '" aria-pressed="'+(state.taskFilter===key)+'">'+label+'</button>').join('')+'</div>'+
      '<section class="pn-sheet">'+
      '<header class="pn-sheethead"><h2>'+tasks.length+'件のタスク</h2><span class="pn-chip">一覧表示</span></header>'+
      '<div>'+ (tasks.length?tasks.map((t,i)=>'<div class="pn-flowrow">'+
        '<span aria-hidden="true" class="pn-focusnum">'+String(i+1).padStart(2,'0')+'</span>'+
        '<button class="pn-flowtitle" type="button" data-pn-detail="task" data-id="'+escape(t.id)+'">'+
        '<strong>'+escape(t.title)+'</strong><small>'+
        escape(t.status||'未着手')+' · '+escape(t.category||'未分類')+' · '+escape(t.assignee||'担当未設定')+
        '</small></button><span class="pn-flowdate">'+escape(t.dueDate?dateParts(t.dueDate):'期限なし')+
        '</span><button class="pn-smallbtn" data-pn-cmd="task.star" data-id="'+escape(t.id)+
        '" type="button" aria-label="'+(t.favorite?'スターを外す':'スターを付ける')+'">'+
        (t.favorite?'★':'☆')+'</button></div>').join(''):'<div class="pn-empty">該当タスクはありません</div>')+
      '</div></section><p class="pn-footnote">作成・複雑な編集・一括操作は、専用フォームへの移行後に有効化します。</p>';
  }
  function scheduleRow(item) {
    return '<div class="pn-scheduleitem"><time>'+escape(localTime(item.startAt))+'</time>'+
      '<div><strong>'+escape(item.title)+'</strong><small>'+
      escape(item.location||item.category||'予定')+
      (item.assignee?' · '+escape(item.assignee):'')+'</small></div></div>';
  }
  function schedulePage() {
    const selected = new Date(state.selectedDay+'T00:00:00');
    const first=new Date(selected);first.setDate(selected.getDate()-((selected.getDay()+6)%7));
    const days=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+i);return d});
    const schedules=state.snapshot.schedules.filter(item =>
      localDate(item.startAt)===state.selectedDay&&match(item.title+' '+item.location))
      .sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt)));
    return pageHead('TIME RHYTHM','予定のリズム','日付を選んで、時間の流れを確認。')+
      '<div class="pn-bridge-note">予定の表示は実データに接続済みです。追加・変更・繰り返し・コピーの独立フォームは次工程で接続します。</div>'+
      '<div class="pn-weekstrip">'+days.map(d=>{
        const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        return '<button type="button" class="pn-weekday" data-pn-day="'+iso+'" aria-pressed="'+
          (state.selectedDay===iso)+'"><small>'+'月火水木金土日'[(d.getDay()+6)%7]+
          '</small><strong>'+d.getDate()+'</strong></button>';
      }).join('')+'</div>'+
      '<section class="pn-sheet"><header class="pn-sheethead"><h2>'+escape(dateParts(state.selectedDay))+
      ' の予定</h2><span class="pn-chip">'+schedules.length+'件</span></header>'+
      '<div class="pn-sheetbody">'+(schedules.length?schedules.map(scheduleRow).join(''):
      '<div class="pn-empty">この日の予定はありません</div>')+'</div></section>';
  }
  function memoPage() {
    return pageHead('MEMO WALL','メモウォール','必要な記録を、迷わず見つける。')+
      '<section class="pn-sheet"><div class="pn-muted-note">'+
      '<h2 style="margin-top:0">業務メモの独立画面は接続作業中です</h2>'+
      '<p>次工程で既存の業務メモ保存・ピン留め・タスク化を専用ビューにつなぎます。'+
      'この段階では架空のメモを表示せず、既存データの変更も行いません。</p>'+
      '<p>業務メモの操作が必要な場合は、上部の「画面デザイン」からClassicへ切り替えてください。</p>'+
      '</div></section>';
  }
  const pages={today:todayPage,todos:todoPage,tasks:taskPage,schedule:schedulePage,memos:memoPage};
  function render() {
    if(!active())return;
    const name=state.route,screen=pages[name]||todayPage;
    workspace.innerHTML='<div class="pn-bridge-note" role="note">Palette NEXTは開発版です。ToDoなどの操作は実際の業務データに反映されます。未接続機能は「戻る」で従来画面をご利用ください。</div>'+screen();
    root.querySelectorAll('[data-pn-route]').forEach(button=>{
      const selected=button.dataset.pnRoute===name;
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    updateDetail();
  }
  function closeDetail() {
    state.detail=null;
    drawer.hidden=true;
    overlay.hidden=true;
    drawer.innerHTML='';
    if(lastFocused?.isConnected) lastFocused.focus({preventScroll:true});
    lastFocused=null;
  }
  function updateDetail() {
    if(!state.detail){drawer.hidden=true;overlay.hidden=true;return}
    const {kind,id}=state.detail;
    const data=kind==='task'?state.snapshot.tasks:state.snapshot.todos;
    const item=data.find(value=>value.id===id);
    if(!item){closeDetail();return}
    drawer.hidden=false;overlay.hidden=false;
    if(kind==='task'){
      drawer.innerHTML='<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
        '<span class="pn-kicker" style="display:block;margin-top:18px">TASK DETAIL</span>'+
        '<h2>'+escape(item.title)+'</h2><p>'+escape(item.description||'詳細メモなし')+'</p>'+
        '<dl><dt>担当</dt><dd>'+escape(item.assignee||'未設定')+'</dd>'+
        '<dt>状態</dt><dd>'+escape(item.status)+'</dd>'+
        '<dt>分類</dt><dd>'+escape(item.category||'未分類')+'</dd>'+
        '<dt>期限</dt><dd>'+escape(item.dueDate||'期限なし')+'</dd></dl>'+
        '<div class="pn-actions">'+
        '<button class="pn-button primary" data-pn-cmd="'+(item.completed?'task.reopen':'task.complete')+
        '" data-id="'+escape(item.id)+'" type="button">'+(item.completed?'未着手に戻す':'完了にする')+'</button>'+
        '<button class="pn-button" type="button" data-pn-cmd="task.star" data-id="'+escape(item.id)+'">'+
        (item.favorite?'★ スターを外す':'☆ スターを付ける')+'</button></div>';
    } else {
      drawer.innerHTML='<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
        '<span class="pn-kicker" style="display:block;margin-top:18px">TODO DETAIL</span>'+
        '<h2>ToDoの内容</h2><form id="pnTodoEdit" data-pn-form="edit-todo">'+
        '<label>やること<input name="text" maxlength="220" required value="'+escape(item.text)+
        '" style="display:block;margin:7px 0 12px;width:100%;border:1px solid var(--pn-border);background:var(--pn-bg);color:var(--pn-ink);padding:12px;border-radius:10px"></label>'+
        '<label>メモ<textarea name="memo" rows="7" maxlength="4000">'+escape(item.memo||'')+'</textarea></label>'+
        '<div class="pn-actions" style="margin-top:14px"><button class="pn-button primary" type="submit">変更を保存</button>'+
        '<button class="pn-button" type="button" data-pn-cmd="todo.delete" data-id="'+escape(item.id)+'">削除</button></div>'+
        '</form>';
    }
  }
  async function dispatch(command,element) {
    if(state.busy)return;
    state.busy=true;
    if(element)element.disabled=true;
    try {
      const result=await bridge.dispatch(command);
      if(result?.ok) {
        if(command.type==='todo.delete')closeDetail();
        notify('変更を保存しました');
      } else if(result?.error!=='cancelled') {
        notify('操作を完了できませんでした。再読込して確認してください。');
      }
    } catch (error) {
      console.error('Palette NEXT command failed',error);
      notify('操作に失敗しました。入力内容を確認してください。');
    } finally {
      state.busy=false;
      if(element?.isConnected)element.disabled=false;
    }
  }
  root.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target)return;
    if(target.hasAttribute('data-pn-close')){closeDetail();return}
    if(target.hasAttribute('data-pn-exit')){exitPreview();return}
    if(target.dataset.pnRoute) {
      state.route=target.dataset.pnRoute;
      state.detail=null;
      state.taskFilter='all';
      closeDetail();render();window.scrollTo({top:0,behavior:'instant'});
      return;
    }
    if(target.hasAttribute('data-pn-theme')){state.theme=state.theme==='dark'?'light':'dark';setTheme();return}
    if(target.dataset.pnFilter){state.taskFilter=target.dataset.pnFilter;render();return}
    if(target.dataset.pnDay){state.selectedDay=target.dataset.pnDay;render();return}
    if(target.hasAttribute('data-pn-create')) {
      state.route='todos';closeDetail();render();
      root.querySelector('#pnTodoInput')?.focus();return;
    }
    if(target.dataset.pnDetail) {
      lastFocused=target;
      state.detail={kind:target.dataset.pnDetail,id:target.dataset.id};
      updateDetail();drawer.querySelector('[data-pn-close]')?.focus();return;
    }
    if(target.dataset.pnCmd) {
      dispatch({type:target.dataset.pnCmd,id:target.dataset.id,
        direction:target.dataset.direction,segment:target.dataset.segment},target);
    }
  });
  root.addEventListener('submit',event=>{
    const form=event.target.closest('[data-pn-form]');
    if(!form)return;
    event.preventDefault();
    if(state.busy)return;
    const values=new FormData(form);
    if(form.dataset.pnForm==='todo'){
      dispatch({type:'todo.create',text:String(values.get('text')||''),memo:String(values.get('memo')||'')},
        form.querySelector('[type="submit"]'));
    }
    if(form.dataset.pnForm==='edit-todo' && state.detail?.kind==='todo'){
      dispatch({type:'todo.update',id:state.detail.id,
        text:String(values.get('text')||''),memo:String(values.get('memo')||'')},form.querySelector('[type="submit"]'));
    }
  });
  root.querySelector('#pnSearch').addEventListener('input',event=>{
    state.query=event.target.value;render();
  });
  root.querySelector('#pnMode').addEventListener('change',event=>{
    const requested=event.target.value;
    if(requested==='preview'){syncMode();return}
    if(!modeController?.selectMode){notify('画面切替機能が利用できません');return}
    modeController.selectMode(requested);
    exitPreview();
    syncMode();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.detail&&active()){event.preventDefault();closeDetail()}
  });
  const paletteModeObserver=new MutationObserver(syncMode);
  paletteModeObserver.observe(document.documentElement,{
    attributes:true,attributeFilter:['data-wb-display','data-wb-color-mode','data-wb-color-theme']
  });
  bridge.subscribe(snapshot=>{
    state.snapshot=snapshot;
    if(active())render();
  });
  // The preview flag becomes active only after the independent UI is ready.
  // If the preview script/style fails to load, the Classic/Modern shell remains usable.
  if (new URLSearchParams(location.search).get('paletteNext') === '1') {
    document.documentElement.dataset.wbPaletteNextPreview = 'true';
  }
  syncMode();
})();
