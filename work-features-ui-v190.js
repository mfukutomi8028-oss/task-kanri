// Ver.190: presentation-only polish for business memos and reserved-task start dates.
(function installWorkFeaturesUiV190() {
  'use strict';

  const VERSION = '190';
  let patchQueued = false;
  let memoObserver = null;
  let bootstrapAttempts = 0;

  function schedulePatch() {
    if (patchQueued) return;
    patchQueued = true;
    requestAnimationFrame(() => {
      patchQueued = false;
      patchAll();
    });
  }

  function patchStartDateField() {
    const label = document.querySelector('.task-start-date-field-v167');
    if (!label || label.dataset.v190Polished === 'true') return;
    const input = label.querySelector('#taskStartDateV167');
    const note = label.querySelector('small');
    if (!input || !note) return;

    Array.from(label.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('開始日')) node.remove();
    });

    const heading = document.createElement('span');
    heading.className = 'task-start-date-heading-v168';

    const title = document.createElement('span');
    title.className = 'task-start-date-title-v168';
    title.textContent = '開始日';

    heading.appendChild(title);
    heading.appendChild(note);
    label.insertBefore(heading, input);
    label.dataset.v190Polished = 'true';
  }

  function patchMemoDialog() {
    const dialog = document.getElementById('workMemoDialogV167');
    if (!dialog) return;

    const title = dialog.querySelector('#workMemoTitleV167');
    const tags = dialog.querySelector('#workMemoTagsV167');
    const body = dialog.querySelector('#workMemoBodyV167');
    if (title) title.placeholder = '例：定例会議の参加URL';
    if (tags) tags.placeholder = '例：会議, Teams, 定例';
    if (body) body.placeholder = '例：\nURL：https://...\n開催：毎週月曜 10:00\n備考：資料は共有フォルダに保存';

    const row = dialog.querySelector('.work-memo-pin-row-v167');
    if (!row || row.dataset.v190Polished === 'true') return;
    const input = row.querySelector('#workMemoPinnedV167');
    if (!input) return;

    Array.from(row.childNodes).forEach(node => {
      if (node !== input) node.remove();
    });

    const copy = document.createElement('span');
    copy.className = 'work-memo-pin-copy-v168';
    copy.innerHTML = '<strong>一覧の上部に固定</strong><small>よく使うメモを一覧の先頭に表示します。</small>';
    row.appendChild(copy);
    row.dataset.v190Polished = 'true';
  }

  function patchMemoCards() {
    document.querySelectorAll('.work-memo-pin-v167').forEach(button => {
      const active = button.classList.contains('active');
      const text = active ? '固定解除' : '固定';
      if (button.textContent !== text) button.textContent = text;
      button.title = active ? '固定を解除' : '一覧の上部に固定';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.querySelectorAll('.work-memo-empty-v167 p').forEach(node => {
      if (node.textContent.includes('稟議メールの宛先')) {
        node.textContent = '定例会議のURL、共有フォルダの場所、よく使う手順などから登録すると便利です。';
      }
    });
  }

  function patchMemoDensity() {
    const root = document.getElementById('workMemoViewV167');
    if (!root || root.hidden) return;

    const header = root.querySelector('.work-memo-head-v167');
    const tools = root.querySelector('.work-memo-tools-v167');
    if (!header || !tools) return;

    const newButton = header.querySelector('[data-memo-new]');
    if (newButton) {
      newButton.classList.add('work-memo-new-v190');
      tools.insertBefore(newButton, tools.firstChild);
    }
    header.remove();
  }

  function patchAll() {
    patchStartDateField();
    patchMemoDialog();
    patchMemoCards();
    patchMemoDensity();
    document.documentElement.dataset.workFeaturesUiVersion = VERSION;
  }

  function bindMemoObserver() {
    if (memoObserver) return true;
    const root = document.getElementById('workMemoViewV167');
    if (!root) return false;
    memoObserver = new MutationObserver(schedulePatch);
    memoObserver.observe(root, { childList: true, subtree: true });
    return true;
  }

  function bootstrap() {
    patchAll();
    const memoReady = bindMemoObserver();
    const startReady = Boolean(document.querySelector('.task-start-date-field-v167'));
    const dialogReady = Boolean(document.getElementById('workMemoDialogV167'));
    if (memoReady && startReady && dialogReady) return;
    if (bootstrapAttempts >= 40) return;
    bootstrapAttempts += 1;
    window.setTimeout(bootstrap, 50);
  }

  const start = () => bootstrap();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
