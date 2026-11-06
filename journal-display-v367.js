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
  routes.filter(entry => ['today', 'todos', 'tasks', 'schedule'].includes(entry.id))
    .forEach(entry => dock.appendChild(routeButton(entry, true)));
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'wb-journal-more-v367';
  more.textContent = 'その他';
  more.setAttribute('aria-label', 'その他のページと設定');
  more.addEventListener('click', openDrawer);
  dock.appendChild(more);
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
    index.querySelector('.j-memo-index-v383')?.remove();
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
    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className = 'j-memo-index-empty-v383';
      empty.textContent = '条件に合うメモはありません';
      panel.append(empty);
    }
    for (const [category, entries] of groups) {
      const group = document.createElement('section');
      group.className = 'j-memo-index-group-v383';
      const label = document.createElement('h4');
      label.textContent = category + '  ' + entries.length;
      group.append(label);
      const list = document.createElement('ul');
      for (const card of entries) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'j-memo-index-link-v383';
        button.dataset.journalMemoPaper = card.dataset.memoPaperColor || 'ivory';
        button.textContent = (card.classList.contains('is-pinned') ? '固定｜' : '') +
          (card.querySelector('h4')?.textContent?.trim() || '無題');
        button.addEventListener('click', () => {
          card.setAttribute('tabindex', '0');
          card.focus({preventScroll:true});
          card.scrollIntoView({behavior:'smooth',block:'center'});
          const spread=index.closest('.j425-memo-spread');
          if(spread){journalMemoSelectedV425=card.dataset.memoSortId;updateMemoReaderV425(spread)}
        });
        item.append(button);
        list.append(item);
      }
      group.append(list);
      panel.append(group);
    }
    index.append(panel);
    const spread=index.closest('.j425-memo-spread');
    if(spread)updateMemoReaderV425(spread);
  }

  // Follow the actual scrolling content, not a CSS sticky container that can
  // be blocked by an ancestor overflow context. Clamp to the memo spread so
  // the index never floats over the footer or a different page.
  let journalMemoFollowV402 = null;
  function attachMemoIndexFollowV402(spread,index) {
    detachMemoIndexFollowV402();
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!isJournal() || !spread.isConnected || !index.isConnected) return;
      if (window.matchMedia('(max-width:950px)').matches) {
        index.style.transform = '';
        return;
      }
      const top = spread.getBoundingClientRect().top;
      const limit = Math.max(0,spread.offsetHeight-index.offsetHeight);
      const offset = Math.min(limit,Math.max(0,12-top));
      index.style.transform = offset ? 'translate3d(0,'+offset+'px,0)' : '';
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    document.addEventListener('scroll',request,{capture:true,passive:true});
    window.addEventListener('scroll',request,{passive:true});
    window.addEventListener('resize',request,{passive:true});
    journalMemoFollowV402 = () => {
      document.removeEventListener('scroll',request,true);
      window.removeEventListener('scroll',request);
      window.removeEventListener('resize',request);
      if (raf) cancelAnimationFrame(raf);
      index.style.transform = '';
    };
    request();
  }
  function detachMemoIndexFollowV402() {
    journalMemoFollowV402?.();
    journalMemoFollowV402 = null;
  }


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

  function updateMemoReaderV425(spread) {
    const grid=spread.querySelector('.work-memo-grid-v167');
    const reader=spread.querySelector('.j425-memo-reader');
    if(!reader)return;
    const cards=[...(grid?.querySelectorAll(':scope > .work-memo-card-v167')||[])].filter(card=>!card.classList.contains('j-memo-color-hidden-v396'));
    if(!cards.some(card=>card.dataset.memoSortId===journalMemoSelectedV425))journalMemoSelectedV425=cards[0]?.dataset.memoSortId||'';
    const card=cards.find(card=>card.dataset.memoSortId===journalMemoSelectedV425);
    grid?.querySelectorAll(':scope > .work-memo-card-v167').forEach(el=>{
      el.classList.toggle('j425-memo-selected',el===card);
      el.setAttribute('aria-selected',String(el===card));
    });
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
    const actions=document.createElement('div');actions.className='j425-memo-reader-actions';
    for(const [caption,selector] of [['編集','[data-memo-edit]'],['コピー','[data-memo-copy]'],['タスク化','[data-memo-task]']]){
      const btn=document.createElement('button');btn.type='button';btn.textContent=caption;
      btn.addEventListener('click',()=>card.querySelector(selector)?.click());actions.append(btn);
    }
    reader.append(label,title,meta,tags,text,actions);
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
    const reader=document.createElement('aside');reader.className='j425-memo-reader j425-reading-rail';reader.setAttribute('aria-label','選択したメモの本文');
    // Memo alone has a tiny wax-seal and paper-tag finish, never a recurring pen.
    const memoSeal=document.createElement('div');
    memoSeal.className='j430-memo-seal';memoSeal.setAttribute('aria-hidden','true');
    const memoScrap=document.createElement('div');
    memoScrap.className='j430-memo-scrap';memoScrap.setAttribute('aria-hidden','true');
    memoScrap.textContent='MEMO JOURNAL';
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
      const selectCard=card=>{
        if(!card)return;
        journalMemoSelectedV425=card.dataset.memoSortId;
        updateMemoReaderV425(spread);
      };
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
    gallery.append(memoSeal,memoScrap);
    spread.append(mast,index,gallery,reader);view.append(spread);
    composeMemoIndex(index,memo);
    updateMemoReaderV425(spread);
    attachMemoIndexFollowV402(spread,index);
  }

  function restoreMemoSheets() {
    detachMemoIndexFollowV402();
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

  // One visible search per JOURNAL, matching the Palette interaction model.
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
      todos:window.WorkBoardTodoSearchBridgeV393,
      memo:window.WorkBoardMemoSearchBridgeV393
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
      '.task-card,.schedule-card,.todo-preview-item,.activity-item')) {
      const text = (card.textContent || '').normalize('NFKC').toLocaleLowerCase('ja');
      card.classList.toggle('j-search-excluded-v393', Boolean(query) && !text.includes(query));
    }
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
    globalSearchScopeV393.textContent = globalSearchDefaultsV393[route] || '手帳';
    globalSearchInputV393.placeholder = route === 'today'
      ? '今日の記録を探す（タブ共通）' : '手帳全体のキーワードを入力';
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
  }

  function restoreJournalEntriesV385() {
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
        'j-entry-recurring-v385','j-entry-template-v385');
      delete dialog.dataset.journalMemoPaper;
    }
    journalEntryRecordsV385.clear();
  }

  function syncJournalEntriesV385() {
    if (!isJournal()) {
      if (journalEntryRecordsV385.size) restoreJournalEntriesV385();
      return;
    }
    for (const dialog of document.querySelectorAll(
      '#taskDialog[open],#scheduleDialog[open],#workMemoDialogV167[open],'
      + '#scheduleCopyDialog[open],#recurringDeleteDialog[open],#templateManageDialog[open]')) {
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
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    // Observe only dialog open/close, not every canonical screen render.
    const watchedDialogs = new WeakSet();
    function watchEntryDialogsV385() {
      for (const dialog of document.querySelectorAll(
        '#taskDialog,#scheduleDialog,#workMemoDialogV167,#scheduleCopyDialog,#recurringDeleteDialog,#templateManageDialog')) {
        if (watchedDialogs.has(dialog)) continue;
        watchedDialogs.add(dialog);
        new MutationObserver(syncJournalEntriesV385).observe(dialog, {
          attributes:true,attributeFilter:['open']
        });
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
      // The Today diary and Atelier are rendered from canonical data (not DOM
      // restyling). Re-run the canonical view once when changing display modes.
      if (body.classList.contains('today-mode') || body.classList.contains('task-mode')) {
        queueMicrotask(() => {
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
  document.getElementById('currentUserSelect')?.addEventListener('change', () =>
    queueMicrotask(() => applyTheme(loadTheme(), false)));
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
    const sync=()=>{
      const now=active();
      if(now&&!visible){
        previousFocus=document.activeElement;
        panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','タスクの記録ページ');
        requestAnimationFrame(()=>{if(active())close.focus({preventScroll:true})});
      }else if(!now&&visible){
        panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');
        if(previousFocus?.isConnected)requestAnimationFrame(()=>previousFocus.focus({preventScroll:true}));
      }
      visible=now;
    };
    new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['class']});
    new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
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
