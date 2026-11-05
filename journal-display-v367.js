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
    { id: 'week', label: '週間', target: '.nav-item[data-layout="schedule"]' },
    { id: 'todos', label: 'ToDo', target: '.nav-item[data-layout="todos"]' },
    { id: 'tasks', label: 'タスク', target: '.nav-item[data-layout="tasks"]' },
    { id: 'schedule', label: '予定', target: '.nav-item[data-layout="schedule"]' },
    { id: 'memo', label: '業務メモ', target: '[data-work-memo-layout]' }
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
      '<div class="wb-journal-add-v367">',
        '<button type="button" class="wb-journal-add-toggle-v367" aria-expanded="false" aria-controls="wbJournalCreateMenuV367">＋ 追加</button>',
        '<div id="wbJournalCreateMenuV367" class="wb-journal-create-menu-v367" hidden role="group" aria-label="新しい項目を作成">',
          '<button type="button" data-journal-create="todo">＋ ToDo</button>',
          '<button type="button" data-journal-create="task">＋ タスク</button>',
          '<button type="button" data-journal-create="schedule">＋ 予定</button>',
          '<button type="button" data-journal-create="memo">＋ 業務メモ</button>',
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

  function routeButton(entry, mobile) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.journalRoute = entry.id;
    button.textContent = entry.label;
    button.setAttribute('aria-label', entry.label + 'ページを表示');
    button.addEventListener('click', () => navigate(entry.id));
    if (mobile) dockButtons.set(entry.id, button);
    else tabButtons.set(entry.id, button);
    return button;
  }
  routes.forEach(entry => tabs.appendChild(routeButton(entry, false)));
  routes.filter(entry => ['today', 'week', 'todos', 'tasks'].includes(entry.id))
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
  const pageButtons = Array.from(header.querySelectorAll('[data-journal-sheet]'));

  // JOURNAL-specific monochrome outline symbols are separate from Classic assets.
  // Keep Classic images in their original DOM for immediate restoration on mode switch.
  const journalLinePaths = Object.freeze({
    plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h7"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    later: '<path d="m12 3-8 4 8 4 8-4-8-4ZM4 12l8 4 8-4M4 17l8 4 8-4"/>'
  });

  function createJournalLineIcon(kind) {
    const icon = document.createElement('span');
    icon.className = 'wb-journal-line-icon-v367';
    icon.dataset.journalIcon = kind;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">'
      + journalLinePaths[kind] + '</svg>';
    return icon;
  }

  function syncJournalLineIcons() {
    if (!isJournal()) return;
    const panels = main.querySelectorAll('#todayView .today-grid > .today-panel');
    panels.forEach((panel, index) => {
      const heading = panel.querySelector('h4');
      if (!heading || heading.querySelector('.wb-journal-line-icon-v367')) return;
      const kind = /空き時間/.test(heading.textContent) ? 'later'
        : /予定/.test(heading.textContent) ? 'plan'
        : index === 0 ? 'plan' : 'task';
      heading.insertBefore(createJournalLineIcon(kind), heading.firstChild);
    });
  }


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

  function composeTodaySheet() {
    const view = document.getElementById('todayView');
    if (!view || view.hidden || view.querySelector(':scope > .j-day-spread-v372')) return;
    const grid = view.querySelector(':scope > .today-grid');
    const todo = view.querySelector(':scope > .today-todo-preview');
    const activity = view.querySelector(':scope > .activity-panel');
    if (!grid || !todo) return;
    const spread = document.createElement('div');
    spread.className = 'j-day-spread-v372';
    const left = paperLeaf('day-left', '本日の予定とタスク');
    const right = paperLeaf('day-right', '個人ToDoとお知らせ');
    left.appendChild(grid);
    right.appendChild(todo);
    if (activity) right.appendChild(activity);
    spread.append(left, right);
    view.appendChild(spread);
  }

  function restoreTodaySheet() {
    const view = document.getElementById('todayView');
    const spread = view?.querySelector(':scope > .j-day-spread-v372');
    if (!spread) return;
    const grid = spread.querySelector('.today-grid');
    const todo = spread.querySelector('.today-todo-preview');
    const activity = spread.querySelector('.activity-panel');
    if (activity) view.prepend(activity);
    if (todo) view.insertBefore(todo, view.firstElementChild?.nextSibling || null);
    if (grid) view.appendChild(grid);
    spread.remove();
  }

  function composeTodoSheet() {
    const view = document.getElementById('todoView');
    const page = view?.querySelector(':scope > .todo-page');
    if (!page || view.hidden || page.querySelector(':scope > .j-todo-spread-v372')) return;
    const heading = page.querySelector(':scope > .todo-page-head');
    const stats = page.querySelector(':scope > .todo-page-stats');
    const workspace = page.querySelector(':scope > .todo-workspace');
    const workspaceHead = workspace?.querySelector(':scope > .todo-workspace-head');
    const form = workspace?.querySelector(':scope > .todo-create-form');
    const privacy = workspace?.querySelector(':scope > .todo-privacy-note');
    if (!heading || !stats || !workspace || !form) return;
    const spread = document.createElement('div');
    spread.className = 'j-todo-spread-v372';
    const left = paperLeaf('todo-compose', 'ToDoを記入する');
    const right = paperLeaf('todo-list', 'ToDoを確認する');
    left.append(heading, stats);
    if (workspaceHead) left.append(workspaceHead);
    left.append(form);
    if (privacy) left.append(privacy);
    right.append(workspace);
    spread.append(left, right);
    page.append(spread);
  }

  function restoreTodoSheet() {
    const view = document.getElementById('todoView');
    const page = view?.querySelector(':scope > .todo-page');
    const spread = page?.querySelector(':scope > .j-todo-spread-v372');
    if (!spread) return;
    const heading = spread.querySelector('.todo-page-head');
    const stats = spread.querySelector('.todo-page-stats');
    const workspace = spread.querySelector('.todo-workspace');
    const workspaceHead = spread.querySelector('.todo-workspace-head');
    const form = spread.querySelector('.todo-create-form');
    const privacy = spread.querySelector('.todo-privacy-note');
    if (workspace) {
      const lists = workspace.querySelector(':scope > .todo-lists');
      for (const node of [workspaceHead, form, privacy]) {
        if (node) workspace.insertBefore(node, lists || null);
      }
    }
    for (const node of [heading, stats, workspace]) {
      if (node) page.appendChild(node);
    }
    spread.remove();
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
  }

  function restoreTaskRegister() {
    const consoleEl = main.querySelector(':scope > .j-task-console-v372');
    if (!consoleEl) return;
    const toolbar = consoleEl.querySelector(':scope > .toolbar');
    const controls = consoleEl.querySelector(':scope > .task-control-row');
    if (toolbar && controls) consoleEl.replaceWith(toolbar, controls);
    else consoleEl.remove();
  }

  function composeWeeklyPages() {
    const view = document.getElementById('scheduleView');
    if (!view || view.hidden) return;
    const list = view.querySelector(':scope > .schedule-list');
    if (!list || list.querySelector(':scope > .j-week-ledger-v372')) return;
    if (!view.querySelector('[data-schedule-range="week"].active')) return;
    const values = (view.querySelector('.schedule-range-label')?.textContent || '')
      .match(/\d{4}-\d{2}-\d{2}/g);
    if (!values || values.length < 2) return;
    const start = new Date(values[0] + 'T12:00:00');
    if (!Number.isFinite(start.getTime())) return;
    const groups = [...list.querySelectorAll(':scope > .schedule-day')];
    const map = new Map(groups.map(el => [
      el.querySelector('.schedule-day-label')?.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0], el
    ]));
    const ledger = document.createElement('div');
    ledger.className = 'j-week-ledger-v372';
    const weekdays = ['日','月','火','水','木','金','土'];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const iso = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'),
        String(date.getDate()).padStart(2,'0')].join('-');
      const card = document.createElement('section');
      card.className = 'j-week-day-v372' + (iso === new Date().toLocaleDateString('sv-SE') ? ' is-today' : '');
      card.dataset.day = iso;
      const heading = document.createElement('h3');
      heading.className = 'j-week-date-v372';
      const num = document.createElement('span');
      num.className = 'j-week-number-v372';
      num.textContent = String(date.getDate()).padStart(2, '0');
      const desc = document.createElement('span');
      desc.className = 'j-week-weekday-v372';
      desc.textContent = weekdays[date.getDay()] + ' / ' + (date.getMonth()+1) + '月';
      heading.append(num, desc);
      card.append(heading);
      const canonical = map.get(iso);
      if (canonical) card.append(canonical);
      else {
        const empty = document.createElement('p');
        empty.className = 'j-week-empty-v372';
        empty.textContent = '予定なし';
        card.append(empty);
      }
      ledger.append(card);
    }
    // Keep the original canonical empty-state node for clean Classic restoration.
    const originalEmpty = list.querySelector(':scope > .empty-schedule');
    if (originalEmpty) {
      originalEmpty.classList.add('j-week-source-empty-v372');
      ledger.append(originalEmpty);
    }
    list.append(ledger);
  }

  function restoreWeeklyPages() {
    const list = document.querySelector('#scheduleView > .schedule-list');
    const ledger = list?.querySelector(':scope > .j-week-ledger-v372');
    if (!ledger) return;
    for (const day of ledger.querySelectorAll(':scope > .j-week-day-v372')) {
      const canonical = day.querySelector(':scope > .schedule-day');
      if (canonical) list.append(canonical);
    }
    const originalEmpty = ledger.querySelector(':scope > .empty-schedule');
    if (originalEmpty) {
      originalEmpty.classList.remove('j-week-source-empty-v372');
      list.append(originalEmpty);
    }
    ledger.remove();
  }

  function composeMemoSheets() {
    const view = document.getElementById('workMemoViewV167');
    if (!view || view.querySelector(':scope > .j-memo-spread-v372')) return;
    const head = view.querySelector(':scope > .work-memo-head-v167');
    const tools = view.querySelector(':scope > .work-memo-tools-v167');
    const memo = view.querySelector(':scope > .work-memo-grid-v167, :scope > .work-memo-empty-v167');
    if (!head || !tools || !memo) return;
    const spread = document.createElement('div');
    spread.className = 'j-memo-spread-v372';
    const index = paperLeaf('memo-index', 'メモの索引');
    const pages = paperLeaf('memo-pages', '登録した業務メモ');
    index.append(head, tools);
    pages.append(memo);
    spread.append(index, pages);
    view.append(spread);
  }

  function restoreMemoSheets() {
    const view = document.getElementById('workMemoViewV167');
    const spread = view?.querySelector(':scope > .j-memo-spread-v372');
    if (!spread) return;
    for (const node of [spread.querySelector('.work-memo-head-v167'),
      spread.querySelector('.work-memo-tools-v167'),
      spread.querySelector('.work-memo-grid-v167, .work-memo-empty-v167')]) {
      if (node) view.appendChild(node);
    }
    spread.remove();
  }

  function restoreJournalComposition() {
    restoreTodaySheet();
    restoreTodoSheet();
    restoreWeeklyPages();
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
      composeTodaySheet();
    } else if (mode === 'todos') {
      restoreTaskRegister();
      composeTodoSheet();
    } else if (mode === 'schedule') {
      restoreTaskRegister();
      composeWeeklyPages();
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
    });
  }

  function watchJournalViews() {
    for (const id of ['todayView', 'todoView', 'scheduleView', 'workMemoViewV167']) {
      const view = document.getElementById(id);
      if (!view || journalViewObservers.has(view)) continue;
      journalViewObservers.add(view);
      new MutationObserver(requestJournalCompose).observe(view, {childList:true});
    }
  }
  watchJournalViews();
  new MutationObserver(() => {
    watchJournalViews();
    requestJournalCompose();
  }).observe(main, {childList:true});


  let weekIntent = false;
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
    if (body.classList.contains('work-memo-mode-v167')) return 'memo';
    const selected = navigation.querySelector('.nav-item.active[data-layout], .nav-item.active[data-work-memo-layout]');
    if (selected?.hasAttribute('data-work-memo-layout')) return 'memo';
    if (selected?.dataset.layout) return selected.dataset.layout;
    if (body.classList.contains('todo-mode')) return 'todos';
    if (body.classList.contains('task-mode')) return 'tasks';
    if (body.classList.contains('schedule-mode')) return 'schedule';
    return 'today';
  }

  function syncNavigation() {
    queued = false;
    if (!isJournal()) return;
    syncJournalLineIcons();
    const canonical = canonicalRoute();
    if (canonical !== 'schedule') weekIntent = false;
    const weeklyActive = Boolean(document.querySelector('#scheduleView [data-schedule-range="week"].active'));
    currentRoute = canonical === 'schedule' && weekIntent && weeklyActive ? 'week'
      : canonical === 'dashboard' ? 'tasks' : canonical;
    for (const [id, button] of [...tabButtons, ...dockButtons]) {
      const route = routes.find(entry => entry.id === id);
      const found = Boolean(sidebar.querySelector(route.target));
      button.disabled = !found;
      if (currentRoute === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    body.dataset.journalRoute = currentRoute;
    requestJournalCompose();
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
    weekIntent = id === 'week';
    target.click();
    closeMenu();
    closePreferences();
    closeDrawer();
    body.dataset.journalSheet = 'left';
    syncPages();
    if (id === 'week') {
      requestAnimationFrame(() => {
        const week = document.querySelector('#scheduleView [data-schedule-range="week"]');
        if (week && !week.classList.contains('active')) week.click();
        scheduleSync();
      });
    }
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

  function openDrawer() {
    if (!isJournal() || drawerOpen) return;
    closeMenu();
    closePreferences();
    drawerOpen = true;
    lastFocus = document.activeElement;
    body.dataset.journalSettingsOpen = 'true';
    document.addEventListener('keydown', onEscape);
    sidebar.querySelector('.wb-display-option-v356[aria-pressed="true"]')?.focus();
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
    const todayView = document.getElementById('todayView');
    if (todayView) new MutationObserver(syncJournalLineIcons).observe(todayView, { childList: true });
    new MutationObserver(() => {
      if (isJournal()) {
        applyTheme(loadTheme(), false);
        dateLabel();
        scheduleSync();
      } else {
        restoreJournalComposition();
        closeDrawer();
        closeMenu();
        closePreferences();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-wb-display'] });
    new MutationObserver(scheduleSync).observe(navigation, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
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
})();
