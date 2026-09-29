// Ver.190: presentation-only polish for business memos and reserved-task start dates.
(function installWorkFeaturesUiV190() {
  'use strict';

  const VERSION = '190';
  const FUTURE_HIDDEN_CLASS = 'future-task-v167-hidden';
  let patchQueued = false;
  let memoObserver = null;
  let futureBoardObserver = null;
  let bootstrapAttempts = 0;
  const knownFutureTaskIds = new Set();

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
      newButton.classList.add('work-memo-new-v176');
      tools.insertBefore(newButton, tools.firstChild);
    }
    header.remove();
  }

  // Ver.319: app.js renders the raw status total, then work-features-v167 hides
  // future-start tasks and rewrites the visible total. Core redraws could expose
  // the raw count for a frame. Preserve known future IDs from detached columns
  // and transfer the hidden state in the MutationObserver microtask before paint.
  function collectFutureIds(root) {
    if (!(root instanceof Element)) return;
    const nodes = [];
    if (root.matches?.(`[data-task-id].${FUTURE_HIDDEN_CLASS}`)) nodes.push(root);
    root.querySelectorAll?.(`[data-task-id].${FUTURE_HIDDEN_CLASS}`).forEach(node => nodes.push(node));
    nodes.forEach(node => {
      const id = String(node.getAttribute('data-task-id') || '');
      if (id) knownFutureTaskIds.add(id);
    });
  }

  function syncFutureId(node) {
    if (!(node instanceof Element) || !node.matches?.('[data-task-id]')) return;
    const id = String(node.getAttribute('data-task-id') || '');
    if (!id) return;
    if (node.classList.contains(FUTURE_HIDDEN_CLASS)) knownFutureTaskIds.add(id);
    else knownFutureTaskIds.delete(id);
  }

  function stabilizeBoardCounts() {
    const board = document.getElementById('boardView');
    if (!board) return;
    board.querySelectorAll('[data-task-id]').forEach(node => {
      const id = String(node.getAttribute('data-task-id') || '');
      if (id && knownFutureTaskIds.has(id) && !node.classList.contains(FUTURE_HIDDEN_CLASS)) {
        node.classList.add(FUTURE_HIDDEN_CLASS);
      }
    });
    board.querySelectorAll('.board-column').forEach(column => {
      const count = [...column.querySelectorAll('.task-list > [data-task-id]')]
        .filter(node => !node.classList.contains(FUTURE_HIDDEN_CLASS)).length;
      const output = column.querySelector('.column-head em');
      const next = String(count);
      if (output && output.textContent !== next) output.textContent = next;
    });
  }

  function bindFutureBoardObserver() {
    if (futureBoardObserver) return true;
    const board = document.getElementById('boardView');
    if (!board) return false;
    document.querySelectorAll(`[data-task-id].${FUTURE_HIDDEN_CLASS}`).forEach(collectFutureIds);
    stabilizeBoardCounts();
    futureBoardObserver = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'childList') {
          record.removedNodes.forEach(collectFutureIds);
          record.addedNodes.forEach(collectFutureIds);
        } else if (record.type === 'attributes') {
          syncFutureId(record.target);
        }
      });
      stabilizeBoardCounts();
    });
    futureBoardObserver.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return true;
  }

  function patchAll() {
    patchStartDateField();
    patchMemoDialog();
    patchMemoCards();
    patchMemoDensity();
    stabilizeBoardCounts();
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
    const boardReady = bindFutureBoardObserver();
    const startReady = Boolean(document.querySelector('.task-start-date-field-v167'));
    const dialogReady = Boolean(document.getElementById('workMemoDialogV167'));
    if (memoReady && boardReady && startReady && dialogReady) return;
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
