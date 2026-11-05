/* JOURNAL v367: presentation only. Business operations and data are canonical.
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
        '<h1>JOURNAL <span class="wb-journal-edition-v367">Linen</span></h1></div>',
      '</div>',
      '<div class="wb-journal-actions-v367">',
        '<div class="wb-journal-skin-v367" role="group" aria-label="手帳デザイン">',
          '<button type="button" data-journal-theme="linen" aria-pressed="true">Linen</button>',
          '<button type="button" data-journal-theme="margin" aria-pressed="false">Margin</button>',
        '</div>',
        '<button class="wb-journal-settings-v367" type="button" data-journal-settings aria-expanded="false" aria-controls="wbJournalSidebarV367">設定・切替</button>',
      '</div>',
    '</div>',
    '<div class="wb-journal-navigation-v367">',
      '<div class="wb-journal-date-v367"><span class="wb-journal-date-label-v367"></span>',
        '<small class="wb-journal-page-caption-v367">今日の仕事を、手帳の1ページに。</small></div>',
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
  const createToggle = header.querySelector('.wb-journal-add-toggle-v367');
  const createMenu = header.querySelector('#wbJournalCreateMenuV367');
  const pageButtons = Array.from(header.querySelectorAll('[data-journal-sheet]'));
  let weekIntent = false;
  let menuOpen = false;
  let drawerOpen = false;
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
    header.querySelector('.wb-journal-edition-v367').textContent = next === 'margin' ? 'Margin' : 'Linen';
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
    const canonical = canonicalRoute();
    if (canonical !== 'schedule') weekIntent = false;
    const weeklyActive = Boolean(document.querySelector('#scheduleView [data-schedule-range="week"].active'));
    currentRoute = canonical === 'schedule' && weekIntent && weeklyActive ? 'week' : canonical;
    for (const [id, button] of [...tabButtons, ...dockButtons]) {
      const route = routes.find(entry => entry.id === id);
      const found = Boolean(sidebar.querySelector(route.target));
      button.disabled = !found;
      if (currentRoute === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    header.querySelector('.wb-journal-page-caption-v367').textContent = ({
      today: '今日の仕事を、手帳の1ページに。',
      week: 'この7日間の予定を見通します。',
      todos: 'ひとつずつ、確実に終わらせる。',
      tasks: '進行中の仕事を整理する。',
      schedule: '予定を時間軸で確認する。',
      memo: '必要な情報をすぐ手元に。'
    })[currentRoute] || '';
    body.dataset.journalRoute = currentRoute;
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
    }
  }

  function openDrawer() {
    if (!isJournal() || drawerOpen) return;
    closeMenu();
    drawerOpen = true;
    lastFocus = document.activeElement;
    body.dataset.journalSettingsOpen = 'true';
    settingsButton.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onEscape);
    sidebar.querySelector('.wb-display-option-v356[aria-pressed="true"]')?.focus();
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    body.dataset.journalSettingsOpen = 'false';
    settingsButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onEscape);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function outsideCreate(event) {
    if (!header.querySelector('.wb-journal-add-v367')?.contains(event.target)) closeMenu();
  }

  function openMenu() {
    if (!isJournal() || menuOpen) return;
    closeDrawer();
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
  settingsButton.addEventListener('click', () => drawerOpen ? closeDrawer() : openDrawer());
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
      if (isJournal()) {
        applyTheme(loadTheme(), false);
        dateLabel();
        scheduleSync();
      } else {
        closeDrawer();
        closeMenu();
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
