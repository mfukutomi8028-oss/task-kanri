/* Classic color templates. Local per-user, per-room preference only; no Firebase writes. */
(function initClassicColorThemesV329() {
  'use strict';
  if (document.getElementById('wbColorThemeButton')) return;
  const THEMES = Object.freeze([
    { id: 'default', label: 'オリジナル' },
    { id: 'sky', label: 'スカイブルー' },
    { id: 'lavender', label: 'ラベンダー' },
    { id: 'mint', label: 'ミントグリーン' },
    { id: 'rose', label: 'ローズピンク' },
    { id: 'peach', label: 'ピーチ' },
    { id: 'amber', label: 'アンバー' },
    { id: 'slate', label: 'スレート' }
  ]);
  const STORAGE_PREFIX = 'workBoardColorThemeV329:';
  const root = document.documentElement;
  const userCard = document.querySelector('.sidebar .user-card');
  if (!userCard) return;

  function scopeKey() {
    let room = new URLSearchParams(location.search).get('room');
    let user = '';
    try {
      room = room || localStorage.getItem('systemTaskRoomId');
      user = localStorage.getItem('systemTaskUser') || '';
    } catch (_) { /* Private browsing may block storage. */ }
    room = String(room || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 60);
    return STORAGE_PREFIX + encodeURIComponent(room) + ':' + encodeURIComponent(user);
  }
  function isValid(id) { return THEMES.some(theme => theme.id === id); }
  function load() {
    try {
      const saved = localStorage.getItem(scopeKey());
      return isValid(saved) ? saved : 'default';
    } catch (_) { return 'default'; }
  }

  const field = document.createElement('div');
  field.className = 'wb-color-theme-field';
  const fieldLabel = document.createElement('span');
  fieldLabel.className = 'side-label';
  fieldLabel.id = 'wbColorThemeLabel';
  fieldLabel.textContent = '画面の色';
  const trigger = document.createElement('button');
  trigger.id = 'wbColorThemeButton';
  trigger.className = 'wb-color-theme-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-labelledby', 'wbColorThemeLabel wbColorThemeTriggerLabel');
  trigger.setAttribute('aria-haspopup', 'dialog');
  const dot = document.createElement('span');
  dot.className = 'wb-color-theme-trigger-dot';
  dot.setAttribute('aria-hidden', 'true');
  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'wb-color-theme-trigger-label';
  triggerLabel.id = 'wbColorThemeTriggerLabel';
  const changeText = document.createElement('span');
  changeText.className = 'wb-color-theme-trigger-action';
  changeText.textContent = '変更';
  trigger.append(dot, triggerLabel, changeText);
  field.append(fieldLabel, trigger);
  const roomInput = userCard.querySelector('#roomNameInput');
  if (roomInput) roomInput.insertAdjacentElement('afterend', field);
  else userCard.appendChild(field);

  const dialog = document.createElement('dialog');
  dialog.className = 'wb-color-theme-dialog';
  dialog.id = 'wbColorThemeDialog';
  dialog.setAttribute('aria-labelledby', 'wbColorThemeTitle');
  const header = document.createElement('div');
  header.className = 'wb-color-theme-dialog-header';
  const title = document.createElement('h2');
  title.id = 'wbColorThemeTitle';
  title.textContent = '画面の色を選ぶ';
  const closeButton = document.createElement('button');
  closeButton.className = 'wb-color-theme-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '色の設定を閉じる');
  header.append(title, closeButton);
  const help = document.createElement('p');
  help.className = 'wb-color-theme-description';
  help.textContent = '選ぶとすぐに色が変わります。レイアウトや業務データは変更されません。';
  const choices = document.createElement('div');
  choices.className = 'wb-color-theme-options';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'カラーテンプレート');
  const buttons = new Map();
  THEMES.forEach(theme => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wb-color-theme-option';
    button.dataset.theme = theme.id;
    button.setAttribute('aria-pressed', 'false');
    const preview = document.createElement('span');
    preview.className = 'wb-color-theme-preview';
    preview.setAttribute('aria-hidden', 'true');
    const side = document.createElement('span');
    side.className = 'wb-color-theme-preview-sidebar';
    const main = document.createElement('span');
    main.className = 'wb-color-theme-preview-main';
    const highlight = document.createElement('span');
    highlight.className = 'wb-color-theme-preview-highlight';
    const paper = document.createElement('span');
    paper.className = 'wb-color-theme-preview-paper';
    main.append(highlight, paper);
    preview.append(side, main);
    const label = document.createElement('span');
    label.className = 'wb-color-theme-option-name';
    label.textContent = theme.label;
    button.append(preview, label);
    button.addEventListener('click', () => selectTheme(theme.id));
    choices.appendChild(button);
    buttons.set(theme.id, button);
  });
  const note = document.createElement('p');
  note.className = 'wb-color-theme-dialog-note';
  note.textContent = '設定はこの端末の利用者・ルームごとに保存されます。ほかの利用者には影響しません。';
  dialog.append(header, help, choices, note);
  document.body.appendChild(dialog);

  function apply(themeId) {
    const current = isValid(themeId) ? themeId : 'default';
    root.dataset.wbColorTheme = current;
    const selected = THEMES.find(item => item.id === current);
    triggerLabel.textContent = selected.label;
    buttons.forEach((button, id) => {
      button.setAttribute('aria-pressed', String(id === current));
    });
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const color = current === 'default'
        ? '#255f9f'
        : getComputedStyle(root).getPropertyValue('--wb-theme-hero-a').trim();
      if (color) themeMeta.content = color;
    }
  }

  function selectTheme(id) {
    if (!isValid(id)) return;
    try {
      if (id === 'default') localStorage.removeItem(scopeKey());
      else localStorage.setItem(scopeKey(), id);
    } catch (_) { /* Apply for the current session even when storage is unavailable. */ }
    apply(id);
  }

  trigger.addEventListener('click', () => dialog.showModal());
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  const refresh = () => apply(load());
  document.getElementById('currentUserSelect')?.addEventListener('change', () => queueMicrotask(refresh));
  document.getElementById('userForm')?.addEventListener('submit', () => queueMicrotask(refresh));
  window.addEventListener('storage', event => {
    if (event.key === 'systemTaskUser' || event.key === 'systemTaskRoomId'
      || event.key === null || (event.key && event.key.startsWith(STORAGE_PREFIX))) refresh();
  });
  window.addEventListener('pageshow', refresh);
  apply(load());
})();
