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
  const memoBridge = window.WorkBoardPaletteMemoBridgeV369;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nav = [
    ['today','今日','◎'],['tasks','タスク','▤'],['todos','ToDo','✓'],
    ['schedule','予定','▦'],['memos','メモ','▤']
  ];
  const state = {
    route:'today', query:'', taskFilter:'all', detail:null, editor:null,
    selectedDay:new Date().toLocaleDateString('sv-SE'), busy:false,
    bulkSelected:new Map(), bulkAction:'complete', bulkTarget:'',
    snapshot:bridge.readSnapshot(),
    memos:memoBridge?.readSnapshot?.() || [],
    theme:null
  };
  const root = document.createElement('div');
  root.id = 'paletteNextRoot';
  const modeOptions = [
    ['palette','Palette'],['classic','Classic'],['modern','Modern'],['journal','Journal']
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
    '</div></header>'+
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
    return document.documentElement.dataset.wbDisplay === 'palette';
  }
  function syncMode() {
    const next = modeController?.getMode?.() || document.documentElement.dataset.wbDisplay || 'classic';
    root.querySelector('#pnMode').value = next;
    document.documentElement.dataset.wbPaletteNextPreview = String(active());
    setTheme();
    if (active()) render();
    else { state.bulkSelected.clear(); closeDetail(); }
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
      '<div class="pn-workactions"><button class="pn-button primary" type="button" data-pn-edit="task">＋ タスクを作成</button></div>'+
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
      '</div></section><p class="pn-footnote">繰り返し設定や一括操作などの詳細機能は、従来画面から操作できます。</p>';
  }
  function scheduleRow(item) {
    return '<div class="pn-scheduleitem"><time>'+escape(localTime(item.startAt))+'</time>'+
      '<button class="pn-scheduleopen" type="button" data-pn-detail="schedule" data-id="'+escape(item.id)+'">'+
      '<strong>'+escape(item.title)+'</strong><small>'+
      escape(item.location||item.category||'予定')+
      (item.assignee?' · '+escape(item.assignee):'')+
      (item.recurrenceSeriesId?' · 繰り返し予定':'')+
      '</small></button></div>';
  }
  function schedulePage() {
    const selected = new Date(state.selectedDay+'T00:00:00');
    const first=new Date(selected);first.setDate(selected.getDate()-((selected.getDay()+6)%7));
    const days=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+i);return d});
    const schedules=state.snapshot.schedules.filter(item =>
      localDate(item.startAt)===state.selectedDay&&match(item.title+' '+item.location))
      .sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt)));
    return pageHead('TIME RHYTHM','予定のリズム','日付を選んで、時間の流れを確認。')+
      '<div class="pn-calendar-toolbar">'+
      '<div class="pn-actions"><button type="button" class="pn-button flat" data-pn-week-shift="-7" aria-label="前の週">‹ 前週</button>'+
      '<button type="button" class="pn-button flat" data-pn-day-today>今週</button>'+
      '<button type="button" class="pn-button flat" data-pn-week-shift="7" aria-label="次の週">次週 ›</button></div>'+
      '<button type="button" class="pn-button primary" data-pn-edit="schedule">＋ 新しい予定</button></div>'+
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
    const items=state.memos.filter(memo=>match([
      memo.title,memo.category,memo.body,...(memo.tags||[])].join(' ')));
    return pageHead('MEMO WALL','メモウォール','いつもの情報を、すぐ取り出せる。')+
      '<div class="pn-workactions"><button class="pn-button primary" type="button" data-pn-edit="memo">＋ 新しいメモ</button></div>'+
      '<div class="pn-memogrid">'+(items.length?items.map(memo=>
        '<button class="pn-memotile" type="button" data-pn-detail="memo" data-id="'+escape(memo.id)+'">'+
        '<div class="pn-memotop"><span class="pn-chip">'+escape(memo.category||'その他')+'</span>'+
        (memo.pinned?'<span aria-label="固定中">★</span>':'')+'</div>'+
        '<strong>'+escape(memo.title||'無題')+'</strong>'+
        '<p>'+escape((memo.body||'').slice(0,160))+'</p>'+
        '<small>'+escape(memo.updatedBy||'')+(memo.updatedAt?' · '+escape(dateParts(memo.updatedAt)):'')+'</small></button>'
      ).join(''):'<div class="pn-sheet pn-empty">該当する業務メモはありません</div>')+
      '</div>';
  }
  const pages={today:todayPage,todos:todoPage,tasks:taskPage,schedule:schedulePage,memos:memoPage};
  function render() {
    if(!active())return;
    const name=state.route,screen=pages[name]||todayPage;
    workspace.innerHTML=screen();
    root.querySelectorAll('[data-pn-route]').forEach(button=>{
      const selected=button.dataset.pnRoute===name;
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    updateDetail();
  }
  function closeDetail() {
    state.detail=null;
    state.editor=null;
    drawer.dataset.editor='';
    drawer.hidden=true;
    overlay.hidden=true;
    drawer.innerHTML='';
    if(lastFocused?.isConnected) lastFocused.focus({preventScroll:true});
    lastFocused=null;
  }
  function editorOptions(values, selected) {
    const choices = [...new Set([...values.filter(Boolean), selected].filter(Boolean))];
    return choices.map(value => '<option value="'+escape(value)+'"'+
      (value===selected?' selected':'')+'>'+escape(value)+'</option>').join('');
  }
  function editorInput(label,name,value,type='text',extra='') {
    return '<label class="pn-editor-field"><span>'+escape(label)+'</span>'+
      '<input type="'+type+'" name="'+escape(name)+'" value="'+escape(value||'')+'" '+extra+'></label>';
  }
  function editorSelect(label,name,options,selected) {
    return '<label class="pn-editor-field"><span>'+escape(label)+'</span>'+
      '<select name="'+escape(name)+'">'+editorOptions(options,selected)+'</select></label>';
  }
  function editorTextArea(label,name,value,rows=4,extra='') {
    return '<label class="pn-editor-field wide"><span>'+escape(label)+'</span>'+
      '<textarea name="'+escape(name)+'" rows="'+rows+'" '+extra+'>'+
      escape(value||'')+'</textarea></label>';
  }
  // Schedule editor and recurrence copy workspace, both owned by Palette NEXT.
  // The underlying dates and CAS writes are delegated to app.js' canonical API.
  function localDateTimeInput(iso) {
    return iso ? localDate(iso)+'T'+localTime(iso) : '';
  }
  function scheduleValuesFromForm(form) {
    const data=new FormData(form);
    return {
      title:String(data.get('title')||''),
      startAt:String(data.get('startAt')||''),
      endAt:String(data.get('endAt')||''),
      assignee:String(data.get('assignee')||''),
      location:String(data.get('location')||''),
      category:String(data.get('category')||''),
      memo:String(data.get('memo')||''),
      relatedTaskId:String(data.get('relatedTaskId')||'')
    };
  }
  function scheduleEditorMarkup(item,override=null) {
    const snap=state.snapshot,editing=Boolean(item);
    const draft=override||item||{};
    const day=state.selectedDay||snap.today||currentDate();
    const start=override?.startAt||localDateTimeInput(item?.startAt)||day+'T09:00';
    const end=override?.endAt||localDateTimeInput(item?.endAt)||day+'T10:00';
    const assignee=draft.assignee||snap.currentUser;
    const category=draft.category||snap.categories[0]||'その他';
    const linked=draft.relatedTaskId||'';
    const taskChoices=snap.tasks.map(t=>'<option value="'+escape(t.id)+'"'+
      (t.id===linked?' selected':'')+'>'+escape(t.title)+'</option>').join('');
    return '<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
      '<span class="pn-kicker pn-editor-kicker">SCHEDULE STUDIO</span>'+
      '<h2>'+(editing?'予定を編集':'新しい予定')+'</h2>'+
      '<form class="pn-editor-form" data-pn-form="schedule-editor">'+
      '<div class="pn-editor-grid">'+
      editorInput('件名（必須）','title',draft.title,'text','required maxlength="80" autofocus')+
      editorInput('開始日時（必須）','startAt',start,'datetime-local','required')+
      editorInput('終了日時（必須）','endAt',end,'datetime-local','required')+
      editorSelect('担当者','assignee',snap.assignees||snap.users,assignee)+
      editorSelect('分類','category',snap.categories,category)+
      editorInput('場所','location',draft.location,'text','maxlength="60"')+
      '<label class="pn-editor-field wide"><span>関連タスク</span><select name="relatedTaskId">'+
      '<option value="">指定しない</option>'+taskChoices+
      (linked&&!snap.tasks.some(t=>t.id===linked)
        ? '<option selected value="'+escape(linked)+'">以前の関連タスク</option>':'')+
      '</select></label>'+
      editorTextArea('メモ','memo',draft.memo,5,'maxlength="1000"')+'</div>'+
      (item?.recurrenceSeriesId?'<p class="pn-editor-note">系列内のこの1件だけを編集します。系列の識別情報は保持されます。</p>':'')+
      '<div class="pn-editor-actions"><button class="pn-button primary" type="submit">'+
      (editing?'変更を保存':'予定を登録')+'</button>'+
      (!editing?'<button class="pn-button flat" type="button" data-pn-batch-new>この内容を複数日へ作成</button>':'')+
      '<button class="pn-button" type="button" data-pn-close>キャンセル</button></div></form>';
  }
  function scheduleCopyMarkup(editor) {
    const isBatch=editor.kind==='schedule-batch';
    const source=isBatch?editor.sourceValues:
      state.snapshot.schedules.find(item=>item.id===editor.id);
    if(!source)return '<p class="pn-editor-note">コピー元が見つかりません。最新の予定を確認してください。</p>'+
      '<button class="pn-button" type="button" data-pn-close>閉じる</button>';
    const date=isBatch?String(source.startAt).slice(0,10):localDate(source.startAt);
    const next=new Date(date+'T12:00:00');
    if(!isBatch)next.setDate(next.getDate()+1);
    const startDate=isBatch?date:next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+
      '-'+String(next.getDate()).padStart(2,'0');
    const methods=[
      ['once','指定日に1件コピー'],['dates','任意の日付を複数指定'],
      ['daily','毎日／N日ごと'],['weekdays','平日だけ'],
      ['weekly','毎週／曜日指定'],['monthlyDay','毎月の指定日'],
      ['monthlyNth','毎月の第N曜日'],['monthEnd','毎月末'],
      ['lastWeekday','毎月の最終平日'],['yearly','毎年']
    ];
    const weekday=Number.isNaN(new Date(date+'T12:00:00').getTime())?1:new Date(date+'T12:00:00').getDay();
    return '<button class="pn-button flat" type="button" data-pn-copy-back>← 戻る</button>'+
      '<span class="pn-kicker pn-editor-kicker">COPY & REPEAT</span>'+
      '<h2>'+(isBatch?'複数日へ予定を作成':'予定をコピー・繰り返し')+'</h2>'+
      '<p class="pn-editor-note">コピー元：'+escape(source.title||'予定')+
      '。作成する日付をプレビューで確認してから保存します。'+
      (isBatch?' 元の入力内容を1件として別途保存することはありません。':'')+'</p>'+
      '<form class="pn-editor-form" data-pn-form="schedule-copy">'+
      '<div class="pn-editor-grid">'+
      editorSelect('コピー方法','method',methods.map(x=>x[0]),'once')
        .replace(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g,(all,value)=>
          '<option value="'+value+'"'+(value==='once'?' selected':'')+'>'+
          escape(methods.find(x=>x[0]===value)?.[1]||value)+'</option>')+
      '<div class="pn-copy-field wide" data-pn-copy-field="start">'+editorInput('開始日／コピー先の日付','startDate',startDate,'date','required')+'</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="interval">'+
      editorInput('間隔（1〜36）','interval','1','number','min="1" max="36" required')+'</div>'+
      '<div class="pn-copy-field wide" data-pn-copy-field="weekdays">'+
      '<fieldset class="pn-copy-weekdays"><legend>対象曜日</legend>'+
      ['日','月','火','水','木','金','土'].map((day,i)=>
        '<label><input type="checkbox" name="weekdays" value="'+i+'" '+(i===weekday?'checked':'')+'>'+day+'</label>').join('')+
      '</fieldset></div>'+
      '<div class="pn-copy-field" data-pn-copy-field="monthDay">'+
      editorInput('毎月の何日','monthDay',String(new Date(date+'T12:00:00').getDate()),'number','min="1" max="31"')+'</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="nth">'+
      editorSelect('第何週','nth',['1','2','3','4','5','last'],'1')+'</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="nthWeekday">'+
      editorSelect('何曜日','nthWeekday',['0','1','2','3','4','5','6'],String(weekday))+'</div>'+
      '<div class="pn-copy-field wide" data-pn-copy-field="dates">'+
      editorTextArea('コピーする日付（改行／カンマ区切り、YYYY-MM-DD）','selectedDates',startDate,4)+'</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="endMode">'+
      editorSelect('終了条件','endMode',['count','date'],'count')
        .replace('>count</option>','>件数で指定</option>').replace('>date</option>','>終了日まで</option>')+
      '</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="count">'+
      editorInput('作成件数（最大200件）','count','4','number','min="1" max="200" required')+'</div>'+
      '<div class="pn-copy-field" data-pn-copy-field="endDate">'+
      editorInput('終了日','endDate',startDate,'date')+'</div>'+
      '</div><div class="pn-editor-actions">'+
      '<button type="button" class="pn-button flat" data-pn-copy-preview>作成日をプレビュー</button>'+
      '<button type="submit" class="pn-button primary" data-pn-copy-submit disabled>確認した予定を登録</button></div>'+
      '<div class="pn-copy-review" id="pnCopyReview" aria-live="polite">'+
      'まだプレビューされていません。先に作成日を確認してください。</div></form>';
  }
  function copyConfigFromForm(form) {
    const data=new FormData(form);
    return {
      method:String(data.get('method')||'once'),
      startDate:String(data.get('startDate')||''),
      interval:Number(data.get('interval')||1),
      count:Number(data.get('count')||4),
      endMode:String(data.get('endMode')||'count'),
      endDate:String(data.get('endDate')||''),
      selectedDates:String(data.get('selectedDates')||''),
      weekdays:data.getAll('weekdays').map(Number),
      monthDay:Number(data.get('monthDay')||1),
      nth:String(data.get('nth')||'1'),
      nthWeekday:Number(data.get('nthWeekday')||1)
    };
  }
  function syncCopyFields(form) {
    const method=form.elements.method.value;
    const endMode=form.elements.endMode.value;
    const recurring=!['once','dates'].includes(method);
    const interval=['daily','weekly','monthlyDay','monthlyNth','monthEnd','lastWeekday','yearly'].includes(method);
    const visibility={
      start:method!=='dates',interval,weekdays:method==='weekly',
      monthDay:method==='monthlyDay',nth:method==='monthlyNth',nthWeekday:method==='monthlyNth',
      dates:method==='dates',endMode:recurring,count:recurring&&endMode==='count',
      endDate:recurring&&endMode==='date'
    };
    form.querySelectorAll('[data-pn-copy-field]').forEach(group=>{
      group.hidden=!visibility[group.dataset.pnCopyField];
      group.querySelectorAll('input,select,textarea').forEach(control=>{
        control.disabled=group.hidden;
      });
    });
  }
  function openScheduleCopy(id='',values=null,trigger=null) {
    if(state.busy)return;
    const source=id?state.snapshot.schedules.find(item=>item.id===id):null;
    if(id&&!source){notify('コピー元の予定がありません。');return}
    if(!id&&!values){notify('元の予定を入力してください。');return}
    if(!state.editor&&trigger)lastFocused=trigger;
    state.editor={
      kind:id?'schedule-copy':'schedule-batch',
      id,revision:Number(source?.revision||0),
      ownerRoom:state.snapshot.roomId,ownerUser:state.snapshot.currentUser,
      sourceValues:values, reviewedKey:null
    };
    state.detail=null;drawer.dataset.editor=state.editor.kind;
    drawer.hidden=false;overlay.hidden=false;
    drawer.innerHTML=scheduleCopyMarkup(state.editor);
    const form=drawer.querySelector('[data-pn-form="schedule-copy"]');
    if(form){syncCopyFields(form);form.elements.method.focus({preventScroll:true})}
  }
  async function previewScheduleCopy(form) {
    const editor=state.editor;
    if(!editor||!['schedule-copy','schedule-batch'].includes(editor.kind)||state.busy)return;
    const cfg=copyConfigFromForm(form);
    const key=JSON.stringify(cfg);
    const command={
      type:editor.kind==='schedule-batch'?'schedule.preview-batch':'schedule.preview-copy',
      id:editor.id,revision:editor.revision,
      ownerRoom:editor.ownerRoom,ownerUser:editor.ownerUser,
      values:editor.sourceValues,copyConfig:cfg
    };
    const submit=form.querySelector('[data-pn-copy-submit]');
    state.busy=true;
    try{
      const result=await bridge.dispatch(command);
      if(state.editor!==editor)return;
      const review=form.querySelector('#pnCopyReview');
      if(!result?.ok){
        editor.reviewedKey=null;submit.disabled=true;
        review.textContent='指定した条件から作成日を計算できませんでした。内容を確認してください。';
        notify(result?.detail||'繰り返し条件を確認してください。');
        return;
      }
      editor.reviewedKey=key;submit.disabled=false;
      const conflicts=new Set((result.conflicts||[]).map(entry=>entry.date));
      review.innerHTML='<strong>'+result.count+'件の作成日を確認しました</strong>'+
        '<div class="pn-copy-date-list">'+result.dates.map(date=>
          '<span class="pn-copy-date'+(conflicts.has(date)?' clash':'')+'">'+escape(date)+
          (conflicts.has(date)?' · 重複':'')+'</span>').join('')+'</div>'+
        (result.conflicts.length?'<p class="pn-copy-warning">既存予定との時間の重複が'+
          result.conflicts.length+'件あります。登録時に再確認します。</p>':'')+
        (result.count>=50?'<p class="pn-copy-warning">大量登録です。実行前に再度確認します。</p>':'');
    }catch(error){
      console.error('Palette NEXT preview failed',error);
      notify('日付プレビューに失敗しました。');
    }finally{state.busy=false}
  }

  function taskEditorMarkup(task) {
    const snap=state.snapshot;
    const editing=Boolean(task);
    const status=task?.status||snap.statuses.find(value=>value!=='完了')||'未着手';
    const assignee=task?.assignee||(snap.assignees||[]).includes(snap.currentUser)
      ? (task?.assignee||snap.currentUser) : (snap.assignees||[])[0]||snap.currentUser;
    const checklist=(task?.checklist||[]).map(row=>(row.done?'[x] ':'')+row.text).join('\n');
    return '<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
      '<span class="pn-kicker pn-editor-kicker">TASK WORKSPACE</span>'+
      '<h2>'+(editing?'タスクを編集':'タスクを作成')+'</h2>'+
      '<form class="pn-editor-form" data-pn-form="task-editor">'+
      '<div class="pn-editor-grid">'+
      editorInput('件名（必須）','title',task?.title,'text','required maxlength="80" autofocus')+
      editorSelect('担当者','assignee',snap.assignees||snap.users,assignee)+
      editorSelect('状態','status',snap.statuses,status)+
      editorSelect('優先度','priority',['緊急','高','中','低'],task?.priority||'中')+
      editorSelect('分類','category',snap.categories,task?.category||snap.categories[0]||'その他')+
      editorInput('期限日','dueDate',task?.dueDate,'date')+
      editorInput('期限時刻','dueTime',task?.dueTime,'time')+
      editorInput('依頼元','requester',task?.requester,'text','maxlength="40"')+
      editorInput('タグ（カンマ区切り）','tags',(task?.tags||[]).join(', '),'text','maxlength="80"')+
      editorTextArea('内容・メモ','description',task?.description,5,'maxlength="6000"')+
      editorTextArea('チェックリスト（1行に1項目）','checklist',checklist,4,'maxlength="6000"')+
      '<label class="pn-editor-check"><input type="checkbox" name="pinned" '+
      (task?.pinned?'checked':'')+'> 固定表示する</label></div>'+
      (task?.recurrence && task.recurrence!=='none'
        ? '<p class="pn-editor-note">繰り返し条件は変更せず維持します。変更する場合は従来画面をご利用ください。</p>'
        : '')+
      '<div class="pn-editor-actions"><button class="pn-button primary" type="submit">'+
      (editing?'変更を保存':'タスクを登録')+'</button>'+
      '<button class="pn-button" type="button" data-pn-close>キャンセル</button></div></form>';
  }
  function memoEditorMarkup(memo) {
    const editing=Boolean(memo);
    const categories=Array.from(memoBridge?.categories||['定型情報','宛先・連絡先','手順','URL・リンク','その他']);
    return '<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
      '<span class="pn-kicker pn-editor-kicker">MEMO STUDIO</span>'+
      '<h2>'+(editing?'業務メモを編集':'業務メモを作成')+'</h2>'+
      '<form class="pn-editor-form" data-pn-form="memo-editor">'+
      '<div class="pn-editor-grid">'+
      editorInput('タイトル（必須）','title',memo?.title,'text','required maxlength="80" autofocus')+
      editorSelect('分類','category',categories,memo?.category||categories[0])+
      editorInput('タグ','tags',(memo?.tags||[]).join(', '),'text','maxlength="120"')+
      editorTextArea('本文（必須）','body',memo?.body,10,'required maxlength="6000"')+
      '<label class="pn-editor-check"><input type="checkbox" name="pinned" '+
      (memo?.pinned?'checked':'')+'> 上部に固定する</label></div>'+
      '<div class="pn-editor-actions"><button class="pn-button primary" type="submit">'+
      (editing?'変更を保存':'メモを登録')+'</button>'+
      '<button class="pn-button" type="button" data-pn-close>キャンセル</button></div></form>';
  }
  function openEditor(kind,id='',trigger=null) {
    if(state.busy || !['task','memo','schedule'].includes(kind))return;
    const items=kind==='task'?state.snapshot.tasks:
      kind==='schedule'?state.snapshot.schedules:state.memos;
    const entry=id?items.find(item=>item.id===id):null;
    if(id&&!entry){notify('対象が見つかりません。更新してから開き直してください。');return}
    if(!state.editor && trigger) lastFocused=trigger;
    state.editor={
      kind,id,revision:Number(entry?.revision||0),
      ownerRoom:state.snapshot.roomId,ownerUser:state.snapshot.currentUser
    };
    state.detail=null;
    drawer.dataset.editor=kind;
    drawer.hidden=false;overlay.hidden=false;
    drawer.innerHTML=kind==='task'?taskEditorMarkup(entry):
      kind==='schedule'?scheduleEditorMarkup(entry):memoEditorMarkup(entry);
    drawer.querySelector('[name="title"]')?.focus({preventScroll:true});
  }

  function updateDetail() {
    if(state.editor)return; // Keep in-progress form input even when live data refreshes.
    if(!state.detail){drawer.hidden=true;overlay.hidden=true;return}
    const {kind,id}=state.detail;
    const data=kind==='task'?state.snapshot.tasks:
      kind==='memo'?state.memos:
      kind==='schedule'?state.snapshot.schedules:state.snapshot.todos;
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
        '<button class="pn-button" type="button" data-pn-edit="task" data-id="'+escape(item.id)+'">内容を編集</button>'+
        '<button class="pn-button primary" data-pn-cmd="'+(item.completed?'task.reopen':'task.complete')+
        '" data-id="'+escape(item.id)+'" type="button">'+(item.completed?'未着手に戻す':'完了にする')+'</button>'+
        '<button class="pn-button" type="button" data-pn-cmd="task.star" data-id="'+escape(item.id)+'">'+
        (item.favorite?'★ スターを外す':'☆ スターを付ける')+'</button></div>';
    } else if (kind==='schedule') {
      const start=String(item.startAt||''),end=String(item.endAt||'');
      drawer.innerHTML='<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
        '<span class="pn-kicker pn-editor-kicker">SCHEDULE DETAIL</span>'+
        '<h2>'+escape(item.title)+'</h2>'+
        '<dl><dt>開始</dt><dd>'+escape(localDate(start)+' '+localTime(start))+'</dd>'+
        '<dt>終了</dt><dd>'+escape(localDate(end)+' '+localTime(end))+'</dd>'+
        '<dt>担当</dt><dd>'+escape(item.assignee||'未設定')+'</dd>'+
        '<dt>場所</dt><dd>'+escape(item.location||'—')+'</dd>'+
        '<dt>分類</dt><dd>'+escape(item.category||'その他')+'</dd>'+
        '<dt>関連タスク</dt><dd>'+escape(state.snapshot.tasks.find(t=>t.id===item.relatedTaskId)?.title||'なし')+'</dd></dl>'+
        (item.memo?'<pre class="pn-memobody">'+escape(item.memo)+'</pre>':'')+
        (item.recurrenceSeriesId?'<p class="pn-editor-note">繰り返し系列に属しています。削除範囲の指定は従来画面で操作できます。</p>':'')+
        '<div class="pn-actions">'+
        '<button type="button" class="pn-button primary" data-pn-edit="schedule" data-id="'+escape(item.id)+'">予定を編集</button>'+
        '<button type="button" class="pn-button" data-pn-copy="schedule" data-id="'+escape(item.id)+'">コピー・繰り返し</button>'+
        '<button type="button" class="pn-button danger" data-pn-cmd="schedule.delete" data-id="'+escape(item.id)+'" data-revision="'+item.revision+'">'+
        '削除</button></div>';
    } else if (kind==='memo') {
      drawer.innerHTML='<button class="pn-button flat" type="button" data-pn-close>閉じる ×</button>'+
        '<span class="pn-kicker" style="display:block;margin-top:18px">MEMO DETAIL</span>'+
        '<h2>'+escape(item.title||'無題')+'</h2><p>'+escape(item.category||'その他')+'</p>'+
        '<pre class="pn-memobody">'+escape(item.body||'')+'</pre>'+
        '<div class="pn-actions">'+
        '<button class="pn-button primary" data-pn-edit="memo" data-id="'+escape(item.id)+'" type="button">編集する</button>'+
        '<button class="pn-button" data-pn-cmd="memo.pin" data-revision="'+item.revision+'" data-id="'+escape(item.id)+'" type="button">'+
        (item.pinned?'★ 固定を解除':'☆ 固定する')+'</button>'+
        '<button class="pn-button danger" data-pn-cmd="memo.delete" data-revision="'+item.revision+'" data-id="'+escape(item.id)+'" type="button">削除</button></div>';
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
      const result = command.type.startsWith('memo.')
        ? await memoBridge?.dispatch?.(command)
        : await bridge.dispatch(command);
      if(result?.ok) {
        if(['todo.delete','memo.delete','task.create','task.update','memo.create','memo.update',
          'schedule.create','schedule.update','schedule.copy','schedule.batch','schedule.delete'].includes(command.type))
          closeDetail();
        notify(result.count ? result.count+'件の予定を作成しました' : '変更を保存しました');
      } else if(result?.error!=='cancelled') {
        const error=result?.error||'write-failed';
        if(error==='series-requires-classic'){
          notify('繰り返し系列の削除範囲は、従来画面で指定してください。');return;
        }
        const conflicts=['revision-or-state-mismatch','revision-or-relation-mismatch','conflict','not-found','owner-mismatch'];
        notify(conflicts.includes(error)
          ? '他の端末で内容が更新されたか、利用者・ルームが変わりました。入力内容は保持しています。従来画面で最新状態を確認してください。'
          : error==='invalid-input'||error==='invalid-category'||error==='invalid-tags'
            ? '入力内容を確認してください。'
            : '保存できませんでした。入力内容を残しています。通信状態をご確認ください。');
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
    if(target.dataset.pnEdit){openEditor(target.dataset.pnEdit,target.dataset.id||'',target);return}
    if(target.dataset.pnCopy==='schedule'){openScheduleCopy(target.dataset.id||'',null,target);return}
    if(target.hasAttribute('data-pn-batch-new')){
      const form=drawer.querySelector('[data-pn-form="schedule-editor"]');
      if(!form?.reportValidity())return;
      openScheduleCopy('',scheduleValuesFromForm(form),target);return;
    }
    if(target.hasAttribute('data-pn-copy-back')){
      const editor=state.editor;
      if(editor?.kind==='schedule-batch'){
        const values=editor.sourceValues;
        state.editor={kind:'schedule',id:'',revision:0,
          ownerRoom:editor.ownerRoom,ownerUser:editor.ownerUser};
        drawer.dataset.editor='schedule';
        drawer.innerHTML=scheduleEditorMarkup(null,values);
        drawer.querySelector('[name="title"]')?.focus();
      }else if(editor?.kind==='schedule-copy'){
        const id=editor.id;
        state.editor=null;state.detail={kind:'schedule',id};
        updateDetail();
      }
      return;
    }
    if(target.hasAttribute('data-pn-copy-preview')){
      const form=drawer.querySelector('[data-pn-form="schedule-copy"]');
      if(form)previewScheduleCopy(form);return;
    }
    if(target.hasAttribute('data-pn-day-today')){
      state.selectedDay=currentDate();render();return;
    }
    if(target.dataset.pnWeekShift){
      const shift=Number(target.dataset.pnWeekShift);
      const date=new Date((state.selectedDay||currentDate())+'T12:00:00');
      if(Number.isFinite(shift)&&Math.abs(shift)===7&&!Number.isNaN(date.getTime())){
        date.setDate(date.getDate()+shift);
        state.selectedDay=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+
          '-'+String(date.getDate()).padStart(2,'0');
        render();
      }return;
    }
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
      dispatch({
        type:target.dataset.pnCmd,id:target.dataset.id,
        direction:target.dataset.direction,segment:target.dataset.segment,
        revision:target.dataset.revision,
        ownerUser:state.snapshot.currentUser,ownerRoom:state.snapshot.roomId
      },target);
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
    const editor=state.editor;
    if(editor && form.dataset.pnForm==='schedule-copy'
      && ['schedule-copy','schedule-batch'].includes(editor.kind)) {
      const config=copyConfigFromForm(form);
      if(editor.reviewedKey!==JSON.stringify(config)){
        notify('条件が変更されました。登録前に日付を再プレビューしてください。');return;
      }
      dispatch({
        type:editor.kind==='schedule-batch'?'schedule.batch':'schedule.copy',
        id:editor.id,revision:editor.revision,
        ownerRoom:editor.ownerRoom,ownerUser:editor.ownerUser,
        values:editor.sourceValues,copyConfig:config
      },form.querySelector('[type="submit"]'));
      return;
    }
    if(editor?.kind==='schedule' && form.dataset.pnForm==='schedule-editor'){
      dispatch({
        type:editor.id?'schedule.update':'schedule.create',
        id:editor.id,revision:editor.revision,
        ownerRoom:editor.ownerRoom,ownerUser:editor.ownerUser,
        values:scheduleValuesFromForm(form)
      },form.querySelector('[type="submit"]'));
      return;
    }
    if(editor && form.dataset.pnForm===editor.kind+'-editor') {
      const command={
        type:editor.kind+'.'+(editor.id?'update':'create'),
        id:editor.id,revision:editor.revision,
        ownerRoom:editor.ownerRoom,ownerUser:editor.ownerUser,
        title:String(values.get('title')||''),
        category:String(values.get('category')||''),
        tags:String(values.get('tags')||''),
        pinned:values.has('pinned')
      };
      if(editor.kind==='task')Object.assign(command,{
        assignee:String(values.get('assignee')||''),
        status:String(values.get('status')||''),
        priority:String(values.get('priority')||''),
        dueDate:String(values.get('dueDate')||''),
        dueTime:String(values.get('dueTime')||''),
        requester:String(values.get('requester')||''),
        description:String(values.get('description')||''),
        checklist:String(values.get('checklist')||'')
      });
      else command.body=String(values.get('body')||'');
      dispatch(command,form.querySelector('[type="submit"]'));
    }
  });
  function invalidateCopyReview(form) {
    if(!form || !state.editor || !['schedule-copy','schedule-batch'].includes(state.editor.kind))return;
    state.editor.reviewedKey=null;
    const submit=form.querySelector('[data-pn-copy-submit]');
    if(submit)submit.disabled=true;
    const review=form.querySelector('#pnCopyReview');
    if(review)review.textContent='入力条件が変わりました。もう一度プレビューしてください。';
  }
  root.addEventListener('input',event=>{
    const form=event.target.closest('[data-pn-form="schedule-copy"]');
    if(form)invalidateCopyReview(form);
  });
  root.addEventListener('change',event=>{
    const form=event.target.closest('[data-pn-form="schedule-copy"]');
    if(!form)return;
    if(['method','endMode'].includes(event.target.name))syncCopyFields(form);
    invalidateCopyReview(form);
  });
  root.querySelector('#pnSearch').addEventListener('input',event=>{
    state.query=event.target.value;render();
  });
  root.querySelector('#pnMode').addEventListener('change',event=>{
    const requested=event.target.value;
    if(!modeController?.selectMode){notify('画面切替機能が利用できません');return}
    modeController.selectMode(requested);
    syncMode();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(state.detail||state.editor)&&active()){event.preventDefault();closeDetail()}
  });
  const paletteModeObserver=new MutationObserver(syncMode);
  paletteModeObserver.observe(document.documentElement,{
    attributes:true,attributeFilter:['data-wb-display','data-wb-color-mode','data-wb-color-theme']
  });
  bridge.subscribe(snapshot=>{
    state.snapshot=snapshot;
    if(active())render();
  });
  memoBridge?.subscribe?.(items=>{
    state.memos=items;
    if(active())render();
  });
  // The Palette selector is the only entry. A failed load leaves legacy Palette usable.
  syncMode();
})();
