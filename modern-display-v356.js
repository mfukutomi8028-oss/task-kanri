/* Modern display selector. The Classic DOM is the only data and action owner.
   This module changes presentation only: no duplicate Firebase client, event
   handlers for tasks, schedule stores, or second write path. */
(function installModernDisplayV356() {
  'use strict';
  if (document.getElementById('wbDisplayChoiceV356')) return;

  const root = document.documentElement;
  const prefix = 'workBoardDisplayV356:';
  const valid = new Set(['classic', 'modern']);
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
    ['modern', 'Modern', '新しい画面デザイン']
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
  help.textContent = 'どちらも同じ業務データ・機能を使います。';
  help.id = 'wbDisplayHelpV356';
  help.setAttribute('role', 'status');
  field.append(title, group, help);

  const color = cards.querySelector('.wb-color-theme-field');
  const room = cards.querySelector('#roomNameInput');
  if (color) color.insertAdjacentElement('afterend', field);
  else if (room) room.insertAdjacentElement('afterend', field);
  else cards.appendChild(field);

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

  function apply(mode) {
    const next = valid.has(mode) ? mode : 'classic';
    root.dataset.wbDisplay = next;
    buttons.forEach((button, id) =>
      button.setAttribute('aria-pressed', String(id === next)));
    if (next === 'classic') {
      document.body.dataset.modernFiltersOpen = 'false';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '絞り込み条件を表示';
    }
    help.textContent = 'どちらも同じ業務データ・機能を使います。';
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

  const refresh = () => apply(storedMode());
  document.getElementById('currentUserSelect')
    ?.addEventListener('change', () => queueMicrotask(refresh));
  document.getElementById('userForm')
    ?.addEventListener('submit', () => queueMicrotask(refresh));
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === 'systemTaskUser'
      || event.key === 'systemTaskRoomId'
      || (event.key && event.key.startsWith(prefix))) refresh();
  });
  window.addEventListener('pageshow', refresh);
  refresh();
})();
