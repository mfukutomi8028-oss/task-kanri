/* Modern display selector. The Classic DOM is the only data and action owner.
   This module changes presentation only: no duplicate Firebase client, event
   handlers for tasks, schedule stores, or second write path. */
(function installModernDisplayV356() {
  'use strict';
  if (document.getElementById('wbDisplayChoiceV356')) return;

  const root = document.documentElement;
  const prefix = 'workBoardDisplayV356:';
  const valid = new Set(['classic', 'modern', 'palette', 'journal']);
  const cards = document.querySelector('.sidebar .user-card');
  const sidebar = document.querySelector('.sidebar');
  if (!cards || !sidebar) return;

  function storageKey() {
    let room = '';
    let user = '';
    try {
      room = new URLSearchParams(location.search).get('room')
        || localStorage.getItem('systemTaskRoomId') || 'default';
      user = localStorage.getItem('systemTaskUser') || '';
    } catch { room = 'default'; }
    room = String(room).replace(/[.#$/\[\]]/g, '-').slice(0, 60);
    return prefix + encodeURIComponent(room) + ':' + encodeURIComponent(String(user));
  }

  function storedMode() {
    try {
      const value = localStorage.getItem(storageKey());
      return valid.has(value) ? value : 'classic';
    } catch {
      return 'classic';
    }
  }

  const field = document.createElement('div');
  field.id = 'wbDisplayChoiceV356';
  field.className = 'wb-display-choice-v356';
  const title = document.createElement('span');
  title.id = 'wbDisplayLabelV356';
  title.className = 'side-label';
  title.textContent = '画面デザイン';

  const group = document.createElement('div');
  group.className = 'wb-display-segments-v356';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', title.id);
  const buttons = new Map();
  for (const [id, name, description] of [
    ['classic', 'Classic', '従来の画面デザイン'],
    ['modern', 'Origin', '独立したOrigin画面'],
    ['palette', 'Palette', 'ポップで使いやすい業務管理画面'],
    ['journal', 'Journal', '手帳型のLinen・Marginを切り替えられます']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wb-display-option-v356';
    button.dataset.wbDisplayChoice = id;
    button.textContent = name;
    button.title = description;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectMode(id));
    group.appendChild(button);
    buttons.set(id, button);
  }
  const help = document.createElement('small');
  help.className = 'wb-display-help-v356';
  help.textContent = '4つの画面で同じ業務データ・機能を使います。';
  help.id = 'wbDisplayHelpV356';
  help.setAttribute('role', 'status');
  field.append(title, group, help);

  const color = cards.querySelector('.wb-color-theme-field');
  const room = cards.querySelector('#roomNameInput');
  if (color) color.insertAdjacentElement('afterend', field);
  else if (room) room.insertAdjacentElement('afterend', field);
  else cards.appendChild(field);

  // Palette now opens the independent NEXT canvas. Keep the former Palette
  // runtime present for safe fallback if the new assets fail to load.
  let paletteNextLoading = false;
  function loadPaletteNext() {
    if (root.dataset.wbDisplay !== 'palette'
      || !window.WORK_BOARD_ASSETS_READY
      || document.getElementById('paletteNextRoot')
      || paletteNextLoading) return;
    paletteNextLoading = true;
    const version = String(window.WORK_BOARD_RELEASE?.version || '369');
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'palette-next-v369.css?v=' + encodeURIComponent(version);
    css.dataset.paletteNextStyleV369 = 'true';
    const script = document.createElement('script');
    script.src = 'palette-next-v369.js?v=' + encodeURIComponent(version);
    script.dataset.paletteNextScriptV369 = 'true';
    script.onerror = () => {
      paletteNextLoading = false;
      css.remove();
      script.remove();
      root.removeAttribute('data-wb-palette-next-preview');
      console.error('Palette NEXT could not load; original Palette remains available.');
    };
    css.onerror = () => {
      paletteNextLoading = false;
      css.remove();
      console.error('Palette NEXT stylesheet could not load; original Palette remains available.');
    };
    css.onload = () => document.body.appendChild(script);
    document.head.appendChild(css);
  }
  if (window.WORK_BOARD_ASSETS_READY) loadPaletteNext();
  else window.addEventListener('workboard:assets-ready', loadPaletteNext, {once:true});

  // On small screens, the original filter controls are still accessible
  // under an explicit toggle rather than occupying the whole first screen.
  const filters = sidebar.querySelector('.side-card.filters');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'wb-modern-filter-toggle-v356';
  toggle.id = 'wbModernFiltersToggleV356';
  toggle.setAttribute('aria-controls', 'wbModernFilterPanelV356');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = '絞り込み条件を表示';
  if (filters) {
    filters.id = filters.id || 'wbModernFilterPanelV356';
    filters.before(toggle);
    toggle.addEventListener('click', () => {
      const open = document.body.dataset.modernFiltersOpen === 'true';
      document.body.dataset.modernFiltersOpen = String(!open);
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? '絞り込み条件を表示' : '絞り込み条件を閉じる';
    });
  }


  // Adaptive Work Hub uses the existing navigation controls as the only
  // command owners. The desktop dock is the actual nav; mobile buttons merely
  // forward clicks to those same controls.
  const primaryNav = sidebar.querySelector('.nav .nav-group');
  const navigation = sidebar.querySelector('.nav');
  const modernRoutes = [
    { id: 'today', label: '今日', selector: '.nav-item[data-layout="today"]', icon: 'assets/nav-today-v169.svg' },
    { id: 'tasks', label: 'タスク', selector: '.nav-item[data-layout="tasks"]', icon: 'assets/nav-task-v169.svg' },
    { id: 'todos', label: 'ToDo', selector: '.nav-item[data-layout="todos"]', icon: 'assets/nav-todo-v168.svg' },
    { id: 'schedule', label: '予定', selector: '.nav-item[data-layout="schedule"]', icon: 'assets/nav-schedule-v169.svg' },
    { id: 'memo', label: 'メモ', selector: '[data-work-memo-layout]', icon: 'assets/nav-memo-v168.svg' }
  ];
  const routeHelp = {
    today: ['今日の仕事', '今日の優先事項を確認'],
    tasks: ['タスク', '一覧・ボード・期限を整理'],
    todos: ['ToDo', '個人のやることを確認'],
    schedule: ['スケジュール', '予定と関連タスクを確認'],
    memo: ['業務メモ', '共有メモをすばやく参照']
  };
  const mobileButtons = new Map();
  const quickFilterButtons = new Map();
  let contextToggle = null;
  let contextHeading = null;
  const contextPrefix = 'workBoardModernContextV356:';
  let sessionContextKey = '';
  let sessionContextCollapsed = null;

  function contextStorageKey() {
    return storageKey().replace(prefix, contextPrefix);
  }
  function readContextCollapsed() {
    const key = contextStorageKey();
    // Preserve the room/user selection even when localStorage cannot be written.
    if (sessionContextKey === key && sessionContextCollapsed !== null) {
      return sessionContextCollapsed;
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored === 'collapsed') return true;
      if (stored === 'expanded') return false;
    } catch { /* Fall back to the responsive default. */ }
    return Boolean(window.matchMedia?.('(min-width:861px) and (max-width:1180px)').matches);
  }
  function syncContext() {
    const collapsed = readContextCollapsed();
    document.body.dataset.modernContextCollapsed = String(collapsed);
    if (contextToggle) {
      contextToggle.setAttribute('aria-expanded', String(!collapsed));
      contextToggle.setAttribute('aria-label', collapsed ? 'サイドパネルを開く' : 'サイドパネルを折りたたむ');
      contextToggle.title = collapsed ? 'サイドパネルを開く' : 'サイドパネルを折りたたむ';
    }
  }
  function selectContext(collapsed) {
    sessionContextKey = contextStorageKey();
    sessionContextCollapsed = Boolean(collapsed);
    try {
      localStorage.setItem(sessionContextKey, collapsed ? 'collapsed' : 'expanded');
    } catch { /* Keep a session-only preference for this room and user. */ }
    syncContext();
  }

  if (primaryNav && typeof primaryNav.appendChild === 'function') {
    const logo = document.createElement('span');
    logo.className = 'wb-modern-dock-logo-v356';
    const image = document.createElement('img');
    image.src = 'assets/brand-v184.svg';
    image.alt = '';
    logo.appendChild(image);
    primaryNav.insertBefore?.(logo, primaryNav.firstChild);

    contextToggle = document.createElement('button');
    contextToggle.id = 'wbModernContextToggleV356';
    contextToggle.type = 'button';
    contextToggle.className = 'wb-modern-context-toggle-v356';
    contextToggle.textContent = '☷';
    contextToggle.setAttribute('aria-controls', sidebar.id || 'wbModernSidebarV356');
    contextToggle.addEventListener('click', () =>
      selectContext(document.body.dataset.modernContextCollapsed !== 'true'));
    if (!sidebar.id) sidebar.id = 'wbModernSidebarV356';
    primaryNav.appendChild(contextToggle);

    const context = document.createElement('section');
    context.id = 'wbModernContextHeadingV356';
    context.className = 'wb-modern-context-heading-v356';
    const kicker = document.createElement('span');
    kicker.textContent = 'WORKSPACE';
    const heading = document.createElement('h2');
    const description = document.createElement('p');
    context.append(kicker, heading, description);
    contextHeading = { heading, description };
    sidebar.insertBefore?.(context, navigation);
  }

  if (typeof document.body?.appendChild === 'function') {
    const dock = document.createElement('nav');
    dock.id = 'wbModernMobileDockV356';
    dock.className = 'wb-modern-mobile-dock-v356';
    dock.setAttribute('aria-label', 'モダン画面のメニュー');
    for (const route of modernRoutes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wb-modern-mobile-tab-v356';
      button.dataset.modernMobileRoute = route.id;
      button.setAttribute('aria-label', route.label);
      const icon = document.createElement('img');
      icon.src = route.icon;
      icon.alt = '';
      const caption = document.createElement('span');
      caption.textContent = route.label;
      button.append(icon, caption);
      button.addEventListener('click', () => {
        const canonical = sidebar.querySelector(route.selector);
        canonical?.click();
        queueMicrotask(syncNavigation);
      });
      dock.appendChild(button);
      mobileButtons.set(route.id, button);
    }
    document.body.appendChild(dock);

    const main = document.getElementById('mainContent');
    const summary = main?.querySelector('.summary-grid');
    if (summary) {
      const chips = document.createElement('nav');
      chips.id = 'wbModernQuickFiltersV356';
      chips.className = 'wb-modern-quick-filters-v356';
      chips.setAttribute('aria-label', 'タスクのクイック絞り込み');
      for (const [key, label] of [['mine', '自分の担当'], ['favorite', 'スター'], ['done', '完了']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wb-modern-filter-chip-v356';
        button.dataset.modernQuickFilter = key;
        button.textContent = label;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          sidebar.querySelector('.nav-filter[data-filter="' + key + '"]')?.click();
          queueMicrotask(syncNavigation);
        });
        chips.appendChild(button);
        quickFilterButtons.set(key, button);
      }
      summary.insertAdjacentElement('beforebegin', chips);
    }
  }

  function syncNavigation() {
    const active = primaryNav?.querySelector('.nav-item.active');
    const route = active?.hasAttribute('data-work-memo-layout')
      ? 'memo' : (active?.dataset.layout || 'today');
    const info = routeHelp[route] || routeHelp.today;
    document.body.dataset.modernActiveRoute = route;
    if (contextHeading) {
      contextHeading.heading.textContent = info[0];
      contextHeading.description.textContent = info[1];
    }
    for (const entry of modernRoutes) {
      const button = mobileButtons.get(entry.id);
      if (!button) continue;
      const exists = Boolean(sidebar.querySelector(entry.selector));
      const selected = route === entry.id;
      button.disabled = !exists;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const [key, button] of quickFilterButtons) {
      const current = sidebar.querySelector('.nav-filter[data-filter="' + key + '"]');
      button.setAttribute('aria-pressed', String(Boolean(current?.classList.contains('active'))));
    }
  }

  // Watch only the canonical navigation; never observe task cards or data
  // collections. Memo navigation may appear after initial script activation.
  if (navigation && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => queueMicrotask(syncNavigation)).observe(navigation, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class']
    });
  }

  function apply(mode) {
    const next = valid.has(mode) ? mode : 'classic';
    root.dataset.wbDisplay = next;
    buttons.forEach((button, id) =>
      button.setAttribute('aria-pressed', String(id === next)));
    if (next !== 'modern') {
      document.body.dataset.modernFiltersOpen = 'false';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '絞り込み条件を表示';
    }
    help.textContent = '4つの画面で同じ業務データ・機能を使います。';
    syncContext();
    syncNavigation();
    if (next === 'palette') loadPaletteNext();
  }

  function selectMode(mode) {
    if (!valid.has(mode)) return;
    if (document.querySelector('dialog[open]')
      || document.body.classList.contains('task-dragging')) {
      help.textContent = '編集中の画面を閉じてから切り替えてください。';
      return;
    }
    try {
      if (mode === 'classic') localStorage.removeItem(storageKey());
      else localStorage.setItem(storageKey(), mode);
    } catch { /* Session-only display changes remain possible. */ }
    apply(mode);
  }

  // Reuse the canonical mode preference scope from independent displays.
  window.WorkBoardDisplayController = Object.freeze({ getMode: () => root.dataset.wbDisplay, selectMode });
  const refresh = () => apply(storedMode());
  document.getElementById('currentUserSelect')
    ?.addEventListener('change', () => queueMicrotask(refresh));
  document.getElementById('userForm')
    ?.addEventListener('submit', () => queueMicrotask(refresh));
  window.addEventListener('storage', event => {
    if (event.key === null) {
      sessionContextKey = '';
      sessionContextCollapsed = null;
      refresh();
      return;
    }
    if (event.key.startsWith(contextPrefix)) {
      if (event.key === contextStorageKey()) {
        sessionContextKey = '';
        sessionContextCollapsed = null;
        syncContext();
      }
      return;
    }
    if (event.key === 'systemTaskUser' || event.key === 'systemTaskRoomId'
      || event.key.startsWith(prefix)) refresh();
  });
  window.addEventListener('pageshow', refresh);
  refresh();
})();
