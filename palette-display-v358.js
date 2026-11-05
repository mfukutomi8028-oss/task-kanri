/* Palette v358: presentation-only shortcuts. The Classic app remains the only
   owner of navigation, tasks, schedules, ToDo and Firebase writes. */
(function installPaletteDisplayV358() {
  'use strict';
  if (document.getElementById('wbPaletteMobileDockV358')) return;

  const root = document.documentElement;
  const sidebar = document.querySelector('.sidebar');
  const navigation = sidebar?.querySelector('.nav');
  if (!sidebar || !navigation || !document.body) return;

  const activeMode = () => root.dataset.wbDisplay === 'palette';
  const entries = [
    { id: 'today', title: '今日', icon: 'assets/nav-today-v169.svg', selector: '.nav-item[data-layout="today"]' },
    { id: 'todos', title: 'ToDo', icon: 'assets/nav-todo-v168.svg', selector: '.nav-item[data-layout="todos"]' },
    { id: 'tasks', title: 'タスク', icon: 'assets/nav-task-v169.svg', selector: '.nav-item[data-layout="tasks"]' },
    { id: 'schedule', title: '予定', icon: 'assets/nav-schedule-v169.svg', selector: '.nav-item[data-layout="schedule"]' }
  ];

  // Original navigation and its handlers are never cloned or replaced.
  const wordmark = document.createElement('div');
  wordmark.className = 'wb-palette-wordmark-v358';
  wordmark.setAttribute('aria-label', 'Palette 業務管理ボード');
  const motif = document.createElement('span');
  motif.className = 'wb-palette-motif-v358';
  motif.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) motif.appendChild(document.createElement('i'));
  const words = document.createElement('span');
  words.className = 'wb-palette-wordmark-text-v358';
  const title = document.createElement('strong');
  title.textContent = 'palette.';
  const sub = document.createElement('small');
  sub.textContent = 'WORK BOARD';
  words.append(title, sub);
  wordmark.append(motif, words);
  const classicBrand = sidebar.querySelector('.brand');
  if (classicBrand) classicBrand.before(wordmark);
  else sidebar.prepend(wordmark);

  const dock = document.createElement('nav');
  dock.id = 'wbPaletteMobileDockV358';
  dock.className = 'wb-palette-mobile-dock-v358';
  dock.setAttribute('aria-label', 'Palette画面のメニュー');
  const tabs = new Map();
  for (const item of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.paletteRoute = item.id;
    const icon = document.createElement('img');
    icon.src = item.icon;
    icon.alt = '';
    const label = document.createElement('span');
    label.textContent = item.title;
    button.append(icon, label);
    button.addEventListener('click', () => {
      if (!activeMode()) return;
      sidebar.querySelector(item.selector)?.click();
      queueMicrotask(syncTabs);
    });
    dock.appendChild(button);
    tabs.set(item.id, button);
  }
  const more = document.createElement('button');
  more.type = 'button';
  more.dataset.paletteRoute = 'more';
  more.setAttribute('aria-label', 'その他・設定を開く');
  const moreGlyph = document.createElement('b');
  moreGlyph.className = 'wb-palette-more-glyph-v358';
  moreGlyph.textContent = '•••';
  moreGlyph.setAttribute('aria-hidden', 'true');
  const moreText = document.createElement('span');
  moreText.textContent = 'その他';
  more.append(moreGlyph, moreText);
  more.addEventListener('click', () => {
    if (!activeMode()) return;
    document.querySelector('.work-mobile-menu-button')?.click();
  });
  dock.appendChild(more);
  tabs.set('more', more);
  document.body.appendChild(dock);

  const createWidget = document.createElement('div');
  createWidget.className = 'wb-palette-create-v358';
  createWidget.id = 'wbPaletteCreateV358';
  const createButton = document.createElement('button');
  createButton.className = 'wb-palette-fab-v358';
  createButton.type = 'button';
  createButton.textContent = '＋';
  createButton.setAttribute('aria-label', '新しいタスクまたは予定を作成');
  createButton.setAttribute('aria-expanded', 'false');
  createButton.setAttribute('aria-controls', 'wbPaletteCreateMenuV358');
  const createMenu = document.createElement('div');
  createMenu.id = 'wbPaletteCreateMenuV358';
  createMenu.className = 'wb-palette-create-menu-v358';
  createMenu.hidden = true;
  for (const [id, label] of [['task', '＋ 新しいタスク'], ['schedule', '＋ 新しい予定']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.paletteCreate = id;
    button.textContent = label;
    createMenu.appendChild(button);
  }
  createWidget.append(createMenu, createButton);
  document.body.appendChild(createWidget);

  let transientBound = false;
  function closeMenu(restoreFocus = false) {
    const wasOpen = !createMenu.hidden;
    createMenu.hidden = true;
    createButton.setAttribute('aria-expanded', 'false');
    if (transientBound) {
      transientBound = false;
      document.removeEventListener('pointerdown', outsideMenu, true);
      document.removeEventListener('keydown', menuKeydown, true);
    }
    if (wasOpen && restoreFocus) createButton.focus();
  }
  function outsideMenu(event) {
    if (!createWidget.contains(event.target)) closeMenu();
  }
  function menuKeydown(event) {
    if (event.key === 'Escape' && !createMenu.hidden) {
      event.preventDefault();
      closeMenu(true);
    }
  }
  function openMenu() {
    if (!activeMode()) return;
    createMenu.hidden = false;
    createButton.setAttribute('aria-expanded', 'true');
    if (!transientBound) {
      transientBound = true;
      document.addEventListener('pointerdown', outsideMenu, true);
      document.addEventListener('keydown', menuKeydown, true);
    }
    createMenu.querySelector('button')?.focus();
  }
  createButton.addEventListener('click', () => {
    if (createMenu.hidden) openMenu();
    else closeMenu(true);
  });
  createMenu.addEventListener('click', event => {
    const item = event.target.closest('[data-palette-create]');
    if (!item || !activeMode()) return;
    const action = item.dataset.paletteCreate;
    closeMenu();
    // Existing mobile-shell actions are the owners of create commands.
    const native = document.querySelector('[data-mobile-create="' + action + '"]');
    if (native) { native.click(); return; }
    if (action === 'task') { document.getElementById('newTask')?.click(); return; }
    if (action === 'schedule') {
      sidebar.querySelector('.nav-item[data-layout="schedule"]')?.click();
      document.querySelector('[data-new-schedule]')?.click();
    }
  });

  function syncTabs() {
    if (!activeMode()) { closeMenu(); return; }
    const memoActive = Boolean(sidebar.querySelector('[data-work-memo-layout].active'));
    const active = memoActive ? 'more'
      : sidebar.querySelector('.nav .nav-item[data-layout].active')?.dataset.layout || 'today';
    for (const [id, button] of tabs) {
      const selected = id === active;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  // Watch canonical navigation only, not task collections.
  const navigationObserver = new MutationObserver(() => queueMicrotask(syncTabs));
  navigationObserver.observe(navigation, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class']
  });
  const modeObserver = new MutationObserver(syncTabs);
  modeObserver.observe(root, { attributes: true, attributeFilter: ['data-wb-display'] });
  syncTabs();
})();
