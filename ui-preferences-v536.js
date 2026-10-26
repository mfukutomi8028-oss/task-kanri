// Ver.536: appearance only. Do not touch Firebase, document order, task data or shared room metadata.
(function installAppearancePreferencesV536() {
  'use strict';
  const PREFIX = 'work-board-appearance-v536:';
  const validDesign = new Set(['classic', 'signal']);
  const validTone = new Set(['bright', 'midnight']);
  const root = document.getElementById('wbSettingsDialog');
  const button = document.getElementById('wbOpenSettings');
  const roomField = document.getElementById('wbSettingsRoomName');
  const roomSource = document.getElementById('roomNameInput');
  const toneGroup = document.getElementById('wbToneSettings');
  const userSelect = document.getElementById('currentUserSelect');
  const startupForm = document.getElementById('userForm');
  if (!root || !button || !toneGroup || !roomField) return;
  if (root.dataset.appearanceBound === 'true') return;
  root.dataset.appearanceBound = 'true';

  function currentRoom() {
    const fromUrl = new URLSearchParams(location.search).get('room');
    const stored = (() => { try { return localStorage.getItem('systemTaskRoomId'); } catch { return ''; } })();
    return String(fromUrl || stored || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 60);
  }
  function currentUser() {
    let value = '';
    try { value = localStorage.getItem('systemTaskUser') || ''; } catch {}
    return String(value || userSelect?.value || 'unselected').slice(0, 80);
  }
  function storageKey() {
    return PREFIX + encodeURIComponent(currentRoom()) + ':' + encodeURIComponent(currentUser());
  }
  function validate(raw) {
    return {
      design: validDesign.has(raw?.design) ? raw.design : 'classic',
      tone: validTone.has(raw?.tone) ? raw.tone : 'bright'
    };
  }
  function readChoice() {
    try { return validate(JSON.parse(localStorage.getItem(storageKey()) || 'null')); }
    catch { return validate(null); }
  }
  function saveChoice(choice) {
    try { localStorage.setItem(storageKey(), JSON.stringify(validate(choice))); }
    catch { /* The theme remains available for this tab even without storage. */ }
  }

  let selected = readChoice();
  let loadedScope = storageKey();
  function apply(choice) {
    selected = validate(choice);
    document.body.dataset.wbDesign = selected.design;
    document.body.dataset.wbTone = selected.tone;
    // CSS scoped to body above; html is used only for the small mobile canvas background.
    document.documentElement.dataset.wbDesign = selected.design;
    document.documentElement.dataset.wbTone = selected.tone;
    root.querySelectorAll('input[name="wbPreferenceDesign"]').forEach(input => {
      input.checked = input.value === selected.design;
    });
    root.querySelectorAll('input[name="wbPreferenceTone"]').forEach(input => {
      input.checked = input.value === selected.tone;
    });
    toneGroup.disabled = selected.design !== 'signal';
    window.WORK_BOARD_APPEARANCE = { ...selected };
    window.dispatchEvent(new CustomEvent('workboard:appearance-changed', { detail: { ...selected } }));
  }
  function loadCurrentUserChoice() {
    const key = storageKey();
    if (loadedScope === key) return;
    loadedScope = key;
    apply(readChoice());
  }
  function openSettings() {
    // モバイルメニュー内から設定を開いた場合は、既存シェルの終了処理を使用する。
    // 背面ドロワーの開いた状態やEscapeリスナーを残さない。
    if (document.body.classList.contains('work-mobile-menu-open')) {
      document.querySelector('.work-mobile-overlay')?.click();
    }
    loadCurrentUserChoice();
    apply(selected);
    if (roomSource) roomField.value = roomSource.value || '';
    if (!root.open) root.showModal();
  }
  button.addEventListener('click', openSettings);
  document.getElementById('wbCloseSettings')?.addEventListener('click', () => root.close());
  root.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === 'wbPreferenceDesign' && validDesign.has(input.value)) {
      apply({ ...selected, design: input.value });
      saveChoice(selected);
    } else if (input.name === 'wbPreferenceTone' && validTone.has(input.value)) {
      apply({ ...selected, tone: input.value });
      saveChoice(selected);
    } else if (input === roomField && roomSource) {
      // Forward to the canonical existing input handler; no duplicate Firebase writer.
      roomSource.value = input.value;
      roomSource.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  root.querySelectorAll('[data-wb-existing-setting]').forEach(link => {
    link.addEventListener('click', () => {
      const targetId = link.dataset.wbExistingSetting;
      if (!['manageUsers', 'manageStatuses', 'manageCategories'].includes(targetId)) return;
      const existing = document.getElementById(targetId);
      if (!existing || existing.disabled) return;
      root.close();
      existing.click();
    });
  });
  // The canonical app owns user selection; observe only its small user label to avoid
  // observing the entire app DOM or creating a competing synchronization owner.
  const userLabel = document.getElementById('currentUserLabel');
  if (userLabel) new MutationObserver(loadCurrentUserChoice)
    .observe(userLabel, { childList: true, characterData: true, subtree: true });
  userSelect?.addEventListener('change', () => queueMicrotask(loadCurrentUserChoice));
  startupForm?.addEventListener('submit', () => queueMicrotask(loadCurrentUserChoice));
  window.addEventListener('pageshow', loadCurrentUserChoice);
  window.addEventListener('storage', event => {
    if (event.key === storageKey() || event.key === 'systemTaskUser' || event.key === 'systemTaskRoomId') {
      loadedScope = '';
      loadCurrentUserChoice();
    }
  });

  apply(selected);
  window.WORK_BOARD_APPEARANCE_VERSION = '536';
})();
