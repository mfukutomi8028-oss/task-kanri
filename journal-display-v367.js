/* JOURNAL v374: notebook workspace presentation only. Business operations and data are canonical.
   Never clone a view with IDs or establish another Firebase client. */
(function installJournalV367() {
  'use strict';
  if (document.getElementById('wbJournalHeaderV367')) return;

  const root = document.documentElement;
  const body = document.body;
  const main = document.getElementById('mainContent');
  const sidebar = document.querySelector('.sidebar');
  const navigation = sidebar?.querySelector('.nav');
  if (!body || !main || !sidebar || !navigation) return;

  const isJournal = () => root.dataset.wbDisplay === 'journal';
  const routes = [
    { id: 'today', label: '今日', target: '.nav-item[data-layout="today"]' },
    { id: 'todos', label: 'ToDo', target: '.nav-item[data-layout="todos"]' },
    { id: 'tasks', label: 'タスク', target: '.nav-item[data-layout="tasks"]' },
    { id: 'schedule', label: '予定', target: '.nav-item[data-layout="schedule"]' },
    { id: 'memo', label: 'メモ', target: '[data-work-memo-layout]' }
  ];
  const header = document.createElement('header');
  header.id = 'wbJournalHeaderV367';
  header.className = 'wb-journal-header-v367';
  header.innerHTML = [
    '<div class="wb-journal-top-v367">',
      '<div class="wb-journal-identity-v367">',
        '<span class="wb-journal-monogram-v367" aria-hidden="true">J</span>',
        '<div><span class="wb-journal-eyebrow-v367">WORK NOTEBOOK</span>',
        '<h1>JOURNAL</h1></div>',
      '</div>',
      '<div class="wb-journal-date-v367"><span class="wb-journal-date-label-v367"></span></div>',
      '<div class="wb-journal-actions-v367">',
        '<button class="wb-journal-settings-v367" type="button" data-journal-settings aria-expanded="false" aria-controls="wbJournalPreferencesV370">設定・切替 ▾</button>',
        '<div id="wbJournalPreferencesV370" class="wb-journal-preferences-v370" hidden>',
          '<strong class="wb-journal-preferences-heading-v370">表示テーマ</strong>',
          '<div class="wb-journal-skin-v367" role="group" aria-label="手帳デザイン">',
            '<button type="button" data-journal-theme="linen" aria-pressed="true"><span class="wb-journal-theme-thumb-v370" aria-hidden="true"></span>Linen</button>',
            '<button type="button" data-journal-theme="margin" aria-pressed="false"><span class="wb-journal-theme-thumb-v370" aria-hidden="true"></span>Margin</button>',
          '</div>',
          '<button class="wb-journal-open-drawer-v370" type="button" data-journal-open-drawer>画面モード・詳細設定</button>',
        '</div>',
      '</div>',
    '</div>',
    '<div class="wb-journal-navigation-v367">',
      '<nav class="wb-journal-tabs-v367" aria-label="JOURNALのページ"></nav>',
      '<label class="wb-journal-search-v393" role="search">',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.7 4.7"/></svg>',
        '<span class="wb-journal-search-scope-v393" aria-live="polite">今日</span>',
        '<input type="search" id="wbJournalSearchV393" autocomplete="off" aria-label="JOURNAL共通検索" placeholder="手帳を検索">',
        '<button type="button" class="wb-journal-search-clear-v393" data-journal-search-clear aria-label="検索をクリア" hidden>×</button>',
      '</label>',
      '<div class="wb-journal-add-v367">',
        '<button type="button" class="wb-journal-add-toggle-v367" aria-expanded="false" aria-controls="wbJournalCreateMenuV367">＋ 追加</button>',
        '<div id="wbJournalCreateMenuV367" class="wb-journal-create-menu-v367" hidden role="group" aria-label="新しい項目を作成">',
          '<button type="button" data-journal-create="todo">＋ ToDo</button>',
          '<button type="button" data-journal-create="task">＋ タスク</button>',
          '<button type="button" data-journal-create="schedule">＋ 予定</button>',
          '<button type="button" data-journal-create="memo">＋ メモ</button>',
        '</div>',
      '</div>',
    '</div>',
    '<div class="wb-journal-mobile-pages-v367" role="group" aria-label="今日の見開きを切り替える">',
      '<button type="button" data-journal-sheet="left" aria-pressed="true">予定・タスク</button>',
      '<button type="button" data-journal-sheet="right" aria-pressed="false">ToDo・お知らせ</button>',
    '</div>'
  ].join('');
  main.insertAdjacentElement('afterbegin', header);
  sidebar.id = sidebar.id || 'wbJournalSidebarV367';

  const tabs = header.querySelector('.wb-journal-tabs-v367');
  const tabButtons = new Map();
  const dock = document.createElement('nav');
  dock.id = 'wbJournalDockV367';
  dock.className = 'wb-journal-dock-v367';
  dock.setAttribute('aria-label', 'JOURNALモバイルナビ');
  const dockButtons = new Map();


  // Plain stroke paths avoid platform-dependent square/missing-glyph symbols.
  const journalTabIconPathsV412 = Object.freeze({
    today: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><circle cx="12" cy="15" r="2"/>',
    todos: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
    tasks: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M7 3v6M7 9v6M7 15v6"/>',
    schedule: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h7"/>',
    memo: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>'
  });
  function tabIconV412(kind) {
    const mark=document.createElement('span');
    mark.className='j-tab-illustration-v412';
    mark.setAttribute('aria-hidden','true');
    mark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
      +journalTabIconPathsV412[kind]+'</svg>';
    return mark;
  }

  function routeButton(entry, mobile) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.journalRoute = entry.id;
    button.dataset.journalIndex = String(routes.indexOf(entry) + 1).padStart(2,'0');
    button.textContent = entry.label;
    if (!mobile) button.prepend(tabIconV412(entry.id));
    button.setAttribute('aria-label', entry.label + 'ページを表示');
    button.addEventListener('click', () => navigate(entry.id));
    if (mobile) dockButtons.set(entry.id, button);
    else tabButtons.set(entry.id, button);
    return button;
  }
  routes.forEach(entry => tabs.appendChild(routeButton(entry, false)));
  routes.filter(entry => ['today', 'todos', 'tasks', 'schedule', 'memo'].includes(entry.id))
    .forEach(entry => dock.appendChild(routeButton(entry, true)));
  body.appendChild(dock);

  const shade = document.createElement('button');
  shade.id = 'wbJournalShadeV367';
  shade.className = 'wb-journal-shade-v367';
  shade.type = 'button';
  shade.setAttribute('aria-label', '設定メニューを閉じる');
  shade.addEventListener('click', closeDrawer);
  body.appendChild(shade);

  const themeButtons = Array.from(header.querySelectorAll('[data-journal-theme]'));
  const settingsButton = header.querySelector('[data-journal-settings]');
  const preferences = header.querySelector('#wbJournalPreferencesV370');
  const preferencesDrawerButton = header.querySelector('[data-journal-open-drawer]');
  const createToggle = header.querySelector('.wb-journal-add-toggle-v367');
  const createMenu = header.querySelector('#wbJournalCreateMenuV367');
  const globalSearchInputV393 = header.querySelector('#wbJournalSearchV393');
  const globalSearchClearV393 = header.querySelector('[data-journal-search-clear]');
  const globalSearchScopeV393 = header.querySelector('.wb-journal-search-scope-v393');
  const pageButtons = Array.from(header.querySelectorAll('[data-journal-sheet]'));

  // Record shelf: independent paper index over the canonical read/command
  // boundary. No additional caches, Firebase subscriptions or write paths.
  const shelfButton = document.createElement('button');
  shelfButton.type = 'button';
  shelfButton.className = 'j-shelf-launch';
  shelfButton.setAttribute('aria-haspopup','dialog');
  shelfButton.innerHTML = '記録棚 <small data-j-shelf-unread hidden></small>';
  header.querySelector('.wb-journal-actions-v367').prepend(shelfButton);
  const shelf = document.createElement('dialog');
  shelf.id = 'jRecordShelf';
  shelf.className = 'j-shelf';
  shelf.setAttribute('aria-labelledby','jShelfTitle');
  shelf.innerHTML = `<header class="j-shelf-head"><div><small>RECORD SHELF</small><h2 id="jShelfTitle">記録棚</h2></div><button type="button" data-j-shelf-close aria-label="記録棚を閉じる">×</button></header>
    <div class="j-shelf-spread"><nav class="j-shelf-index" aria-label="記録棚の索引">${[['inbox','届いた連絡'],['archive','保管した案件'],['knowledge','手順と知識'],['templates','記入のひな形'],['manage','分類・利用者']].map(([key,label],i)=>`<button type="button" data-j-shelf-page="${key}"><small>0${i+1}</small>${label}</button>`).join('')}</nav>
    <section class="j-shelf-leaf"><header class="j-shelf-leaf-head"><h3></h3><label>このページを検索<input type="search" data-j-shelf-search autocomplete="off"></label></header><div class="j-shelf-controls"></div><p class="j-shelf-summary"></p><p class="j-shelf-feedback" role="status"></p><div class="j-shelf-records"></div></section></div>`;
  body.append(shelf);
  const shelfRecords = shelf.querySelector('.j-shelf-records');
  const shelfSearch = shelf.querySelector('[data-j-shelf-search]');
  const shelfSummary = shelf.querySelector('.j-shelf-summary');
  let shelfPage = 'inbox', shelfQuery = '', shelfUnreadOnly = false, shelfLimit = 40;
  let shelfOwner = '', shelfBusy = false, shelfEditing = null, shelfQueued = false, shelfReturnTask = null;
  const shelfArchiveBases = new Map();
  const shelfInboxBases = new Map();
  const shelfEsc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const shelfSnapshot = () => window.WorkBoardPaletteBridge?.readSnapshot();
  const shelfWorkflow = () => window.WorkBoardWorkflowV152;
  const shelfOwnerKey = snapshot => JSON.stringify([snapshot?.roomId,snapshot?.currentUser]);
  const shelfMatch = values => !shelfQuery || values.join(' ').normalize('NFKC').toLocaleLowerCase().includes(shelfQuery.normalize('NFKC').toLocaleLowerCase());
  const shelfDate = value => Number(value) ? new Date(Number(value)).toLocaleString('ja-JP') : '';
  function shelfMessage(message) { shelf.querySelector('.j-shelf-feedback').textContent = message; }
  function openShelf(page = shelfPage) {
    if (!isJournal() || !shelfSnapshot()) return;
    closeMenu(); closePreferences(); closeDrawer();
    shelfPage = page; shelfOwner = shelfOwnerKey(shelfSnapshot()); shelfMessage('');
    renderShelf();
    if (!shelf.open) shelf.showModal();
    shelf.querySelector('[data-j-shelf-page="'+shelfPage+'"]').focus();
  }
  function closeShelf() {
    shelfEditing = null;
    if (shelf.open) shelf.close();
  }
  function shelfDraftChanged() {
    const form=shelfRecords.querySelector('.j-shelf-knowledge-form');
    if(!shelfEditing || !form)return false;
    return [...new FormData(form)].some(([key,value])=>String(value)!==String(shelfEditing.record[key]||''));
  }
  function renderShelf() {
    if (shelfEditing || shelfBusy) return;
    const snapshot = shelfSnapshot(), workflow = shelfWorkflow();
    if (!snapshot) return;
    shelfArchiveBases.clear(); shelfInboxBases.clear();
    const selected = shelf.querySelector('[data-j-shelf-page="'+shelfPage+'"]');
    shelf.querySelectorAll('[data-j-shelf-page]').forEach(button => {
      if (button === selected) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    shelf.querySelector('.j-shelf-leaf-head h3').textContent = selected?.textContent.slice(2) || '';
    shelfSearch.closest('label').hidden = shelfPage === 'manage';
    const controls = shelf.querySelector('.j-shelf-controls');
    controls.innerHTML = shelfPage === 'inbox' ? `<button type="button" data-j-shelf-unread-filter aria-pressed="${shelfUnreadOnly}">${shelfUnreadOnly?'すべて表示':'未読だけ表示'}</button><button type="button" data-j-shelf-read-all>表示中を既読にする</button>` : '';
    let rows = [], html = '';
    if (shelfPage === 'inbox') {
      rows = Object.entries(workflow?.inboxFor() || {}).map(([id,x])=>({...x,id}))
        .filter(x => (!shelfUnreadOnly || !Number(x.readAt)) && shelfMatch([x.title,x.body,x.actor]))
        .sort((a,b) => Boolean(a.readAt)-Boolean(b.readAt) || Number(b.createdAt)-Number(a.createdAt));
      html = rows.slice(0,shelfLimit).map(x => {
        shelfInboxBases.set(x.id,{...x});
        const exists = snapshot.tasks.some(t=>t.id===x.taskId);
        return `<article class="j-shelf-record ${Number(x.readAt)?'':'is-unread'}" data-shelf-record="${shelfEsc(x.id)}"><div class="j-shelf-record-meta"><span>${Number(x.readAt)?'既読':'未読'} · ${shelfEsc({mention:'メンション',reply:'返信',comment:'コメント',assign:'担当依頼',reaction:'リアクション'}[x.type] || 'お知らせ')}</span><time>${shelfEsc(shelfDate(x.createdAt))}</time></div><h4>${shelfEsc(x.title)}</h4><p>${shelfEsc(x.body)}</p><small>${shelfEsc(x.actor)}</small><div class="j-shelf-record-actions">${exists?`<button type="button" data-j-shelf-task="${shelfEsc(x.taskId)}">案件ノートを開く</button>`:'<small>参照先の案件は現在ありません。</small>'}<button type="button" data-j-shelf-read="${shelfEsc(x.id)}">${Number(x.readAt)?'未読に戻す':'既読にする'}</button></div></article>`;
      }).join('');
      controls.querySelector('[data-j-shelf-read-all]').disabled = ![...shelfInboxBases.values()].some(x=>!Number(x.readAt));
    } else if (shelfPage === 'archive') {
      rows = snapshot.tasks.filter(t => (workflow?.isArchived(t.id) || workflow?.duplicateOf(t.id)) && shelfMatch([t.title,t.description,t.assignee,t.category]));
      rows.sort((a,b)=>Number(workflow.archiveInfo(b.id)?.archivedAt||workflow.duplicateInfo(b.id)?.mergedAt||0)-Number(workflow.archiveInfo(a.id)?.archivedAt||workflow.duplicateInfo(a.id)?.mergedAt||0));
      html = rows.slice(0,shelfLimit).map(t => {
        const info=workflow.archiveInfo(t.id), duplicate=workflow.duplicateInfo(t.id);
        shelfArchiveBases.set(t.id,info?{...info}:null);
        return `<article class="j-shelf-record" data-shelf-record="${shelfEsc(t.id)}"><div class="j-shelf-record-meta"><span>${duplicate?'重複統合':'アーカイブ'}</span><time>${shelfEsc(shelfDate(info?.archivedAt||duplicate?.mergedAt))}</time></div><h4>${shelfEsc(t.title)}</h4><p>${shelfEsc(t.description)}</p><div class="j-shelf-record-actions"><button type="button" data-j-shelf-task="${shelfEsc(duplicate?.targetId || t.id)}">${duplicate?'統合先のノートを開く':'案件ノートを開く'}</button>${duplicate?'':`<button type="button" data-j-shelf-restore="${shelfEsc(t.id)}">一覧へ戻す</button>`}</div></article>`;
      }).join('');
    } else if (shelfPage === 'knowledge') {
      rows = snapshot.knowledge.filter(x=>shelfMatch([x.title,x.summary,x.symptom,x.action,x.checkpoint]));
      html = rows.slice(0,shelfLimit).map(x=>`<article class="j-shelf-record"><h4>${shelfEsc(x.title)}</h4><p>${shelfEsc(x.summary||x.action)}</p><div class="j-shelf-record-actions"><button type="button" data-j-shelf-knowledge="${shelfEsc(x.id)}">手順を読む・編集する</button></div></article>`).join('');
    } else if (shelfPage === 'templates') {
      controls.innerHTML = '<button type="button" data-j-shelf-manager="manageTemplates">ひな形を追加・編集</button>';
      rows = snapshot.templates.filter(x=>shelfMatch([x.name,x.title,x.description,x.category]));
      html = rows.slice(0,shelfLimit).map(x=>`<article class="j-shelf-record"><small>${shelfEsc(x.category)}</small><h4>${shelfEsc(x.name)}</h4><strong>${shelfEsc(x.title)}</strong><p>${shelfEsc(x.description)}</p><div class="j-shelf-record-actions"><button type="button" data-j-shelf-template="${shelfEsc(x.id)}">このひな形でタスクを作成</button></div></article>`).join('');
    } else {
      html = '<p>共有する分類、自分用の状態、利用者を管理します。</p><div class="j-shelf-management">'+[['manageCategories','分類','案件や予定の分類を整理'],['manageStatuses','自分の状態','進み具合と並び順を整理'],['manageUsers','利用者','担当者の追加・変更']].map(([id,label,hint])=>`<button type="button" data-j-shelf-manager="${id}"><strong>${label}</strong><small>${hint}</small><span aria-hidden="true">→</span></button>`).join('')+'</div>';
    }
    shelfRecords.innerHTML = html || `<p class="j-shelf-empty">${shelfQuery || shelfUnreadOnly?'この条件に合う記録はありません。条件を変えるとほかの記録を確認できます。':({inbox:'自分宛ての連絡が届くと、ここに並びます。',archive:'保管した案件はありません。完了案件の詳細からアーカイブできます。',knowledge:'手順はまだありません。案件の詳細からナレッジとして残せます。',templates:'ひな形はありません。'}[shelfPage])}</p>`;
    if(rows.length>shelfLimit)shelfRecords.insertAdjacentHTML('beforeend','<button type="button" data-j-shelf-more>続きを表示</button>');
    shelfSummary.textContent=shelfPage==='manage'?'':`${rows.length}件${rows.length>shelfLimit?' / '+shelfLimit+'件を表示':''}`;
  }
  function queueShelfUpdate() {
    if(shelfQueued)return;
    shelfQueued=true;
    queueMicrotask(()=>{
      shelfQueued=false;
      const snapshot=shelfSnapshot(),owner=shelfOwnerKey(snapshot);
      if(shelfOwner && shelfOwner!==owner){
        closeShelf(); shelfOwner=owner; shelfQuery=''; shelfSearch.value=''; shelfUnreadOnly=false; shelfLimit=40;
      }
      const unread=shelfWorkflow()?.unreadCount() || 0;
      const badge=shelfButton.querySelector('[data-j-shelf-unread]');
      badge.textContent=String(unread);badge.hidden=!unread;
      shelfButton.setAttribute('aria-label','記録棚'+(unread?'・未読'+unread+'件':''));
      if(shelf.open)renderShelf();
    });
  }
  async function shelfWrite(operation, sourceId) {
    if(shelfBusy || shelfOwner!==shelfOwnerKey(shelfSnapshot()))return;
    shelfBusy=true;
    shelf.querySelectorAll('button').forEach(button=>button.disabled=true);
    const top=shelfRecords.scrollTop;
    try {
      const result=await operation();
      if(result?.ok===false || result===false)throw new Error('not-saved');
      shelfBusy=false;renderShelf();
      shelfRecords.scrollTop=top;
      const target=[...shelfRecords.querySelectorAll('[data-shelf-record]')].find(x=>x.dataset.shelfRecord===sourceId);
      (target?.querySelector('[data-j-shelf-read],button') || shelf.querySelector('[data-j-shelf-page="'+shelfPage+'"]')).focus({preventScroll:true});
      shelfMessage('更新しました。');
    } catch(error) { shelfBusy=false;renderShelf();shelfMessage('更新できませんでした。接続と最新の状態を確認して、やり直してください。'); }
    finally { shelfBusy=false;shelf.querySelectorAll('button').forEach(button=>{if(!button.hasAttribute('data-j-shelf-read-all'))button.disabled=false;}); }
  }
  function readShelfKnowledge(id, taskId = '') {
    const snapshot=shelfSnapshot(),task=snapshot.tasks.find(x=>x.id===taskId);
    const record=id?snapshot.knowledge.find(x=>x.id===id):task?{id:'',title:task.title,summary:task.description,symptom:'',action:'',checkpoint:'',revision:0}:null;
    if(!record)return;
    shelfEditing={record:{...record},ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,taskId:task?.id || '',taskRevision:task?.revision};
    shelfSearch.closest('label').hidden=true;
    shelf.querySelector('.j-shelf-controls').innerHTML='';
    shelfRecords.innerHTML=`<form class="j-shelf-knowledge-form"><button type="button" data-j-shelf-back>← 手順の索引へ</button><h4>${shelfEsc(record.title)}</h4>${[['title','件名'],['summary','概要'],['symptom','症状・背景'],['action','対応内容'],['checkpoint','確認事項']].map(([key,label])=>`<label>${label}${['title','action'].includes(key)?'（必須）':''}${key==='title'?`<input name="${key}" maxlength="80" required value="${shelfEsc(record[key])}">`:`<textarea name="${key}" rows="4" maxlength="6000" ${key==='action'?'required':''}>${shelfEsc(record[key])}</textarea>`}</label>`).join('')}<button type="submit">手順を保存</button></form>`;
    shelfMessage('内容を確認し、必要な箇所を編集できます。');
    shelfRecords.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();
      const draft=shelfEditing;if(!draft || shelfBusy)return;
      const form=event.currentTarget,button=form.querySelector('[type="submit"]');
      shelfBusy=true;button.disabled=true;
      const values=Object.fromEntries(new FormData(form));
      try {
        const result=await window.WorkBoardPaletteBridge.dispatch({type:'knowledge.save',id:draft.record.id,revision:draft.record.revision,taskId:draft.taskId,taskRevision:draft.taskRevision,values,ownerRoom:draft.ownerRoom,ownerUser:draft.ownerUser});
        if(!result?.ok){shelfMessage('保存できませんでした。入力を残しています。最新の内容・接続状態を確認してください。');return;}
        shelfEditing=null;shelfBusy=false;renderShelf();shelfMessage('手順を保存しました。');
        shelf.querySelector('[data-j-shelf-page="knowledge"]').focus();
      } catch(error) {shelfMessage('保存できませんでした。入力を残しています。接続状態を確認してください。');}
      finally {shelfBusy=false;if(button.isConnected)button.disabled=false;}
    });
    shelfRecords.querySelector('input').focus();
  }
  shelfButton.addEventListener('click',()=>openShelf());
  shelf.querySelector('[data-j-shelf-close]').addEventListener('click',()=>{
    if(!shelfDraftChanged() || confirm('編集中の手順を保存せずに閉じますか？'))closeShelf();
  });
  shelf.addEventListener('cancel',event=>{
    if(shelfBusy){event.preventDefault();return;}
    if(shelfDraftChanged() && !confirm('編集中の手順を保存せずに閉じますか？'))event.preventDefault();
  });
  shelf.addEventListener('close',()=>{
    shelfEditing=null;
    const origin=shelfReturnTask;shelfReturnTask=null;
    if(!isJournal())return;
    const returned=origin && origin.owner===shelfOwnerKey(shelfSnapshot())
      && window.WorkBoardJournalNavigation?.openTask(origin.id);
    if(!returned)shelfButton.focus({preventScroll:true});
  });
  shelfSearch.addEventListener('input',()=>{shelfQuery=shelfSearch.value;shelfLimit=40;renderShelf();});
  shelf.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button || shelfBusy)return;
    if(button.hasAttribute('data-j-shelf-back')){if(!shelfDraftChanged() || confirm('編集中の手順を保存せずに索引へ戻りますか？')){shelfEditing=null;renderShelf();shelf.querySelector('[data-j-shelf-page="knowledge"]').focus();}return;}
    if(button.dataset.jShelfPage){
      if(shelfDraftChanged() && !confirm('編集中の手順を保存せずにページを移動しますか？'))return;
      shelfEditing=null;shelfMessage('');shelfPage=button.dataset.jShelfPage;shelfQuery='';shelfSearch.value='';shelfLimit=40;renderShelf();return;
    }
    if(button.hasAttribute('data-j-shelf-more')){shelfLimit+=40;renderShelf();return;}
    if(button.hasAttribute('data-j-shelf-unread-filter')){shelfUnreadOnly=!shelfUnreadOnly;renderShelf();shelf.querySelector('[data-j-shelf-unread-filter]').focus();return;}
    const workflow=shelfWorkflow();
    if(button.dataset.jShelfRead){const record=shelfInboxBases.get(button.dataset.jShelfRead);if(record)shelfWrite(()=>workflow.markInboxRead(record.id,!Number(record.readAt),workflow.currentUser(),Number(record.readAt)||0),record.id);return;}
    if(button.hasAttribute('data-j-shelf-read-all')){
      const records=[...shelfInboxBases.values()].filter(x=>!Number(x.readAt)),user=workflow.currentUser(),owner=shelfOwner;
      shelfWrite(async()=>{for(const record of records){if(owner!==shelfOwnerKey(shelfSnapshot()))return false;const result=await workflow.markInboxRead(record.id,true,user,Number(record.readAt)||0);if(result===false||result?.ok===false)return false;}return true;});return;
    }
    if(button.dataset.jShelfRestore){const id=button.dataset.jShelfRestore,base=shelfArchiveBases.get(id);shelfWrite(()=>workflow.unarchiveTask(id,base),id);return;}
    if(button.dataset.jShelfKnowledge){readShelfKnowledge(button.dataset.jShelfKnowledge);return;}
    if(button.dataset.jShelfTask){closeShelf();window.WorkBoardJournalNavigation?.openTask(button.dataset.jShelfTask);return;}
    if(button.dataset.jShelfTemplate){const id=button.dataset.jShelfTemplate;closeShelf();createItem('task');requestAnimationFrame(()=>{const select=document.getElementById('taskTemplate');if(select){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}});return;}
    if(button.dataset.jShelfManager){
      const target=document.getElementById(button.dataset.jShelfManager);if(!target)return;
      const dialogIds={manageTemplates:'templateManageDialog',manageCategories:'categoryManageDialog',manageStatuses:'statusManageDialog',manageUsers:'userManageDialog'};
      const owner=shelfOwner,page=shelfPage,manager=document.getElementById(dialogIds[target.id]);
      manager?.addEventListener('close',()=>{
        if(isJournal() && owner===shelfOwnerKey(shelfSnapshot()))openShelf(page);
      },{once:true});
      closeShelf();target.click();return;
    }
  });
  window.addEventListener('workflow-v152-update',queueShelfUpdate);
  document.addEventListener('click',event=>{
    if(!isJournal())return;
    const target=event.target.closest('[data-open-personal-inbox-v153],[data-open-archive-v153]');
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    openShelf(target.hasAttribute('data-open-archive-v153')?'archive':'inbox');
  },true);
  window.WorkBoardPaletteBridge?.subscribe(queueShelfUpdate);
  new MutationObserver(()=>{if(!isJournal())closeShelf();else queueShelfUpdate();}).observe(root,{attributes:true,attributeFilter:['data-wb-display']});
  queueShelfUpdate();

  // JOURNAL owns only the paper composition. Existing live DOM nodes are MOVED,
  // never cloned: all canonical event listeners, IDs, input state and write paths
  // remain the originals. Uncompose on display-mode exit to restore Classic.
  const journalViewObservers = new WeakSet();
  let journalComposeQueued = false;

  function paperLeaf(name, label) {
    const leaf = document.createElement('section');
    leaf.className = 'j-leaf-v372 j-leaf-' + name + '-v372';
    leaf.setAttribute('aria-label', label);
    return leaf;
  }

  // ToDo two-sheet DOM relocation: replaced by JOURNAL's canonical-data editorial renderer.
  // Recompose task entry and review as two independent folios. Original
  // controls, handlers and data remain canonical; comments preserve order.
  let journalTaskStructureV393 = null;
  function journalRelocateV393(node,destination,record) {
    if (!node || !destination || !node.parentNode) return;
    const marker = document.createComment('journal-ui-original-position');
    node.parentNode.insertBefore(marker,node);
    destination.append(node);
    record.moves.push({marker,node});
  }
  function restoreJournalMovedV393(record) {
    if (!record) return;
    for (const {marker,node} of record.moves) if (marker.parentNode) marker.replaceWith(node);
    for (const extra of record.extras) extra.remove();
  }
  function composeTaskStructureV393(consoleEl) {
    if (!consoleEl || journalTaskStructureV393?.root === consoleEl) return;
    const toolbar = consoleEl.querySelector(':scope > .toolbar');
    const controls = consoleEl.querySelector(':scope > .task-control-row');
    if (!toolbar || !controls) return;
    const record = {root:consoleEl,moves:[],extras:[]};
    // One compact writing row: the previous two full-size folios wasted space
    // and let the original toolbar's grid rules overlap the quick-add field.
    const capture = document.createElement('section');
    capture.className = 'j-task-capture-v393';
    capture.innerHTML = '<span class="j-task-action-label-v396">記入・追加</span>';
    const browse = document.createElement('section');
    browse.className = 'j-task-browse-v393';
    browse.innerHTML = '<label class="j-task-sort-label-v396" for="sortSelect">表示順</label>';
    toolbar.append(capture,browse);
    for (const selector of ['#newTask','.quick-add'])
      journalRelocateV393(toolbar.querySelector(selector),capture,record);
    for (const selector of ['#sortSelect','.search-box'])
      journalRelocateV393(toolbar.querySelector(selector),browse,record);
    const switches = document.createElement('div');
    switches.className = 'j-task-switches-v393';
    const legend = document.createElement('details');
    legend.className = 'j-task-legend-v393';
    legend.innerHTML = '<summary>色の意味</summary>';
    controls.append(switches,legend);
    for (const selector of ['.task-view-switcher','.stat-switcher'])
      journalRelocateV393(controls.querySelector(selector),switches,record);
    journalRelocateV393(controls.querySelector('.task-color-legend'),legend,record);
    record.extras.push(capture,browse,switches,legend);
    journalTaskStructureV393 = record;
  }
  function restoreTaskStructureV393() {
    restoreJournalMovedV393(journalTaskStructureV393);
    journalTaskStructureV393 = null;
  }

  function composeTaskRegister() {
    if (!body.classList.contains('task-mode') && !body.classList.contains('dashboard-mode')) return;
    if (main.querySelector(':scope > .j-task-console-v372')) return;
    const toolbar = main.querySelector(':scope > .toolbar');
    const controls = main.querySelector(':scope > .task-control-row');
    if (!toolbar || !controls) return;
    const consoleEl = document.createElement('section');
    consoleEl.className = 'j-task-console-v372';
    consoleEl.setAttribute('aria-label', 'タスク台帳の操作');
    const heading = document.createElement('header');
    heading.className = 'j-task-title-v372';
    heading.innerHTML = '<span class="j-roman-v372">03 / TASK REGISTER</span><h2>案件台帳</h2>';
    main.insertBefore(consoleEl, toolbar);
    consoleEl.append(heading, toolbar, controls);
    composeTaskStructureV393(consoleEl);
  }

  function restoreTaskRegister() {
    const consoleEl = main.querySelector(':scope > .j-task-console-v372');
    if (!consoleEl) return;
    restoreTaskStructureV393();
    const toolbar = consoleEl.querySelector(':scope > .toolbar');
    const controls = consoleEl.querySelector(':scope > .task-control-row');
    if (toolbar && controls) consoleEl.replaceWith(toolbar, controls);
    else consoleEl.remove();
  }

  // seven-day DOM relocation: replaced by JOURNAL's canonical-data editorial renderer.
  // JOURNAL index is derived from live memo cards: no duplicated data, observers
  // or second write path. Moving the original cards retains their actions.
  let journalMemoSort = 'manual';
  let journalMemoColorV396 = 'all';
  let journalMemoIndexQueryV450 = '';
  let journalMemoIndexOpen = false;
  let journalMemoRefineOpen = false;
  const journalIndexMedia = window.matchMedia('(max-width:760px)');
  journalIndexMedia.addEventListener('change', () => {
    const disclosure = document.querySelector('[data-journal-memo-index]');
    if (disclosure) disclosure.open = !journalIndexMedia.matches || journalMemoIndexOpen;
  });
  const journalMemoClosedGroupsV450 = new Set();
  const memoSortOptions = [
    ['manual', '手動順'], ['updated', '更新順'], ['category', '分類順'], ['title', 'タイトル順']
  ];
  // schedule toolbar relocation: replaced by JOURNAL's canonical-data editorial renderer.
  function sortMemoCards(grid) {
    if (!grid?.classList.contains('work-memo-grid-v167')) return [];
    const cards = [...grid.querySelectorAll(':scope > .work-memo-card-v167')];
    cards.forEach((card, index) => {
      if (!card.hasAttribute('data-journal-original-position')) {
        card.dataset.journalOriginalPosition = String(index);
      }
    });
    const ordered = [...cards].sort((a, b) => {
      const pinned = Number(b.classList.contains('is-pinned')) - Number(a.classList.contains('is-pinned'));
      if (pinned) return pinned;
      if (journalMemoSort === 'updated')
        return Number(b.dataset.memoUpdatedAt || 0) - Number(a.dataset.memoUpdatedAt || 0)
          || Number(a.dataset.journalOriginalPosition) - Number(b.dataset.journalOriginalPosition);
      if (journalMemoSort === 'category')
        return String(a.querySelector('.work-memo-category-v167')?.textContent || '').localeCompare(
          String(b.querySelector('.work-memo-category-v167')?.textContent || ''), 'ja')
          || Number(a.dataset.journalOriginalPosition) - Number(b.dataset.journalOriginalPosition);
      if (journalMemoSort === 'title')
        return String(a.querySelector('h4')?.textContent || '').localeCompare(
          String(b.querySelector('h4')?.textContent || ''), 'ja');
      return Number(a.dataset.journalOriginalPosition) - Number(b.dataset.journalOriginalPosition);
    });
    ordered.forEach(card => grid.appendChild(card));
    return ordered;
  }

  function composeMemoIndex(index, memo) {
    const lastScroll = index.scrollTop;
    index.replaceChildren();
    const state = document.createElement('div');
    state.className = 'j-index-filter-state';
    const status = document.createElement('span');
    status.dataset.journalMemoFilterState = '';
    const clear = document.createElement('button');
    clear.type = 'button'; clear.dataset.journalMemoClear = '';
    clear.textContent = '索引条件を解除';
    clear.addEventListener('click', () => {
      journalMemoIndexQueryV450 = ''; journalMemoColorV396 = 'all';
      composeMemoIndex(index, memo);
      index.querySelector(journalIndexMedia.matches?'[data-journal-memo-index] > summary':'[data-journal-memo-color="all"]')?.focus({preventScroll:true});
    });
    state.append(status, clear);
    const disclosure = document.createElement('details');
    disclosure.dataset.journalMemoIndex = '';
    disclosure.className = 'j-index-disclosure';
    disclosure.open = !journalIndexMedia.matches || journalMemoIndexOpen;
    const summary = document.createElement('summary');
    summary.textContent = '索引・絞り込み';
    disclosure.append(summary);
    disclosure.addEventListener('toggle', () => {
      if (disclosure.isConnected && journalIndexMedia.matches) journalMemoIndexOpen = disclosure.open;
    });
    index.append(state, disclosure);
    const panel = document.createElement('div');
    panel.className = 'j-memo-index-v383';
    const heading = document.createElement('div');
    heading.className = 'j-memo-index-heading-v383';
    const caption = document.createElement('strong');
    caption.textContent = 'メモ索引';
    const allCards = sortMemoCards(memo);
    // Filter live card elements, never duplicate content or memo data.
    // The same selection drives the right-hand notes and the left index.
    const cards = allCards.filter(card => journalMemoColorV396 === 'all'
      || (card.dataset.memoPaperColor || 'ivory') === journalMemoColorV396);
    allCards.forEach(card => card.classList.toggle('j-memo-color-hidden-v396', !cards.includes(card)));
    const count = document.createElement('small');
    count.textContent = cards.length + ' 件';
    heading.append(caption, count);
    panel.append(heading);
    // Search only the paper index, leaving canonical memo cards untouched.
    const finder = document.createElement('input');
    finder.type = 'search';
    finder.className = 'j450-memo-index-find';
    finder.dataset.j450MemoFind = '';
    finder.setAttribute('aria-label','メモ索引内を検索');
    finder.placeholder = '索引内のタイトル・分類を検索';
    finder.value = journalMemoIndexQueryV450;
    const refinement = document.createElement('details');
    refinement.className = 'j-memo-index-refinement';
    refinement.open = journalMemoRefineOpen;
    const refineSummary = document.createElement('summary');
    refineSummary.textContent = '索引だけをさらに絞る';
    refinement.append(refineSummary, finder);
    refinement.addEventListener('toggle', () => {
      if (refinement.isConnected) journalMemoRefineOpen = refinement.open;
    });
    panel.append(refinement);
    const label = document.createElement('label');
    label.className = 'j-memo-index-sort-v383';
    label.textContent = '表示順';
    const selector = document.createElement('select');
    selector.setAttribute('aria-label', '業務メモの並び順');
    for (const [value, name] of memoSortOptions) {
      const option = new Option(name, value);
      selector.append(option);
    }
    selector.value = journalMemoSort;
    selector.addEventListener('change', () => {
      journalMemoSort = selector.value;
      composeMemoIndex(index, memo);
      index.querySelector('.j-memo-index-sort-v383 select')?.focus({preventScroll:true});
    });
    label.append(selector);
    panel.append(label);
    const colorFilters = document.createElement('div');
    colorFilters.className = 'j-memo-color-filters-v396';
    colorFilters.setAttribute('role','group');
    colorFilters.setAttribute('aria-label','付箋の色で絞り込み');
    const colorTitle = document.createElement('strong');
    colorTitle.className = 'j-memo-color-heading-v396';
    colorTitle.textContent = '付箋の色';
    colorFilters.append(colorTitle);
    const options = [{key:'all',label:'すべて'},
      ...(window.WorkBoardMemoSearchBridgeV393?.getPaperColors?.() || [])];
    for (const {key,label:colorName} of options) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'j-memo-color-choice-v396';
      choice.dataset.journalMemoColor = key;
      choice.setAttribute('aria-pressed',String(journalMemoColorV396 === key));
      const total = key === 'all' ? allCards.length
        : allCards.filter(card => (card.dataset.memoPaperColor || 'ivory') === key).length;
      const swatch = document.createElement('span');
      swatch.className = 'j-memo-color-swatch-v396';
      swatch.setAttribute('aria-hidden','true');
      const text = document.createElement('span');
      text.textContent = colorName;
      const qty = document.createElement('small');
      qty.textContent = String(total);
      choice.append(swatch,text,qty);
      choice.addEventListener('click', () => {
        journalMemoColorV396 = key;
        composeMemoIndex(index,memo);
        index.querySelector('[data-journal-memo-color="'+key+'"]')?.focus({preventScroll:true});
      });
      colorFilters.append(choice);
    }
    panel.append(colorFilters);
    // Manual up/down and drag only make sense in manual view.
    index.closest('#workMemoViewV167')?.setAttribute('data-journal-memo-order', journalMemoSort);
    const groups = new Map();
    for (const card of cards) {
      const category = card.querySelector('.work-memo-category-v167')?.textContent?.trim() || 'その他';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(card);
    }
    // The canonical cards remain visible: only the paper index is filtered.
    // Give an actionable explanation when a query or color filter hides all links.
    const empty = document.createElement('div');
    empty.className = 'j-memo-index-empty-v383 j558-memo-index-empty';
    empty.hidden = true;
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    const emptyMessage = document.createElement('p');
    const resetIndex = document.createElement('button');
    resetIndex.type = 'button';
    resetIndex.dataset.j558MemoIndexReset = '';
    resetIndex.textContent = '検索・色の条件を解除';
    resetIndex.addEventListener('click', () => {
      journalMemoIndexQueryV450 = '';
      journalMemoColorV396 = 'all';
      composeMemoIndex(index, memo);
      index.querySelector(journalMemoRefineOpen?'[data-j450-memo-find]':'[data-journal-memo-color="all"]')?.focus({preventScroll:true});
    });
    empty.append(emptyMessage, resetIndex);
    panel.append(empty);
    for (const [category, entries] of groups) {
      const group = document.createElement('details');
      group.className = 'j-memo-index-group-v383';
      group.dataset.journalMemoGroup = category;
      group.open = !journalMemoClosedGroupsV450.has(category);
      const summary = document.createElement('summary');
      summary.className = 'j450-memo-index-summary';
      summary.textContent = category + '  ' + entries.length;
      group.append(summary);
      group.addEventListener('toggle', () => {
        if (group.open) journalMemoClosedGroupsV450.delete(category);
        else journalMemoClosedGroupsV450.add(category);
      });
      const list = document.createElement('ul');
      for (const card of entries) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'j-memo-index-link-v383';
        button.dataset.journalMemoPaper = card.dataset.memoPaperColor || 'ivory';
        button.dataset.journalMemoId = card.dataset.memoSortId || '';
        button.setAttribute('aria-current',String(card.dataset.memoSortId === journalMemoSelectedV425));
        button.textContent = (card.classList.contains('is-pinned') ? '固定｜' : '') +
          (card.querySelector('h4')?.textContent?.trim() || '無題');
        button.addEventListener('click', () => {
          const spread=index.closest('.j425-memo-spread');
          if(spread)selectMemoForReadingV451(spread,card,true);
        });
        item.append(button);
        list.append(item);
      }
      group.append(list);
      panel.append(group);
    }
    const applyIndexQuery = () => {
      journalMemoIndexQueryV450 = finder.value;
      const query = journalMemoIndexQueryV450.normalize('NFKC').trim().toLocaleLowerCase('ja');
      let matched = 0;
      for (const group of panel.querySelectorAll('.j-memo-index-group-v383')) {
        let matching = 0;
        for (const item of group.querySelectorAll('li')) {
          const itemText = item.textContent.normalize('NFKC').toLocaleLowerCase('ja');
          const categoryText = group.dataset.journalMemoGroup.normalize('NFKC').toLocaleLowerCase('ja');
          item.hidden = Boolean(query) && !itemText.includes(query) && !categoryText.includes(query);
          if (!item.hidden) matching++;
        }
        matched += matching;
        group.hidden = Boolean(query) && matching === 0;
        if (query && matching) group.open = true;
      }
      count.textContent = query ? matched + ' / ' + cards.length + ' 件' : cards.length + ' 件';
      const conditions = Number(journalMemoColorV396 !== 'all') + Number(Boolean(query));
      status.textContent = conditions ? '索引の条件：' + conditions + '件適用' : '索引の条件：なし';
      clear.hidden = conditions === 0;
      empty.hidden = matched > 0;
      emptyMessage.textContent = !allCards.length ? '登録されたメモはありません'
        : !cards.length ? '選択した色のメモはありません'
        : '検索に一致するメモはありません';
      resetIndex.hidden = !allCards.length || (!query && journalMemoColorV396 === 'all');
    };
    let composing = false;
    finder.addEventListener('compositionstart',()=>{composing=true;});
    finder.addEventListener('compositionend',()=>{composing=false;applyIndexQuery();});
    finder.addEventListener('input',event=>{if(!composing&&!event.isComposing)applyIndexQuery();});
    disclosure.append(panel);
    applyIndexQuery();
    index.scrollTop = lastScroll;
    const spread=index.closest('.j425-memo-spread');
    if(spread)updateMemoReaderV425(spread);
  }

  // The memo index follows the page using native sticky positioning.
  // No scroll listeners or inline transforms: mobile reflows as normal paper.

  // This UI state only selects which canonical memo card is being read.
  // It is never persisted to shared records or used as an alternate writer.
  let journalMemoSelectedV425 = '';
  // Keep a memo's clip type stable while avoiding adjacent copies on the same page.
  const journalMemoFastenerByIdV430=new Map();

  function memoFastenerV425(card,previousType='') {
    if(card.querySelector(':scope > .j425-memo-fastener'))return '';
    const id=String(card.dataset.memoSortId||''),styles=['binder','clip','pin','tape','washi','corner','grommet','bulldog'];
    const hash=[...id].reduce((acc,ch)=>(acc*31+ch.charCodeAt(0))>>>0,7);
    let type=journalMemoFastenerByIdV430.get(id)||styles[hash%styles.length];
    if(type===previousType&&!journalMemoFastenerByIdV430.has(id))type=styles[(hash+3)%styles.length];
    journalMemoFastenerByIdV430.set(id,type);
    const mark=document.createElement('span');
    mark.className='j425-memo-fastener is-'+type;
    mark.setAttribute('aria-hidden','true');
    // Subtle, stable variation: a memo retains its physical clip position
    // through reordering and recoloring. Only this ephemeral decoration changes.
    const tilt=(((hash>>>8)%7)-3)*2;
    const nudge=(((hash>>>15)%5)-2)*3;
    mark.style.setProperty('--j-fastener-tilt',tilt+'deg');
    mark.style.setProperty('--j-fastener-nudge',nudge+'px');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 64 64');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','./assets/journal-fasteners-v425.svg#'+type);
    svg.append(use);mark.append(svg);card.prepend(mark);
    return type;
  }

  // The original memo cards remain canonical. This only moves focus between
  // a selected paper slip and its read-only reader on stacked layouts.
  function selectMemoForReadingV451(spread, card, fromIndex=false) {
    if (!spread || !card) return;
    journalMemoSelectedV425 = card.dataset.memoSortId;
    const selectedLink=[...spread.querySelectorAll('.j-memo-index-link-v383')]
      .find(link=>link.dataset.journalMemoId===journalMemoSelectedV425);
    const group=selectedLink?.closest('details.j-memo-index-group-v383');
    if(group&&!group.open)group.open=true;
    updateMemoReaderV425(spread);
    if (window.matchMedia('(max-width:1190px)').matches) {
      requestAnimationFrame(() => {
        if (!isJournal() || !spread.isConnected) return;
        const reader=spread.querySelector('.j425-memo-reader');
        reader?.focus({preventScroll:true});
        reader?.scrollIntoView({
          behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',
          block:'start'
        });
      });
    } else if (fromIndex) {
      card.focus({preventScroll:true});
      card.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }

  function updateMemoReaderV425(spread) {
    const grid=spread.querySelector('.work-memo-grid-v167');
    const reader=spread.querySelector('.j425-memo-reader');
    if(!reader)return;
    const cards=[...(grid?.querySelectorAll(':scope > .work-memo-card-v167')||[])].filter(card=>!card.classList.contains('j-memo-color-hidden-v396'));
    // The current color/search may temporarily hide the preferred memo.
    // Show a visible fallback without replacing the remembered selection.
    if(!journalMemoSelectedV425)journalMemoSelectedV425=cards[0]?.dataset.memoSortId||'';
    const card=cards.find(card=>card.dataset.memoSortId===journalMemoSelectedV425)||cards[0];
    const visibleId=card?.dataset.memoSortId||'';
    grid?.querySelectorAll(':scope > .work-memo-card-v167').forEach(el=>{
      el.classList.toggle('j425-memo-selected',el===card);
      el.setAttribute('aria-selected',String(el===card));
    });
    spread.querySelectorAll('.j-memo-index-link-v383').forEach(button =>
      button.setAttribute('aria-current',String(Boolean(card) && button.dataset.journalMemoId === visibleId)));
    reader.replaceChildren();
    const holes=document.createElement('span');
    holes.className='j425-notebook-holes';
    holes.setAttribute('aria-hidden','true');
    reader.append(holes);
    const title=document.createElement('h3');
    const label=document.createElement('span');label.className='j425-reader-kicker';
    const meta=document.createElement('p');meta.className='j425-memo-reader-meta';
    const text=document.createElement('pre');text.className='j425-memo-reader-body';
    const tags=document.createElement('div');tags.className='j425-memo-reader-tags';
    if(!card){
      title.textContent='メモを選択してください';
      label.textContent='MEMO JOURNAL';
      text.textContent='メモを選ぶと、このノートに内容が表示されます。';
      reader.append(label,title,text);return;
    }
    label.textContent=card.querySelector('.work-memo-category-v167')?.textContent||'業務メモ';
    title.textContent=card.querySelector('h4')?.textContent||'無題';
    meta.textContent=card.querySelector('.work-memo-meta-v167')?.textContent||'';
    text.textContent=card.querySelector('.work-memo-body-v167')?.textContent||'';
    [...card.querySelectorAll('.work-memo-tags-v167 > span')].forEach(source=>{
      const tag=document.createElement('span');tag.textContent=source.textContent;tags.append(tag);
    });
    const back=document.createElement('button');
    back.type='button';back.className='j451-memo-back';
    back.textContent='← メモ一覧へ戻る';
    back.addEventListener('click',()=>{
      const target=cards.find(item=>item.dataset.memoSortId===journalMemoSelectedV425);
      if (!target)return;
      target.focus({preventScroll:true});
      target.scrollIntoView({
        behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',
        block:'center'
      });
    });
    const actions=document.createElement('div');actions.className='j425-memo-reader-actions';
    for(const [caption,selector] of [['編集','[data-memo-edit]'],['コピー','[data-memo-copy]'],['タスク化','[data-memo-task]']]){
      const btn=document.createElement('button');btn.type='button';btn.textContent=caption;
      btn.addEventListener('click',()=>card.querySelector(selector)?.click());actions.append(btn);
    }
    // Long memo readers need a return at the end as well as at the heading.
    const footerBack=document.createElement('button');
    footerBack.type='button';footerBack.className='j491-memo-footer-back';
    footerBack.textContent='← メモ一覧へ戻る';
    footerBack.addEventListener('click',()=>back.click());
    reader.append(label,back,title,meta,tags,text,actions,footerBack);
  }

  function composeMemoSheets() {
    const view=document.getElementById('workMemoViewV167');
    if(!view||view.querySelector(':scope > .j-memo-spread-v372'))return;
    const head=view.querySelector(':scope > .work-memo-head-v167');
    const tools=view.querySelector(':scope > .work-memo-tools-v167');
    const memo=view.querySelector(':scope > .work-memo-grid-v167, :scope > .work-memo-empty-v167');
    if(!head||!tools||!memo)return;
    const spread=document.createElement('div');spread.className='j-memo-spread-v372 j425-memo-spread';
    const mast=document.createElement('header');mast.className='j425-memo-masthead';
    const index=paperLeaf('memo-index','メモの索引');index.classList.add('j425-memo-index');
    const gallery=paperLeaf('memo-pages','業務メモの書庫');gallery.classList.add('j425-memo-gallery');
    const reader=document.createElement('aside');reader.className='j425-memo-reader j425-reading-rail';reader.setAttribute('aria-label','選択したメモの本文');reader.tabIndex=-1;
    // One gallery accent: linen and thread. Memo cards keep their own stable fasteners.
    const memoLinen=document.createElement('img');
    memoLinen.className='j442-memo-linen';
    memoLinen.src='./assets/journal-memo-linen-v442.svg';
    memoLinen.alt='';
    memoLinen.decoding='async';
    memoLinen.setAttribute('aria-hidden','true');
    const holes=document.createElement('span');holes.className='j425-notebook-holes';holes.setAttribute('aria-hidden','true');reader.append(holes);
    mast.append(head);gallery.append(tools,memo);
    if(memo.classList.contains('work-memo-grid-v167')){
      let previousFastener='';
      [...memo.querySelectorAll(':scope > .work-memo-card-v167')].forEach(card=>{
        previousFastener=memoFastenerV425(card,previousFastener)||previousFastener;
        card.tabIndex=0;card.setAttribute('role','group');
        card.setAttribute('aria-label',(card.querySelector('h4')?.textContent||'メモ')+'を読む');
      });
      // Delegation is owned by the temporary JOURNAL spread. Removing the spread
      // on mode exit removes these listeners without modifying canonical memo cards.
      const selectCard=card=>selectMemoForReadingV451(spread,card);
      spread.addEventListener('click',event=>{
        const card=event.target.closest('.work-memo-card-v167');
        if(card&&spread.contains(card)&&!event.target.closest('button,select,input,label'))selectCard(card);
      });
      spread.addEventListener('keydown',event=>{
        const card=event.target.closest('.work-memo-card-v167');
        if(card&&event.target===card&&(event.key==='Enter'||event.key===' ')){
          event.preventDefault();selectCard(card);
        }
      });
    }
    gallery.append(memoLinen);
    spread.append(mast,index,gallery,reader);view.append(spread);
    composeMemoIndex(index,memo);
    updateMemoReaderV425(spread);
  }

  function restoreMemoSheets() {
    const view=document.getElementById('workMemoViewV167');
    const spread=view?.querySelector(':scope > .j-memo-spread-v372');
    if(!spread)return;
    const memoGrid=spread.querySelector('.work-memo-grid-v167');
    if(memoGrid){
      [...memoGrid.querySelectorAll(':scope > .work-memo-card-v167')]
        .sort((a,b)=>Number(a.dataset.journalOriginalPosition)-Number(b.dataset.journalOriginalPosition))
        .forEach(card=>{
          card.querySelector(':scope > .j425-memo-fastener')?.remove();
          card.classList.remove('j-memo-color-hidden-v396','j425-memo-selected');
          card.removeAttribute('tabindex');card.removeAttribute('role');card.removeAttribute('aria-label');card.removeAttribute('aria-selected');
          delete card.dataset.journalOriginalPosition;memoGrid.append(card);
        });
    }
    view.removeAttribute('data-journal-memo-order');
    for(const node of [spread.querySelector('.work-memo-head-v167'),spread.querySelector('.work-memo-tools-v167'),spread.querySelector('.work-memo-grid-v167, .work-memo-empty-v167')]){
      if(node)view.append(node);
    }
    spread.remove();
    journalMemoIndexQueryV450 = '';
    journalMemoClosedGroupsV450.clear();
  }

  function restoreJournalComposition() {
    restoreMemoSheets();
    restoreTaskRegister();
  }

  function composeJournalComposition() {
    if (!isJournal()) return;
    const mode = canonicalRoute();
    if (mode === 'memo') {
      restoreTaskRegister();
      composeMemoSheets();
    } else if (mode === 'today') {
      restoreTaskRegister();
      // Today uses its own canonical-data diary renderer in app.js.
    } else if (mode === 'todos') {
      restoreTaskRegister();
    } else if (mode === 'schedule') {
      restoreTaskRegister();
    } else if (mode === 'tasks' || body.classList.contains('dashboard-mode')) {
      composeTaskRegister();
    } else {
      restoreTaskRegister();
    }
  }

  function requestJournalCompose() {
    if (!isJournal() || journalComposeQueued) return;
    journalComposeQueued = true;
    queueMicrotask(() => {
      journalComposeQueued = false;
      composeJournalComposition();
      syncGlobalSearchV393();
    });
  }

  function watchJournalViews() {
    for (const id of ['todayView', 'todoView', 'scheduleView', 'workMemoViewV167']) {
      const view = document.getElementById(id);
      if (!view || journalViewObservers.has(view)) continue;
      journalViewObservers.add(view);
      new MutationObserver(requestJournalCompose).observe(view, {
        childList: true, attributes: true, attributeFilter: ['hidden']
      });
    }
  }
  watchJournalViews();
  new MutationObserver(() => {
    watchJournalViews();
    requestJournalCompose();
  }).observe(main, {childList:true});


  let menuOpen = false;
  let drawerOpen = false;
  let preferencesOpen = false;
  let lastFocus = null;
  let currentRoute = '';
  let queued = false;

  function storageKey() {
    let room = 'default';
    let user = '';
    try {
      room = new URLSearchParams(location.search).get('room')
        || localStorage.getItem('systemTaskRoomId') || 'default';
      user = localStorage.getItem('systemTaskUser') || '';
    } catch { /* A restricted storage context still has a visual session. */ }
    const cleanRoom = String(room).replace(/[.#$/\[\]]/g, '-').slice(0, 60);
    return 'workBoardJournalThemeV367:' + encodeURIComponent(cleanRoom)
      + ':' + encodeURIComponent(String(user));
  }

  function loadTheme() {
    try {
      return localStorage.getItem(storageKey()) === 'margin' ? 'margin' : 'linen';
    } catch { return 'linen'; }
  }

  function applyTheme(theme, save) {
    const next = theme === 'margin' ? 'margin' : 'linen';
    root.dataset.wbJournalTheme = next;
    themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.journalTheme === next)));
    sidebar.querySelectorAll('[data-journal-book-theme]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.journalBookTheme === next)));
    if (save) {
      try { localStorage.setItem(storageKey(), next); } catch { /* Session-only theme. */ }
    }
  }

  function dateLabel() {
    const value = new Date();
    header.querySelector('.wb-journal-date-label-v367').textContent =
      value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }

  function canonicalRoute() {
    // The canonical app switches body modes before rendering; a stale sidebar
    // selection must not override the active view during route transitions.
    if (body.classList.contains('work-memo-mode-v167')) return 'memo';
    if (body.classList.contains('todo-mode')) return 'todos';
    if (body.classList.contains('dashboard-mode')) return 'dashboard';
    if (body.classList.contains('task-mode')) return 'tasks';
    if (body.classList.contains('schedule-mode')) return 'schedule';
    if (body.classList.contains('today-mode')) return 'today';
    const selected = navigation.querySelector('.nav-item.active[data-layout], .nav-item.active[data-work-memo-layout]');
    return selected?.hasAttribute('data-work-memo-layout') ? 'memo' : (selected?.dataset.layout || 'today');
  }

  // One visible search per JOURNAL, with the current page as its scope.
  // The current page's *original* filter owner does the actual filtering.
  // That keeps search behaviour, permissions and persistence in one place.
  const globalSearchDefaultsV393 = Object.freeze({
    today:'今日の記録', todos:'ToDo・個人メモ',tasks:'タスク',
    schedule:'予定',memo:'業務メモ'
  });
  let journalSearchActiveV393 = false;
  let journalSearchQueryV393 = '';
  let journalSearchComposingV393 = false;
  let journalSearchBaselineV393 = null;
  function journalSearchOwnersV393() {
    // Canonical adapters expose getQuery/setQuery; JOURNAL's paper ToDo
    // additionally owns a transient visible search input. No data is copied.
    const todoBridge = window.WorkBoardTodoSearchBridgeV393;
    const memoBridge = window.WorkBoardMemoSearchBridgeV393;
    return {
      task:{
        get: () => document.getElementById('searchInput')?.value || '',
        set: value => {
          const input = document.getElementById('searchInput');
          if (!input || input.value === value) return;
          input.value = value;
          input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      },
      todos:{
        get: () => document.querySelector('#todoView [data-j425-todo-search]')?.value
          ?? todoBridge?.getQuery?.() ?? '',
        set: value => {
          const input = document.querySelector('#todoView [data-j425-todo-search]');
          if (input && input.value !== value) {
            input.value = value;
            input.dispatchEvent(new Event('input',{bubbles:true}));
          }
          if (todoBridge?.getQuery?.() !== value) todoBridge?.setQuery?.(value);
        }
      },
      memo:{
        get: () => memoBridge?.getQuery?.() || '',
        set: value => memoBridge?.setQuery?.(value)
      }
    };
  }
  function journalSearchKindV393(route) {
    if (route === 'tasks' || route === 'schedule' || route === 'dashboard') return 'task';
    if (route === 'todos') return 'todos';
    if (route === 'memo') return 'memo';
    return null;
  }
  function clearJournalTodaySearchV393() {
    document.querySelectorAll('#todayView .j-search-excluded-v393')
      .forEach(node => node.classList.remove('j-search-excluded-v393'));
  }
  function applyJournalTodaySearchV393() {
    const view = document.getElementById('todayView');
    if (!view) return;
    const query = journalSearchQueryV393.normalize('NFKC').trim().toLocaleLowerCase('ja');
    for (const card of view.querySelectorAll(
      '.j420-work-note,.j420-agenda-item,.j420-todo-item,.j420-update-item,.j420-waiting-item')) {
      const text = (card.textContent || '').normalize('NFKC').toLocaleLowerCase('ja');
      card.classList.toggle('j-search-excluded-v393', Boolean(query) && !text.includes(query));
    }
    // A matching record must stay reachable even when it is in the folded
    // second half of today's cases. Keep it expanded after clearing, so the
    // record the person just found does not disappear again.
    const more = view.querySelector('[data-journal-today-more]');
    if (query && more?.querySelector('.j420-work-note:not(.j-search-excluded-v393)')) more.open = true;
  }
  function activateJournalSearchV393() {
    if (journalSearchActiveV393) return;
    journalSearchActiveV393 = true;
    const owners = journalSearchOwnersV393();
    journalSearchBaselineV393 = Object.fromEntries(
      ['task','todos','memo'].map(key => [key, owners[key]?.get?.() ?? '']));
    journalSearchQueryV393 = '';
    globalSearchInputV393.value = '';
    globalSearchClearV393.hidden = true;
  }
  function syncGlobalSearchV393() {
    if (!isJournal()) return;
    activateJournalSearchV393();
    const route = currentRoute || canonicalRoute();
    const scope = globalSearchDefaultsV393[route] || '手帳';
    globalSearchScopeV393.textContent = scope;
    globalSearchInputV393.setAttribute('aria-label', scope + 'を検索（タブ共通キーワード）');
    globalSearchInputV393.placeholder = scope + 'を検索（タブ共通）';
    globalSearchClearV393.hidden = !journalSearchQueryV393;
    if (route === 'today') {
      applyJournalTodaySearchV393();
      return;
    }
    clearJournalTodaySearchV393();
    const key = journalSearchKindV393(route);
    const owner = journalSearchOwnersV393()[key];
    if (owner?.get?.() !== journalSearchQueryV393) owner?.set?.(journalSearchQueryV393);
  }
  function restoreJournalSearchV393() {
    if (!journalSearchActiveV393) return;
    clearJournalTodaySearchV393();
    journalSearchActiveV393 = false;
    const originals = journalSearchBaselineV393 || {};
    journalSearchBaselineV393 = null;
    journalSearchQueryV393 = '';
    globalSearchInputV393.value = '';
    globalSearchClearV393.hidden = true;
    const owners = journalSearchOwnersV393();
    for (const key of ['task','todos','memo']) {
      if (typeof owners[key]?.set === 'function')
        owners[key].set(String(originals[key] || ''));
    }
  }
  function updateJournalSearchV393() {
    if (!isJournal()) return;
    journalSearchQueryV393 = globalSearchInputV393.value;
    syncGlobalSearchV393();
  }
  globalSearchInputV393.addEventListener('compositionstart', () => {
    journalSearchComposingV393 = true;
  });
  globalSearchInputV393.addEventListener('compositionend', () => {
    journalSearchComposingV393 = false;
    updateJournalSearchV393();
  });
  globalSearchInputV393.addEventListener('input', event => {
    if (!journalSearchComposingV393 && !event.isComposing) updateJournalSearchV393();
  });
  globalSearchInputV393.addEventListener('search', () => {
    if (!journalSearchComposingV393) updateJournalSearchV393();
  });
  globalSearchClearV393.addEventListener('click', () => {
    globalSearchInputV393.value = '';
    updateJournalSearchV393();
    globalSearchInputV393.focus({preventScroll:true});
  });

  // Local notebook searches share the same query as JOURNAL's global search.
  // Capture before the canonical input handler redraws a paper page. Otherwise
  // a scheduled global-sync frame can restore the previous route's query.
  const journalLocalSearchSelectorV492 = [
    '#boardView [data-j420-search]',
    '#todoView [data-j425-todo-search]',
    '#scheduleView [data-j425-schedule-query]'
  ].join(',');
  const journalLocalSearchComposingV492 = new WeakSet();
  function journalLocalSearchInputV492(event) {
    const input=event.target;
    return input?.matches?.(journalLocalSearchSelectorV492) ? input : null;
  }
  function syncJournalLocalSearchV492(input) {
    if(!isJournal()) return;
    activateJournalSearchV393();
    const query=input.value;
    if(journalSearchQueryV393===query && globalSearchInputV393.value===query) return;
    journalSearchQueryV393=query;
    globalSearchInputV393.value=query;
    globalSearchClearV393.hidden=!query;
    // Filtering still belongs to the canonical page that emitted the input.
    // Do not dispatch a second input event or create a second data store.
  }
  document.addEventListener('compositionstart',event=>{
    const input=journalLocalSearchInputV492(event);
    if(input && isJournal()) journalLocalSearchComposingV492.add(input);
  },true);
  document.addEventListener('compositionend',event=>{
    const input=journalLocalSearchInputV492(event);
    if(!input) return;
    journalLocalSearchComposingV492.delete(input);
    syncJournalLocalSearchV492(input);
  },true);
  document.addEventListener('input',event=>{
    const input=journalLocalSearchInputV492(event);
    if(input && !event.isComposing && !journalLocalSearchComposingV492.has(input))
      syncJournalLocalSearchV492(input);
  },true);

  function syncNavigation() {
    queued = false;
    if (!isJournal()) return;
    const canonical = canonicalRoute();
    currentRoute = canonical === 'dashboard' ? 'tasks' : canonical;
    for (const [id, button] of [...tabButtons, ...dockButtons]) {
      const route = routes.find(entry => entry.id === id);
      const found = Boolean(sidebar.querySelector(route.target));
      button.disabled = !found;
      if (currentRoute === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    body.dataset.journalRoute = currentRoute;
    requestJournalCompose();
    requestAnimationFrame(syncGlobalSearchV393);
  }

  function scheduleSync() {
    if (queued) return;
    queued = true;
    queueMicrotask(syncNavigation);
  }

  function navigate(id) {
    if (!isJournal()) return;
    const route = routes.find(item => item.id === id);
    const target = route && sidebar.querySelector(route.target);
    if (!target) return;
    target.click();
    // Entering Tasks through JOURNAL always opens the image-matched atelier.
    // Alternate Index/Chronicle views remain available from its own toolbar.
    if (id === 'tasks') {
      const board = main.querySelector('.task-view-switcher [data-task-layout="board"]');
      if (board && board.getAttribute('aria-pressed') !== 'true') board.click();
    }
    closeMenu();
    closePreferences();
    closeDrawer();
    body.dataset.journalSheet = 'left';
    syncPages();
    requestJournalCompose();
    requestAnimationFrame(requestJournalCompose);
    scheduleSync();
  }

  function syncPages() {
    const side = body.dataset.journalSheet === 'right' ? 'right' : 'left';
    pageButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.journalSheet === side)));
  }

  function onEscape(event) {
    if (event.key !== 'Escape') return;
    if (drawerOpen) {
      event.preventDefault();
      closeDrawer();
    } else if (menuOpen) {
      event.preventDefault();
      closeMenu();
      createToggle.focus();
    } else if (preferencesOpen) {
      event.preventDefault();
      closePreferences();
      settingsButton.focus();
    }
  }

  // A real settings notebook: move the ORIGINAL controls into categorized leaves.
  // All controls keep their listeners and IDs, and return to their exact
  // original positions before Classic, Modern or Palette is displayed.
  let journalSettingsRecordV393 = null;
  function composeJournalSettingsV393() {
    if (journalSettingsRecordV393 || !isJournal()) return;
    const record = {moves:[],book:null};
    function move(node, destination) {
      if (!node || !destination || !node.parentNode) return;
      const marker = document.createComment('journal-settings-original-position');
      node.parentNode.insertBefore(marker,node);
      destination.append(node);
      record.moves.push({node,marker});
    }
    const book = document.createElement('section');
    book.id = 'jSettingsBookV393';
    book.className = 'j-settings-book-v393';
    book.setAttribute('aria-label','JOURNAL 設定の手帳');
    book.innerHTML = [
      '<header class="j-settings-book-head-v393">',
        '<span>PERSONAL NOTEBOOK / SETTINGS</span>',
        '<h2>手帳の設定</h2>',
        '<p>表示デザインと利用者・共有を整理しました。</p>',
        '<button type="button" class="j-settings-book-close-v393" aria-label="設定を閉じる">×</button>',
      '</header>',
      '<nav class="j-settings-book-tabs-v393" role="tablist" aria-label="設定ページ">',
        '<button type="button" role="tab" data-journal-settings-tab="display" aria-controls="jSettingsDisplayV393" aria-selected="true">01 表示</button>',
        '<button type="button" role="tab" data-journal-settings-tab="personal" aria-controls="jSettingsPersonalV393" aria-selected="false">02 利用者・共有</button>',
      '</nav>',
      '<section id="jSettingsDisplayV393" class="j-settings-book-page-v393" role="tabpanel" data-journal-settings-page="display">',
        '<div class="j-settings-leaf-heading-v393"><small>DESIGN</small><h3>画面デザイン</h3><p>どの画面でも同じ業務データを使います。</p></div>',
        '<div class="j-settings-mode-slot-v393"></div>',
        '<div class="j-settings-leaf-heading-v393"><small>NOTEBOOK STYLE</small><h3>JOURNALの紙面</h3><p>使い方に合わせて、帳面かルーズリーフを選べます。</p></div>',
        '<div class="j-settings-theme-grid-v393" role="group" aria-label="JOURNALの紙面">',
          '<button type="button" data-journal-book-theme="linen" aria-pressed="true"><span class="j-settings-theme-swatch-v393" aria-hidden="true"></span><strong>Linen</strong><small>綴じた見開き・整った罫線</small></button>',
          '<button type="button" data-journal-book-theme="margin" aria-pressed="false"><span class="j-settings-theme-swatch-v393" aria-hidden="true"></span><strong>Margin</strong><small>リング・付箋・自由な余白</small></button>',
        '</div>',
      '</section>',
      '<section id="jSettingsPersonalV393" class="j-settings-book-page-v393" role="tabpanel" data-journal-settings-page="personal" hidden>',
        '<div class="j-settings-leaf-heading-v393"><small>PEOPLE & ROOM</small><h3>利用者・共有</h3><p>現在の利用者、共有ルーム、接続情報を確認できます。</p></div>',
        '<div class="j-settings-personal-slot-v393"></div>',
      '</section>'
    ].join('');
    const display = sidebar.querySelector('#wbDisplayChoiceV356');
    const user = sidebar.querySelector('.side-card.user-card');
    move(display,book.querySelector('.j-settings-mode-slot-v393'));
    move(user,book.querySelector('.j-settings-personal-slot-v393'));
    const personal = book.querySelector('.j-settings-personal-slot-v393');
    for (const selector of ['#connectionPill','.app-version']) {
      move(sidebar.querySelector(':scope > ' + selector),personal);
    }
    sidebar.prepend(book);
    record.book = book;
    journalSettingsRecordV393 = record;

    function showTab(key) {
      book.querySelectorAll('[data-journal-settings-tab]').forEach(button => {
        const selected = button.dataset.journalSettingsTab === key;
        button.setAttribute('aria-selected',String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      book.querySelectorAll('[data-journal-settings-page]').forEach(page => {
        page.hidden = page.dataset.journalSettingsPage !== key;
      });
    }
    book.querySelectorAll('[data-journal-settings-tab]').forEach(button => {
      button.addEventListener('click', () => showTab(button.dataset.journalSettingsTab));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...book.querySelectorAll('[data-journal-settings-tab]')];
        const index = tabs.indexOf(button);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length)%tabs.length;
        tabs[next].click();
        tabs[next].focus();
      });
    });
    book.querySelector('.j-settings-book-close-v393').addEventListener('click',closeDrawer);
    book.querySelectorAll('[data-journal-book-theme]').forEach(button =>
      button.addEventListener('click', () => applyTheme(button.dataset.journalBookTheme,true)));
    applyTheme(loadTheme(),false);
  }
  function restoreJournalSettingsV393() {
    const record = journalSettingsRecordV393;
    if (!record) return;
    for (const {marker,node} of record.moves) if (marker.parentNode) marker.replaceWith(node);
    record.book.remove();
    journalSettingsRecordV393 = null;
  }

  function openDrawer() {
    if (!isJournal() || drawerOpen) return;
    closeMenu();
    closePreferences();
    composeJournalSettingsV393();
    drawerOpen = true;
    lastFocus = document.activeElement;
    body.dataset.journalSettingsOpen = 'true';
    document.addEventListener('keydown', onEscape);
    sidebar.querySelector('[data-journal-settings-tab="display"]')?.focus();
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    body.dataset.journalSettingsOpen = 'false';
    settingsButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onEscape);
    const restoreTarget = lastFocus?.closest?.('#wbJournalPreferencesV370')
      ? settingsButton : lastFocus;
    if (restoreTarget && typeof restoreTarget.focus === 'function') restoreTarget.focus();
    lastFocus = null;
  }

  function outsidePreferences(event) {
    if (!header.querySelector('.wb-journal-actions-v367')?.contains(event.target)) closePreferences();
  }

  function openPreferences() {
    if (!isJournal() || preferencesOpen) return;
    closeMenu();
    closeDrawer();
    preferencesOpen = true;
    preferences.hidden = false;
    settingsButton.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outsidePreferences, true);
    document.addEventListener('keydown', onEscape);
    preferences.querySelector('[aria-pressed="true"]')?.focus();
  }

  function closePreferences() {
    if (!preferencesOpen) return;
    preferencesOpen = false;
    preferences.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outsidePreferences, true);
    document.removeEventListener('keydown', onEscape);
  }

  function outsideCreate(event) {
    if (!header.querySelector('.wb-journal-add-v367')?.contains(event.target)) closeMenu();
  }

  function openMenu() {
    if (!isJournal() || menuOpen) return;
    closeDrawer();
    closePreferences();
    menuOpen = true;
    createMenu.hidden = false;
    createToggle.setAttribute('aria-expanded', 'true');
    const memo = createMenu.querySelector('[data-journal-create="memo"]');
    memo.disabled = !sidebar.querySelector('[data-work-memo-layout]');
    document.addEventListener('pointerdown', outsideCreate, true);
    document.addEventListener('keydown', onEscape);
    createMenu.querySelector('button:not([disabled])')?.focus();
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    createMenu.hidden = true;
    createToggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outsideCreate, true);
    document.removeEventListener('keydown', onEscape);
  }

  function createItem(kind) {
    closeMenu();
    if (kind === 'task') {
      document.getElementById('newTask')?.click();
      return;
    }
    if (kind === 'todo') {
      navigate('todos');
      requestAnimationFrame(() => document.getElementById('todayTodoInput')?.focus());
      return;
    }
    if (kind === 'schedule') {
      navigate('schedule');
      requestAnimationFrame(() => document.querySelector('#scheduleView [data-new-schedule]')?.click());
      return;
    }
    if (kind === 'memo') {
      navigate('memo');
      requestAnimationFrame(() => document.querySelector('#workMemoViewV167 [data-memo-new]')?.click());
    }
  }


  // Ver.385: dedicated notebook editors; the actual form controls and all
  // canonical submit, validation and concurrency handlers remain unchanged.
  // Move original DOM nodes, never clone fields or establish another writer.
  const journalEntryRecordsV385 = new Map();
  const journalEntrySpecsV385 = Object.freeze({
    taskDialog: {
      kind: 'task', number: '01', kicker: 'TASK RECORD', lead: '案件・日程・記録を、手帳のページごとに整理して記入します。',
      grid: '.form-grid',
      pages: [
        { key:'core', name:'基本情報', hint:'件名・担当者・進捗', ids:['taskTitle','taskAssignee','taskStatus','taskPriority','taskCategory','taskRequester'] },
        { key:'dates', name:'日程と繰り返し', hint:'開始日・期限・繰り返し条件', ids:['taskStartDateV167','taskDueDate','taskDueTime','taskRecurrence','recurrenceOptions'] },
        { key:'notes', name:'作業記録', hint:'内容・タグ・チェックリスト', ids:['taskTags','taskDescription','taskChecklist'] }
      ]
    },
    scheduleDialog: {
      kind: 'schedule', number: '02', kicker: 'APPOINTMENT', lead: '日時を先に確定し、担当・場所・準備メモを記録します。',
      grid: '.form-grid',
      pages: [
        { key:'time', name:'予定と日時', hint:'件名・開始・終了', ids:['scheduleTitle','scheduleStart','scheduleEnd'] },
        { key:'people', name:'担当と場所', hint:'担当・分類・関連タスク', ids:['scheduleAssignee','scheduleLocation','scheduleCategory','scheduleRelatedTask'] },
        { key:'notes', name:'当日の控え', hint:'目的・持ち物・連絡事項', ids:['scheduleMemo'] }
      ]
    }
  });

  function journalEntryHeaderV385(dialog, spec, record) {
    const titleHost = dialog.querySelector('.dialog-head > div');
    if (!titleHost) return;
    const kicker = document.createElement('p');
    kicker.className = 'j-entry-overline-v385';
    kicker.textContent = spec.number + ' / ' + spec.kicker;
    titleHost.prepend(kicker);
    const lead = document.createElement('p');
    lead.className = 'j-entry-lead-v385';
    lead.textContent = spec.lead;
    titleHost.append(lead);
    record.extras.push(kicker, lead);
  }

  function journalEntryMoveV385(node, destination, record) {
    const marker = document.createComment('journal-input-original-position');
    node.parentNode.insertBefore(marker, node);
    destination.append(node);
    record.moves.push({marker, node});
  }

  function journalEntryCreatePageV385(spec, page, position, record) {
    const leaf = document.createElement('section');
    leaf.className = 'j-entry-leaf-v385';
    leaf.dataset.journalEntryPage = page.key;
    leaf.id = 'j-entry-' + spec.kind + '-' + page.key;
    const heading = document.createElement('div');
    heading.className = 'j-entry-leaf-title-v385';
    const number = document.createElement('span');
    number.className = 'j-entry-leaf-number-v385';
    number.textContent = String(position + 1).padStart(2, '0');
    const label = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = page.name;
    const note = document.createElement('p');
    note.textContent = page.hint;
    label.append(title, note);
    heading.append(number, label);
    const fields = document.createElement('div');
    fields.className = 'j-entry-fields-v385';
    leaf.append(heading, fields);
    record.extras.push(leaf);
    return {leaf, fields};
  }

  // Sticky within a <dialog> that itself scrolls is constrained by its CSS
  // grid row. Translate the live index by the dialog scroll offset instead:
  // it remains beside every leaf, including the final submit controls.
  function followJournalEntryOutlineV393(dialog, outline, record) {
    let animationFrame = 0;
    const update = () => {
      animationFrame = 0;
      if (!dialog.open || !isJournal()) return;
      if (window.matchMedia('(max-width:820px)').matches) {
        outline.style.transform = '';
        return;
      }
      outline.style.transform = 'translate3d(0,' + Math.max(0,dialog.scrollTop) + 'px,0)';
    };
    const schedule = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(update);
    };
    dialog.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    record.refreshOutlineV393 = schedule;
    record.listeners.push(() => {
      dialog.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      outline.style.transform = '';
    });
    schedule();
  }

  function journalEntryDecorateV385(dialog, spec) {
    if (journalEntryRecordsV385.has(dialog)) return;
    const form = dialog.querySelector('form');
    const grid = form?.querySelector(':scope > ' + spec.grid);
    if (!form || !grid) return;
    const record = { moves:[], extras:[], listeners:[], dialog, form, grid };
    journalEntryRecordsV385.set(dialog, record);
    dialog.classList.add('j-entry-dialog-v385', 'j-entry-' + spec.kind + '-v385');
    form.classList.add('j-entry-form-v385');
    grid.classList.add('j-entry-content-v385');
    journalEntryHeaderV385(dialog, spec, record);

    const outline = document.createElement('nav');
    outline.className = 'j-entry-outline-v385';
    outline.setAttribute('aria-label', '入力ページの索引');
    const outlineTitle = document.createElement('strong');
    outlineTitle.className = 'j-entry-outline-heading-v385';
    outlineTitle.textContent = '記入するページ';
    outline.append(outlineTitle);
    const leaves = spec.pages.map((page,index) => journalEntryCreatePageV385(spec, page, index, record));
    const buttons = [];
    function markPage(key) {
      for (const button of buttons) {
        const active = button.dataset.journalEntryJump === key;
        button.setAttribute('aria-current', active ? 'step' : 'false');
      }
    }
    spec.pages.forEach((page, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.journalEntryJump = page.key;
      const ordinal = document.createElement('span');
      ordinal.textContent = String(index + 1).padStart(2, '0');
      const caption = document.createElement('span');
      caption.textContent = page.name;
      button.append(ordinal, caption);
      button.addEventListener('click', () => {
        markPage(page.key);
        leaves[index].leaf.scrollIntoView({behavior:'smooth', block:'start'});
      });
      outline.append(button);
      buttons.push(button);
      grid.append(leaves[index].leaf);
    });
    markPage(spec.pages[0].key);
    const tip = document.createElement('p');
    tip.className = 'j-entry-outline-note-v385';
    tip.textContent = '記入内容はこのまま保存できます。入力欄と保存処理は従来と共通です。';
    outline.append(tip);
    grid.parentNode.insertBefore(outline, grid);
    record.extras.push(outline);
    followJournalEntryOutlineV393(dialog,outline,record);

    const activeBefore = dialog.contains(document.activeElement) ? document.activeElement : null;
    const originals = [...grid.children].filter(node => !node.classList.contains('j-entry-leaf-v385'));
    for (const node of originals) {
      const index = spec.pages.findIndex(page => page.ids.some(id => node.id === id || node.querySelector('#' + id)));
      journalEntryMoveV385(node, leaves[index < 0 ? leaves.length - 1 : index].fields, record);
    }
    const onFocus = event => {
      const page = event.target.closest?.('[data-journal-entry-page]');
      if (page) markPage(page.dataset.journalEntryPage);
    };
    grid.addEventListener('focusin', onFocus);
    record.listeners.push(() => grid.removeEventListener('focusin', onFocus));
    // Reparenting a focused input can blur it in Chromium.
    if (activeBefore?.isConnected) requestAnimationFrame(() => {
      if (dialog.open && isJournal()) activeBefore.focus({preventScroll:true});
    });
  }

  function journalMemoEditorV385(dialog) {
    if (journalEntryRecordsV385.has(dialog)) return;
    const form = dialog.querySelector('form');
    const grid = form?.querySelector(':scope > .work-memo-form-grid-v167');
    const title = form?.querySelector('#workMemoTitleV167');
    const bodyField = form?.querySelector('#workMemoBodyV167');
    if (!form || !grid || !title || !bodyField) return;
    const record = {moves:[],extras:[],listeners:[],dialog,form,grid};
    journalEntryRecordsV385.set(dialog, record);
    dialog.classList.add('j-entry-dialog-v385','j-entry-memo-v385');
    form.classList.add('j-entry-form-v385');
    journalEntryHeaderV385(dialog, {
      number:'03', kicker:'REFERENCE LEAF',
      lead:'白い記入面に内容を書き、付箋色・分類で整理します。'
    }, record);

    const pages = document.createElement('div');
    pages.className = 'j-entry-memo-pages-v385';
    const mainLeaf = document.createElement('section');
    mainLeaf.className = 'j-entry-memo-main-v385';
    const otherLeaf = document.createElement('aside');
    otherLeaf.className = 'j-entry-memo-side-v385';
    const primaryHeading = document.createElement('h3');
    primaryHeading.textContent = 'メモの記入面';
    const otherHeading = document.createElement('h3');
    otherHeading.textContent = '付箋の整理';
    mainLeaf.append(primaryHeading);
    otherLeaf.append(otherHeading);

    const location = [
      ['workMemoTitleV167', mainLeaf],
      ['workMemoBodyV167', mainLeaf],
      ['workMemoCategoryV167', otherLeaf],
      ['workMemoPaperColorV385', otherLeaf],
      ['workMemoTagsV167', otherLeaf],
      ['workMemoPinnedV167', otherLeaf]
    ];
    for (const [id, parent] of location) {
      const label = form.querySelector('#' + id)?.closest('label');
      if (label) journalEntryMoveV385(label, parent, record);
    }
    pages.append(mainLeaf, otherLeaf);
    grid.parentNode.insertBefore(pages, grid);
    record.extras.push(pages);
    grid.classList.add('j-entry-legacy-memo-grid-v385');
    const color = form.querySelector('#workMemoPaperColorV385');
    if (color) {
      const updateColor = () => dialog.dataset.journalMemoPaper = color.value;
      updateColor();
      color.addEventListener('change', updateColor);
      record.listeners.push(() => color.removeEventListener('change', updateColor));
    }
  }

  function journalSimpleDialogV385(dialog, type, number, kicker, lead) {
    if (journalEntryRecordsV385.has(dialog)) return;
    const form = dialog.querySelector('form');
    if (!form) return;
    const record = {moves:[],extras:[],listeners:[],dialog,form,grid:null};
    journalEntryRecordsV385.set(dialog, record);
    dialog.classList.add('j-entry-dialog-v385','j-entry-' + type + '-v385');
    form.classList.add('j-entry-form-v385');
    journalEntryHeaderV385(dialog, {number,kicker,lead}, record);
    if (['copy','recurring','move'].includes(type)) composeJournalAuxiliary(dialog,type,record);
    if (type === 'template') {
      const layout = form.querySelector('.template-manage-layout');
      const grid = form.querySelector('.template-editor-panel > .form-grid');
      if (layout && grid) {
        layout.classList.add('j-template-notebook');
        record.listeners.push(()=>layout.classList.remove('j-template-notebook'));
        const pages = document.createElement('div');
        pages.className = 'j-template-writing-pages';
        grid.after(pages);
        record.extras.push(pages);
        for (const [label,ids] of [['ひな形の見出し',['templateName','templateTitle','templatePriority','templateCategory','templateTags']],['作業の書き込み',['templateDescription','templateChecklist']]]) {
          const leaf = document.createElement('section');
          leaf.className = 'j-template-writing-leaf';
          const title = document.createElement('h4');title.textContent=label;leaf.append(title);
          for (const id of ids) {
            const field=grid.querySelector('#'+id)?.closest('label');
            if(field)journalEntryMoveV385(field,leaf,record);
          }
          pages.append(leaf);
        }
        // The emptied grid remains as an exact restoration anchor.
        const wasHidden=grid.hidden;grid.hidden=true;
        record.listeners.push(()=>{grid.hidden=wasHidden;});
      }
    }
  }

  // Auxiliary forms use the same live inputs and confirmation buttons as the
  // canonical owner. Only their paper leaves and reading order belong here.
  function composeJournalAuxiliary(dialog,type,record) {
    const book=document.createElement('div');
    book.className='j-aux-book j-aux-'+type;
    const form=record.form,footer=form.querySelector(':scope > .dialog-actions');
    if(footer)footer.before(book);else form.append(book);
    record.extras.push(book);
    function leaf(name,label,selectors) {
      const page=document.createElement('section');page.className='j-aux-leaf j-aux-'+name;
      page.setAttribute('aria-label',label);
      for(const selector of selectors) {
        const node=form.querySelector(selector);
        if(node)journalEntryMoveV385(node,page,record);
      }
      book.append(page);return page;
    }
    if(type==='copy') {
      const source=form.querySelector('.schedule-copy-source');
      if(source)journalEntryMoveV385(source,book,record);
      leaf('writing','コピー方法と日程',['.schedule-copy-method-section','#scheduleCopySettings']);
      leaf('proof','作成される予定の確認',['.schedule-copy-preview']);
    } else if(type==='recurring') {
      const subject=form.querySelector('#recurringDeleteSubject');
      if(subject)journalEntryMoveV385(subject,book,record);
      leaf('scope','削除する範囲',['.recurring-delete-options']);
      const proof=leaf('impact','削除の影響',['#recurringDeleteImpact','#recurringDeleteNote']);
      const heading=document.createElement('h3');heading.textContent='削除前の確認';proof.prepend(heading);
    } else {
      leaf('context','移す案件',['.move-target-card','.form-help']);
      const writing=leaf('date','日付と状態',['.form-grid']);
      const heading=document.createElement('h3');heading.textContent='記入する日と状態';writing.prepend(heading);
      for(const [node,text] of [[dialog.querySelector('.dialog-head h2'),'日付日誌へ移す'],[dialog.querySelector('#confirmTimelineMove'),'日誌に記入']]) {
        if(!node)continue;
        const before=node.textContent;node.textContent=text;
        record.listeners.push(()=>{node.textContent=before;});
      }
    }
  }

  function composeJournalActivity(dialog) {
    if(journalEntryRecordsV385.has(dialog))return;
    const records=dialog.querySelector('#activityDialogBody');if(!records)return;
    const record={moves:[],extras:[],listeners:[],dialog,form:dialog,grid:null};
    journalEntryRecordsV385.set(dialog,record);
    dialog.classList.add('j-entry-dialog-v385','j-entry-activity-v385');
    journalEntryHeaderV385(dialog,{number:'09',kicker:'ROOM LOG',lead:'共有ルームの追加・更新を確認します。'},record);
    const leaf=document.createElement('section');leaf.className='j-activity-leaf';
    leaf.setAttribute('aria-label','共有ルームの更新記録');dialog.append(leaf);
    journalEntryMoveV385(records,leaf,record);record.extras.push(leaf);
  }

  function journalManagementDialog(dialog) {
    if(journalEntryRecordsV385.has(dialog))return;
    journalSimpleDialogV385(dialog,'management','07','NOTEBOOK INDEX','分類・状態・利用者の索引を整理します。');
    const record=journalEntryRecordsV385.get(dialog),form=dialog.querySelector('form');
    if(!record || !form)return;
    const spread=document.createElement('div');spread.className='j-management-spread';
    const index=document.createElement('aside');index.className='j-management-index';
    index.innerHTML='<small>INDEX / 索引</small><strong>項目を整理する</strong><p>追加した項目は、この手帳とほかの画面で共通して使います。</p>';
    const leaf=document.createElement('section');leaf.className='j-management-leaf';
    spread.append(index,leaf);form.append(spread);record.extras.push(spread);
    for(const node of [...form.children]) {
      if(node===spread || node.classList.contains('dialog-head'))continue;
      journalEntryMoveV385(node,leaf,record);
    }
  }

  let journalReservedRecord=null;
  function restoreJournalReserved() {
    if(!journalReservedRecord)return;
    for(const {marker,node} of journalReservedRecord.moves)if(marker.parentNode)marker.replaceWith(node);
    journalReservedRecord.groups.forEach(node=>node.remove());
    journalReservedRecord.list.classList.remove('j-reserved-list');
    journalReservedRecord=null;
  }
  function composeJournalReserved(dialog) {
    const list=dialog.querySelector('.reserved-task-list-v167');
    if(!list || journalReservedRecord?.list===list)return;
    restoreJournalReserved();
    const record={list,moves:[],groups:[]},days=new Map();
    list.classList.add('j-reserved-list');
    for(const card of [...list.children]) {
      if(!card.matches('[data-reserved-id]'))continue;
      const date=card.querySelector('[data-reserved-date]')?.value || '';
      if(!days.has(date)) {
        const group=document.createElement('section');group.className='j-reserved-day';
        const heading=document.createElement('header');
        const label=document.createElement('small');label.textContent='開始日のしおり';
        const day=document.createElement('h3');day.textContent=date?new Date(date+'T12:00:00').toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}):'開始日未設定';
        const records=document.createElement('div');records.className='j-reserved-records';
        heading.append(label,day);group.append(heading,records);list.append(group);
        record.groups.push(group);days.set(date,group);
      }
      const marker=document.createComment('journal-reserved-card-position');
      card.before(marker);days.get(date).querySelector('.j-reserved-records').append(card);record.moves.push({marker,node:card});
    }
    journalReservedRecord=record;
  }

  function restoreJournalEntriesV385() {
    restoreJournalReserved();
    for (const [dialog, record] of journalEntryRecordsV385) {
      for (const dispose of record.listeners) dispose();
      for (const {marker,node} of record.moves) {
        if (marker.parentNode) marker.replaceWith(node);
      }
      for (const el of record.extras) el.remove();
      record.grid?.classList.remove('j-entry-content-v385','j-entry-legacy-memo-grid-v385');
      record.form.classList.remove('j-entry-form-v385');
      dialog.classList.remove('j-entry-dialog-v385','j-entry-task-v385',
        'j-entry-schedule-v385','j-entry-memo-v385','j-entry-copy-v385',
        'j-entry-recurring-v385','j-entry-template-v385','j-entry-management-v385',
        'j-entry-move-v385','j-entry-activity-v385');
      delete dialog.dataset.journalMemoPaper;
    }
    journalEntryRecordsV385.clear();
  }

  function syncJournalEntriesV385() {
    if (!isJournal()) {
      if (journalEntryRecordsV385.size || journalReservedRecord) restoreJournalEntriesV385();
      return;
    }
    const reserved=document.querySelector('#reservedTaskDialogV167[open]');
    if(reserved)composeJournalReserved(reserved);
    for (const dialog of document.querySelectorAll(
      '#taskDialog[open],#scheduleDialog[open],#workMemoDialogV167[open],'
      + '#scheduleCopyDialog[open],#recurringDeleteDialog[open],#templateManageDialog[open],'
      + '#categoryManageDialog[open],#statusManageDialog[open],#userManageDialog[open],'
      + '#timelineMoveDialog[open],#activityDialog[open]')) {
      if (journalEntryRecordsV385.has(dialog)) {
        journalEntryRecordsV385.get(dialog).refreshOutlineV393?.();
        if (dialog.id === 'workMemoDialogV167') {
          const selected = dialog.querySelector('#workMemoPaperColorV385')?.value;
          if (selected) dialog.dataset.journalMemoPaper = selected;
        }
        continue;
      }
      if (journalEntrySpecsV385[dialog.id]) journalEntryDecorateV385(dialog, journalEntrySpecsV385[dialog.id]);
      else if (dialog.id === 'workMemoDialogV167') journalMemoEditorV385(dialog);
      else if (dialog.id === 'scheduleCopyDialog')
        journalSimpleDialogV385(dialog,'copy','04','DUPLICATE PLAN','日程の条件と作成予定を確認してからコピーします。');
      else if (dialog.id === 'recurringDeleteDialog')
        journalSimpleDialogV385(dialog,'recurring','05','RECURRING SERIES','削除範囲を選び、影響を確認してください。');
      else if (dialog.id === 'templateManageDialog')
        journalSimpleDialogV385(dialog,'template','06','REUSABLE NOTE','よく使う作業の記入例を整理します。');
      else if (dialog.id === 'timelineMoveDialog')
        journalSimpleDialogV385(dialog,'move','08','DAILY CHRONICLE','案件を記入する日と状態を指定します。');
      else if (dialog.id === 'activityDialog') composeJournalActivity(dialog);
      else journalManagementDialog(dialog);
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    // Observe only dialog open/close, not every canonical screen render.
    const watchedDialogs = new WeakSet();
    function watchEntryDialogsV385() {
      for (const dialog of document.querySelectorAll(
        '#taskDialog,#scheduleDialog,#workMemoDialogV167,#scheduleCopyDialog,#recurringDeleteDialog,#templateManageDialog,#categoryManageDialog,#statusManageDialog,#userManageDialog,#reservedTaskDialogV167,#timelineMoveDialog,#activityDialog')) {
        if (watchedDialogs.has(dialog)) continue;
        watchedDialogs.add(dialog);
        new MutationObserver(syncJournalEntriesV385).observe(dialog, {
          attributes:true,attributeFilter:['open']
        });
        const reservedList=dialog.querySelector('#reservedTaskListV167');
        if(reservedList)new MutationObserver(syncJournalEntriesV385).observe(reservedList,{childList:true});
      }
    }
    watchEntryDialogsV385();
    // Only the memo dialog is created asynchronously as a body child.
    new MutationObserver(() => {
      watchEntryDialogsV385();
      syncJournalEntriesV385();
    }).observe(body,{childList:true});
    new MutationObserver(syncJournalEntriesV385).observe(root,{
      attributes:true,attributeFilter:['data-wb-display']
    });
  }
  requestAnimationFrame(syncJournalEntriesV385);

  themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.journalTheme, true)));
  settingsButton.addEventListener('click', () => preferencesOpen ? closePreferences() : openPreferences());
  preferencesDrawerButton.addEventListener('click', () => openDrawer());
  createToggle.addEventListener('click', () => menuOpen ? closeMenu() : openMenu());
  createMenu.addEventListener('click', event => {
    const target = event.target.closest('[data-journal-create]');
    if (target && !target.disabled && isJournal()) createItem(target.dataset.journalCreate);
  });
  pageButtons.forEach(button => button.addEventListener('click', () => {
    if (!isJournal()) return;
    body.dataset.journalSheet = button.dataset.journalSheet;
    syncPages();
  }));
  navigation.addEventListener('click', event => {
    if (event.target.closest('.nav-item')) {
      closeDrawer();
      scheduleSync();
    }
  });

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      const journalActive = isJournal();
      if (journalActive) {
        applyTheme(loadTheme(), false);
        dateLabel();
        scheduleSync();
      } else {
        restoreJournalComposition();
        restoreJournalSearchV393();
        restoreJournalSettingsV393();
        closeDrawer();
        closeMenu();
        closePreferences();
      }
      // JOURNAL's Today/Tasks/ToDo/Schedule pages use canonical-data
      // renderers, not a CSS-only skin. Re-enter the active canonical route
      // after switching displays so Classic never inherits JOURNAL markup
      // (and vice versa). Keep the existing task-board selection behavior.
      if (['today-mode','task-mode','todo-mode','schedule-mode']
        .some(mode=>body.classList.contains(mode))) {
        queueMicrotask(() => {
          // Ignore a stale queued switch if another display was selected.
          if (isJournal() !== journalActive) return;
          const active = sidebar.querySelector('.nav-item.active[data-layout]');
          if (journalActive && body.classList.contains('task-mode')) {
            const board = main.querySelector('.task-view-switcher [data-task-layout="board"]');
            if (board) {board.click();return;}
          }
          active?.click();
        });
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-wb-display'] });
    new MutationObserver(scheduleSync).observe(navigation, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    // Today/ToDo shortcuts can change the layout without sidebar interaction.
    new MutationObserver(scheduleSync).observe(body, {
      attributes: true, attributeFilter: ['class']
    });
  }
  // Deferred JOURNAL assets may finish loading after data-wb-display was set.
  // In that case the MutationObserver above misses the original mode change,
  // leaving the Classic Today/board markup under the JOURNAL presentation.
  // Reuse the existing canonical navigation once, only if its page has not
  // rendered in JOURNAL form; do not create a second data/render owner.
  function replayInitialJournalNavigation() {
    if (!isJournal()) return;
    const active = sidebar.querySelector('.nav-item.active[data-layout]');
    if (!active) return;
    if (body.classList.contains('today-mode')
      && !main.querySelector('#todayView .j420-today')) {
      active.click();
    } else if (body.classList.contains('task-mode')
      && !main.querySelector('#boardView .j420-atelier')) {
      const board = main.querySelector('.task-view-switcher [data-task-layout="board"]');
      (board || active).click();
    }
  }
  if (isJournal()) {
    if (window.WORK_BOARD_CORE_READY) queueMicrotask(replayInitialJournalNavigation);
    else window.addEventListener('workboard:core-ready', replayInitialJournalNavigation, { once: true });
  }
  document.getElementById('currentUserSelect')?.addEventListener('change', () => {
    // Never show a previous user's note selection in a different account.
    journalMemoSelectedV425='';
    journalMemoColorV396='all';
    journalMemoIndexQueryV450='';
    journalMemoClosedGroupsV450.clear();
    journalMemoFastenerByIdV430.clear();
    queueMicrotask(() => applyTheme(loadTheme(), false));
  });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === storageKey() || event.key === 'systemTaskUser'
      || event.key === 'systemTaskRoomId') {
      applyTheme(loadTheme(), false);
      scheduleSync();
    }
  });
  window.addEventListener('pageshow', () => {
    applyTheme(loadTheme(), false);
    dateLabel();
    scheduleSync();
  });
  body.dataset.journalSheet = 'left';
  body.dataset.journalSettingsOpen = 'false';
  syncPages();
  applyTheme(loadTheme(), false);
  dateLabel();
  scheduleSync();

  // Ver.411: centered folio uses the canonical detail node and existing task actions.
  (function installJournalFolioV411(){
    const shell=document.querySelector('.app-shell'),panel=document.querySelector('.detail-panel'),close=document.getElementById('closeDetail');
    if(!shell||!panel||!close)return;
    let visible=false,previousFocus=null;
    const active=()=>isJournal()&&shell.classList.contains('detail-open')&&panel.classList.contains('open');
    const detailBody=panel.querySelector('#detailBody');
    const compact=window.matchMedia('(max-width:760px)');
    const headLabel=panel.querySelector('.detail-head strong');
    const originalHeadLabel=headLabel?.textContent||'タスク詳細';
    let moreExpanded=false;
    let recordPages=null;
    function composeRecordPages() {
      if(recordPages && !recordPages.stack.isConnected){recordPages.observer.disconnect();recordPages=null;}
      if(!isJournal()) {
        detailBody.querySelectorAll('[data-j-record-knowledge]').forEach(button=>button.remove());
        if(recordPages) {
          const {stack,index,orientation,observer,onKey}=recordPages;
          observer.disconnect();
          index.removeEventListener('keydown',onKey,true);
          stack.replaceWith(...stack.children);
          index.classList.remove('j-record-page-index');
          if(orientation===null)index.removeAttribute('aria-orientation');
          else index.setAttribute('aria-orientation',orientation);
          recordPages=null;
        }
        detailBody.classList.remove('j-record-detail');
        return;
      }
      if(!recordPages) {
        // Keep the shared tab bar as a direct child: comments and related
        // tools use that boundary. Move the live panels, never their controls.
        const index=detailBody.querySelector(':scope > .task-detail-tabs-v149');
        const pages=[...detailBody.querySelectorAll(':scope > .task-detail-panel-v149')];
        if(!index || !pages.length)return;
        const stack=document.createElement('div');stack.className='j-record-page-stack';
        index.after(stack);stack.append(...pages);
        const observer=new MutationObserver(enhance);
        observer.observe(stack,{childList:true});
        const onKey=event=>{
          if(!isJournal() || compact.matches || !['ArrowUp','ArrowDown'].includes(event.key))return;
          const buttons=[...index.querySelectorAll('.task-detail-tab-v149')];
          const current=buttons.indexOf(event.target.closest('.task-detail-tab-v149'));
          if(current<0)return;
          event.preventDefault();event.stopImmediatePropagation();
          const next=buttons[(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length];
          next.click();next.focus({preventScroll:true});
        };
        index.addEventListener('keydown',onKey,true);
        recordPages={stack,index,observer,onKey,orientation:index.getAttribute('aria-orientation')};
        index.classList.add('j-record-page-index');
        detailBody.classList.add('j-record-detail');
      }
      recordPages.index.setAttribute('aria-orientation',compact.matches?'horizontal':'vertical');
      const tools=detailBody.querySelector('[data-tab-panel="tools"]');
      if(tools && recordPages.tools!==tools) {
        // Watch only section mounts/replacements, not typing or field attributes.
        recordPages.observer.disconnect();
        recordPages.observer.observe(recordPages.stack,{childList:true});
        recordPages.observer.observe(tools,{childList:true});
        recordPages.tools=tools;
      }
      if(tools) {
        // Keep reading and keyboard order alike when shared sections mount
        // in separate frames. Reorder the live sections only when necessary.
        const selectors=['.workflow-dependencies-v149','.workflow-relations-v152','.workflow-reminder-v152','.workflow-organize-v153'];
        const wanted=selectors.map(selector=>tools.querySelector(selector)).filter(Boolean);
        const current=[...tools.children].filter(node=>wanted.includes(node));
        if(current.some((node,index)=>node!==wanted[index]))wanted.forEach(node=>tools.append(node));
      }
      if(tools && !tools.querySelector('[data-j-record-knowledge]')) {
        const button=document.createElement('button');button.type='button';
        button.dataset.jRecordKnowledge='';button.className='j-record-knowledge';
        button.textContent='この案件の手順・知識を残す';
        button.addEventListener('click',()=>{
          const key=detailBody.querySelector('[data-operation-key^="task-delete:"]')?.dataset.operationKey || '';
          const task=shelfSnapshot()?.tasks.find(x=>x.id===key.slice('task-delete:'.length));
          if(!task)return;
          close.click();openShelf('knowledge');
          shelfReturnTask={id:task.id,owner:shelfOwner};
          readShelfKnowledge(task.knowledgeId,task.id);
        });
        tools.prepend(button);
      }
    }
    // Long records need a stable, useful sticky heading. Only JOURNAL phones
    // override the label, and leaving the view restores its canonical text.
    const syncTaskHeading=()=>{
      if(!headLabel)return;
      const title=active()&&compact.matches
        ?detailBody?.querySelector('.detail-title')?.textContent?.trim():'';
      headLabel.textContent=title||originalHeadLabel;
      if(title)headLabel.title=title;
      else headLabel.removeAttribute('title');
    };
    // Enhance only the already-bound canonical buttons. Moving a node preserves
    // its original listeners and avoids a second editor or persistence owner.
    const enhance=()=>{
      if(!detailBody)return;
      composeRecordPages();
      syncTaskHeading();
      const actions=detailBody.querySelector('.detail-actions');
      const wrapper=actions?.querySelector('.j495-detail-more');
      const footer=detailBody.querySelector('.j495-detail-footer');
      if(!active()){
        if(wrapper){
          const original=wrapper.querySelector('.sub-actions');
          if(original)actions.append(original);
          wrapper.remove();
        }
        footer?.remove();
        return;
      }
      if(!actions)return;
      if(!wrapper){
        const secondary=actions.querySelector('.sub-actions');
        if(secondary){
          const details=document.createElement('details');
          details.className='j495-detail-more';
          const summary=document.createElement('summary');
          summary.textContent='その他の操作';
          summary.setAttribute('aria-label','スター・予定作成・複製・削除を開く');
          details.append(summary);
          details.open=moreExpanded;
          actions.append(details);
          details.append(secondary);
          details.addEventListener('toggle',()=>{
            if(details.isConnected&&isJournal())moreExpanded=details.open;
          });
        }
      }
      if(!compact.matches)footer?.remove();
      if(compact.matches&&!footer){
        const nav=document.createElement('nav');
        nav.className='j495-detail-footer';
        nav.setAttribute('aria-label','タスク詳細の末尾操作');
        const edit=document.createElement('button');
        edit.type='button';edit.className='j495-detail-footer-edit';
        edit.textContent='編集する';
        edit.addEventListener('click',()=>detailBody.querySelector('[data-action="edit"]')?.click());
        const top=document.createElement('button');
        top.type='button';top.className='j495-detail-footer-top';
        top.textContent='↑ 先頭へ戻る';
        top.addEventListener('click',()=>{
          panel.scrollTo({top:0,behavior:'auto'});
          const heading=detailBody.querySelector('.detail-title');
          if(heading){
            heading.tabIndex=-1;
            heading.focus({preventScroll:true});
          }
        });
        nav.append(edit,top);
        detailBody.append(nav);
      }
    };
    const sync=()=>{
      const now=active();
      if(now&&!visible){
        // Fresh opening always begins with the heading instead of retaining
        // scroll from the last, potentially very long, task.
        previousFocus=panel.contains(document.activeElement)?null:document.activeElement;
        panel.scrollTop=0;
        panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','タスクの記録ページ');
        // Another JOURNAL entry point may already have focused the heading.
        // Do not overwrite that intentional focus with the close button.
        requestAnimationFrame(()=>{
          if(active()&&!panel.contains(document.activeElement))close.focus({preventScroll:true});
        });
      }else if(!now&&visible){
        panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');
        moreExpanded=false;
        const returnFocus=previousFocus;
        if(returnFocus?.isConnected)requestAnimationFrame(()=>{
          const current=document.activeElement;
          // Another control may win focus after the close in the same tick.
          // Do not let this presentation-level fallback override that action.
          if(current&&current!==returnFocus&&current.isConnected
            &&current!==document.body&&current!==document.documentElement
            &&!panel.contains(current))return;
          returnFocus.focus({preventScroll:true});
        });
      }
      visible=now;
      enhance();
    };
    new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['class']});
    new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
    if(detailBody)new MutationObserver(enhance).observe(detailBody,{childList:true});
    compact.addEventListener('change',enhance);
    new MutationObserver(enhance).observe(root,{attributes:true,attributeFilter:['data-wb-display']});
    document.addEventListener('keydown',event=>{
      if(!active()||document.querySelector('dialog[open]'))return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.click();return}
      if(event.key!=='Tab')return;
      const options=[...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
      if(!options.length)return;
      if(event.shiftKey&&document.activeElement===options[0]){event.preventDefault();options[options.length-1].focus()}
      else if(!event.shiftKey&&document.activeElement===options[options.length-1]){event.preventDefault();options[0].focus()}
    },true);
    // pointerdown (not click) prevents the opening task click from immediately closing the folio.
    document.addEventListener('pointerdown',event=>{if(active()&&!document.querySelector('dialog[open]')&&!panel.contains(event.target))close.click()});
    sync();
  })();
  window.dispatchEvent(new Event('workboard:display-ready'));
})();
