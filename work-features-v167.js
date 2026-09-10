// Ver.167: shared business memos + future task start dates.
(function installWorkFeaturesV167() {
  'use strict';

  const VERSION = '167';
  const MOBILE_MAX = 860;
  const MEMO_CATEGORIES = ['定型情報', '宛先・連絡先', '手順', 'URL・リンク', 'その他'];
  const STALE_DAYS = 7;
  const firebaseModules = {};
  const featureState = {
    roomId: '',
    db: null,
    online: false,
    memos: {},
    tasks: {},
    taskStarts: {},
    tasksLoaded: false,
    startsLoaded: false,
    memoMode: false,
    memoSearch: '',
    memoCategory: '',
    memoEditId: '',
    pendingStartSave: null,
    startDateWriteBusy: new Set(),
    domObserver: null,
    taskDialogObserver: null,
    lastSelectedTaskId: '',
    midnightTimer: null,
    firebaseReady: null
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function sanitizeRoomId(value) {
    return String(value || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 60);
  }

  function getRoomId() {
    const query = new URLSearchParams(location.search).get('room');
    return sanitizeRoomId(query || localStorage.getItem('systemTaskRoomId') || 'default');
  }

  function currentUser() {
    return String(localStorage.getItem('systemTaskUser') || '').normalize('NFKC').replace(/\s+/g, '').slice(0, 12) || '未選択';
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nowLabel(timestamp) {
    const d = new Date(Number(timestamp || 0));
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '未設定';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
  }

  function finiteRevision(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  }

  function generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function memoStorageKey() {
    return `system-business-memos:${featureState.roomId}`;
  }

  function taskStorageKey() {
    return `system-task-tasks:${featureState.roomId}`;
  }

  function startStorageKey() {
    return `system-task-start-dates:${featureState.roomId}`;
  }

  function loadLocalMemos() {
    try {
      const value = JSON.parse(localStorage.getItem(memoStorageKey()) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function loadLocalTasks() {
    try {
      const list = JSON.parse(localStorage.getItem(taskStorageKey()) || '[]');
      return Object.fromEntries((Array.isArray(list) ? list : []).filter(Boolean).map(task => [String(task.id || ''), task]).filter(([id]) => id));
    } catch {
      return {};
    }
  }

  function loadLocalStarts() {
    try {
      const value = JSON.parse(localStorage.getItem(startStorageKey()) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  async function ensureFirebase() {
    if (featureState.firebaseReady) return featureState.firebaseReady;
    featureState.firebaseReady = (async () => {
      try {
        const [appModule, dbModule] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js')
        ]);
        Object.assign(firebaseModules, appModule, dbModule);
        const config = window.firebaseConfig;
        if (!config) throw new Error('firebase-config-missing');
        const app = appModule.getApps().find(item => item.name === 'work-features-v167') || appModule.initializeApp(config, 'work-features-v167');
        featureState.db = dbModule.getDatabase(app);
        featureState.online = true;
        return true;
      } catch (error) {
        console.warn('Ver.167 feature Firebase unavailable; using local fallback.', error);
        featureState.online = false;
        featureState.memos = loadLocalMemos();
        featureState.tasks = loadLocalTasks();
        featureState.taskStarts = loadLocalStarts();
        featureState.tasksLoaded = true;
        featureState.startsLoaded = true;
        renderMemoView();
        applyFutureTaskUi();
        return false;
      }
    })();
    return featureState.firebaseReady;
  }

  async function subscribeFeatureData() {
    await ensureFirebase();
    if (!featureState.online) return;
    const { ref, onValue } = firebaseModules;
    onValue(ref(featureState.db, `rooms/${featureState.roomId}/businessMemos`), snapshot => {
      featureState.memos = snapshot.val() || {};
      localStorage.setItem(memoStorageKey(), JSON.stringify(featureState.memos));
      renderMemoView();
    });
    onValue(ref(featureState.db, `rooms/${featureState.roomId}/taskStarts`), snapshot => {
      featureState.taskStarts = snapshot.val() || {};
      featureState.startsLoaded = true;
      localStorage.setItem(startStorageKey(), JSON.stringify(featureState.taskStarts));
      applyFutureTaskUi();
      populateStartDateFromCurrentTask();
      renderReservedTaskDialogIfOpen();
      cleanupOrphanStarts();
    });
    onValue(ref(featureState.db, `rooms/${featureState.roomId}/tasks`), snapshot => {
      featureState.tasks = snapshot.val() || {};
      featureState.tasksLoaded = true;
      applyFutureTaskUi();
      populateStartDateFromCurrentTask();
      renderReservedTaskDialogIfOpen();
      cleanupOrphanStarts();
    });
  }

  function createMemoNav() {
    if (document.querySelector('[data-work-memo-layout]')) return;
    const schedule = document.querySelector('.nav-item[data-layout="schedule"]');
    if (!schedule) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item work-memo-nav-v167';
    button.dataset.workMemoLayout = 'true';
    button.innerHTML = `<span class="nav-icon"><img src="assets/nav-memo-v167.svg?v=${VERSION}" alt="" /></span>業務メモ`;
    schedule.insertAdjacentElement('afterend', button);
    button.addEventListener('click', enterMemoMode);
  }

  function ensureMemoView() {
    if (document.getElementById('workMemoViewV167')) return;
    const main = document.getElementById('mainContent');
    if (!main) return;
    const section = document.createElement('section');
    section.id = 'workMemoViewV167';
    section.className = 'work-memo-view-v167';
    section.hidden = true;
    main.appendChild(section);

    const dialog = document.createElement('dialog');
    dialog.id = 'workMemoDialogV167';
    dialog.className = 'dialog work-memo-dialog-v167';
    dialog.innerHTML = `
      <form id="workMemoFormV167" method="dialog">
        <div class="dialog-head">
          <div><p class="eyebrow">WORK REFERENCE</p><h2 id="workMemoDialogTitleV167">業務メモ</h2></div>
          <button class="icon-button" type="button" data-memo-close aria-label="閉じる">×</button>
        </div>
        <input id="workMemoIdV167" type="hidden" />
        <input id="workMemoRevisionV167" type="hidden" />
        <div class="work-memo-form-grid-v167">
          <label>タイトル
            <input id="workMemoTitleV167" type="text" maxlength="80" required placeholder="例：稟議メールの宛先" />
          </label>
          <label>分類
            <select id="workMemoCategoryV167">${MEMO_CATEGORIES.map(item => `<option>${item}</option>`).join('')}</select>
          </label>
        </div>
        <label>タグ
          <input id="workMemoTagsV167" type="text" maxlength="120" placeholder="例：稟議, メール, 宛先" />
        </label>
        <label>内容
          <textarea id="workMemoBodyV167" rows="10" maxlength="6000" required placeholder="例：\n宛先：事務部長\nCC：総務課長、○○さん\n備考：PDFを添付"></textarea>
        </label>
        <label class="check-row work-memo-pin-row-v167"><input id="workMemoPinnedV167" type="checkbox" /> よく使うメモとして上部に固定</label>
        <div class="dialog-actions work-memo-dialog-actions-v167">
          <button class="danger-button" id="workMemoDeleteV167" type="button" hidden>削除</button>
          <span class="work-memo-dialog-spacer-v167"></span>
          <button class="ghost-button" type="button" data-memo-close>キャンセル</button>
          <button class="primary-button" type="submit">保存</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    dialog.querySelectorAll('[data-memo-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.querySelector('#workMemoFormV167')?.addEventListener('submit', async event => {
      event.preventDefault();
      await saveMemoFromForm();
    });
    dialog.querySelector('#workMemoDeleteV167')?.addEventListener('click', deleteCurrentMemo);
  }

  function enterMemoMode() {
    ensureMemoView();
    featureState.memoMode = true;
    document.body.classList.add('work-memo-mode-v167');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-work-memo-layout]')?.classList.add('active');
    document.getElementById('workMemoViewV167').hidden = false;
    const eyebrow = document.querySelector('.hero .eyebrow');
    const title = document.querySelector('.hero h2');
    if (eyebrow) eyebrow.textContent = 'WORK REFERENCE';
    if (title) title.textContent = '業務メモ';
    renderMemoView();
  }

  function exitMemoMode() {
    if (!featureState.memoMode) return;
    featureState.memoMode = false;
    document.body.classList.remove('work-memo-mode-v167');
    const view = document.getElementById('workMemoViewV167');
    if (view) view.hidden = true;
    document.querySelector('[data-work-memo-layout]')?.classList.remove('active');
  }

  function bindCoreNavigationExit() {
    document.querySelectorAll('.nav-item[data-layout], .nav-filter').forEach(button => {
      if (button.dataset.workMemoExitBound) return;
      button.dataset.workMemoExitBound = 'true';
      button.addEventListener('click', exitMemoMode, true);
    });
  }

  function memoList() {
    const query = normalizeText(featureState.memoSearch);
    return Object.entries(featureState.memos || {})
      .map(([id, memo]) => ({ id, ...(memo || {}) }))
      .filter(memo => !featureState.memoCategory || memo.category === featureState.memoCategory)
      .filter(memo => {
        if (!query) return true;
        return normalizeText([memo.title, memo.body, memo.category, ...(Array.isArray(memo.tags) ? memo.tags : [])].join(' ')).includes(query);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  function renderMemoView() {
    const root = document.getElementById('workMemoViewV167');
    if (!root) return;
    const items = memoList();
    root.innerHTML = `
      <section class="work-memo-head-v167">
        <div>
          <span class="work-memo-kicker-v167">SHARED REFERENCE</span>
          <h3>業務メモ</h3>
          <p>「やること」ではない定型情報・宛先・URL・手順を、共有ルーム内で検索してすぐ参照できます。</p>
        </div>
        <button class="primary-button" type="button" data-memo-new>＋ 新しいメモ</button>
      </section>
      <section class="work-memo-tools-v167">
        <label class="work-memo-search-v167"><span>⌕</span><input type="search" data-memo-search value="${escapeHtml(featureState.memoSearch)}" placeholder="タイトル・内容・タグで検索" /></label>
        <select data-memo-category aria-label="業務メモの分類">
          <option value="">すべての分類</option>
          ${MEMO_CATEGORIES.map(category => `<option value="${escapeHtml(category)}" ${featureState.memoCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
        </select>
        <span class="work-memo-count-v167">${items.length}件</span>
      </section>
      ${items.length ? `<div class="work-memo-grid-v167">${items.map(renderMemoCard).join('')}</div>` : `
        <div class="work-memo-empty-v167">
          <strong>${featureState.memoSearch || featureState.memoCategory ? '条件に合う業務メモはありません。' : '業務メモはまだありません。'}</strong>
          <p>${featureState.memoSearch || featureState.memoCategory ? '検索条件を変更してください。' : '稟議メールの宛先、定型URL、よく使う手順などから登録すると便利です。'}</p>
          ${featureState.memoSearch || featureState.memoCategory ? '' : '<button class="primary-button" type="button" data-memo-new>最初のメモを追加</button>'}
        </div>`}
    `;

    root.querySelectorAll('[data-memo-new]').forEach(button => button.addEventListener('click', () => openMemoDialog()));
    root.querySelector('[data-memo-search]')?.addEventListener('input', event => {
      featureState.memoSearch = event.target.value;
      renderMemoView();
      requestAnimationFrame(() => {
        const input = root.querySelector('[data-memo-search]');
        input?.focus();
        input?.setSelectionRange(featureState.memoSearch.length, featureState.memoSearch.length);
      });
    });
    root.querySelector('[data-memo-category]')?.addEventListener('change', event => {
      featureState.memoCategory = event.target.value;
      renderMemoView();
    });
    root.querySelectorAll('[data-memo-edit]').forEach(button => button.addEventListener('click', () => openMemoDialog(button.dataset.memoEdit)));
    root.querySelectorAll('[data-memo-copy]').forEach(button => button.addEventListener('click', () => copyMemo(button.dataset.memoCopy)));
    root.querySelectorAll('[data-memo-task]').forEach(button => button.addEventListener('click', () => createTaskFromMemo(button.dataset.memoTask)));
    root.querySelectorAll('[data-memo-pin]').forEach(button => button.addEventListener('click', () => toggleMemoPin(button.dataset.memoPin)));
  }

  function renderMemoCard(memo) {
    const tags = Array.isArray(memo.tags) ? memo.tags : [];
    const body = String(memo.body || '');
    const preview = body.length > 220 ? `${body.slice(0, 220)}…` : body;
    return `<article class="work-memo-card-v167 ${memo.pinned ? 'is-pinned' : ''}">
      <div class="work-memo-card-head-v167">
        <div>
          <span class="work-memo-category-v167">${escapeHtml(memo.category || 'その他')}</span>
          <h4>${escapeHtml(memo.title || '無題')}</h4>
        </div>
        <button class="work-memo-pin-v167 ${memo.pinned ? 'active' : ''}" type="button" data-memo-pin="${escapeHtml(memo.id)}" title="${memo.pinned ? '固定を解除' : '上部に固定'}" aria-label="${memo.pinned ? '固定を解除' : '上部に固定'}">☆</button>
      </div>
      <pre class="work-memo-body-v167">${escapeHtml(preview)}</pre>
      ${tags.length ? `<div class="work-memo-tags-v167">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="work-memo-meta-v167"><span>${escapeHtml(memo.updatedBy || memo.createdBy || '')}</span><span>${escapeHtml(nowLabel(memo.updatedAt || memo.createdAt))}</span></div>
      <div class="work-memo-actions-v167">
        <button class="ghost-button" type="button" data-memo-copy="${escapeHtml(memo.id)}">コピー</button>
        <button class="ghost-button" type="button" data-memo-task="${escapeHtml(memo.id)}">タスク作成</button>
        <button class="ghost-button" type="button" data-memo-edit="${escapeHtml(memo.id)}">編集</button>
      </div>
    </article>`;
  }

  function openMemoDialog(id = '') {
    ensureMemoView();
    const dialog = document.getElementById('workMemoDialogV167');
    if (!dialog) return;
    const memo = id ? featureState.memos[id] : null;
    featureState.memoEditId = id;
    dialog.querySelector('#workMemoDialogTitleV167').textContent = memo ? '業務メモを編集' : '新しい業務メモ';
    dialog.querySelector('#workMemoIdV167').value = id;
    dialog.querySelector('#workMemoRevisionV167').value = String(finiteRevision(memo?.revision));
    dialog.querySelector('#workMemoTitleV167').value = memo?.title || '';
    dialog.querySelector('#workMemoCategoryV167').value = MEMO_CATEGORIES.includes(memo?.category) ? memo.category : '定型情報';
    dialog.querySelector('#workMemoTagsV167').value = Array.isArray(memo?.tags) ? memo.tags.join(', ') : '';
    dialog.querySelector('#workMemoBodyV167').value = memo?.body || '';
    dialog.querySelector('#workMemoPinnedV167').checked = Boolean(memo?.pinned);
    dialog.querySelector('#workMemoDeleteV167').hidden = !memo;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    requestAnimationFrame(() => dialog.querySelector('#workMemoTitleV167')?.focus());
  }

  function memoFromForm() {
    const dialog = document.getElementById('workMemoDialogV167');
    const title = dialog.querySelector('#workMemoTitleV167').value.trim();
    const body = dialog.querySelector('#workMemoBodyV167').value.trim();
    const tags = dialog.querySelector('#workMemoTagsV167').value.split(/[,、\n]/).map(item => item.trim()).filter(Boolean).slice(0, 12);
    return {
      id: dialog.querySelector('#workMemoIdV167').value || generateId('memo'),
      revision: finiteRevision(dialog.querySelector('#workMemoRevisionV167').value),
      title,
      body,
      category: dialog.querySelector('#workMemoCategoryV167').value || 'その他',
      tags,
      pinned: dialog.querySelector('#workMemoPinnedV167').checked
    };
  }

  async function saveMemoFromForm() {
    const memo = memoFromForm();
    if (!memo.title || !memo.body) return;
    const existing = featureState.memos[memo.id] || null;
    const now = Date.now();
    const next = {
      ...memo,
      createdBy: existing?.createdBy || currentUser(),
      createdAt: Number(existing?.createdAt || now),
      updatedBy: currentUser(),
      updatedAt: now
    };

    const ok = await commitMemo(next, memo.revision);
    if (!ok) return showFeatureMessage('別のユーザーがこのメモを更新した可能性があります。最新状態を確認してからもう一度保存してください。', true);
    document.getElementById('workMemoDialogV167')?.close();
    showFeatureMessage('業務メモを保存しました。');
  }

  async function commitMemo(next, expectedRevision) {
    await ensureFirebase();
    if (!featureState.online) {
      const current = featureState.memos[next.id];
      if (current && finiteRevision(current.revision) !== finiteRevision(expectedRevision)) return false;
      featureState.memos[next.id] = { ...next, revision: finiteRevision(current?.revision) + 1 };
      localStorage.setItem(memoStorageKey(), JSON.stringify(featureState.memos));
      renderMemoView();
      return true;
    }
    const { ref, runTransaction } = firebaseModules;
    let conflict = false;
    const result = await runTransaction(ref(featureState.db, `rooms/${featureState.roomId}/businessMemos/${next.id}`), current => {
      if (current && finiteRevision(current.revision) !== finiteRevision(expectedRevision)) {
        conflict = true;
        return;
      }
      return { ...next, revision: finiteRevision(current?.revision) + 1 };
    });
    return Boolean(result.committed && !conflict);
  }

  async function deleteCurrentMemo() {
    const id = document.getElementById('workMemoIdV167')?.value;
    if (!id || !featureState.memos[id]) return;
    if (!confirm(`「${featureState.memos[id].title || '業務メモ'}」を削除しますか？`)) return;
    const expectedRevision = finiteRevision(featureState.memos[id].revision);
    await ensureFirebase();
    let ok = true;
    if (!featureState.online) {
      delete featureState.memos[id];
      localStorage.setItem(memoStorageKey(), JSON.stringify(featureState.memos));
      renderMemoView();
    } else {
      const { ref, runTransaction } = firebaseModules;
      const result = await runTransaction(ref(featureState.db, `rooms/${featureState.roomId}/businessMemos/${id}`), current => {
        if (!current || finiteRevision(current.revision) !== expectedRevision) return;
        return null;
      });
      ok = result.committed;
    }
    if (!ok) return showFeatureMessage('削除できませんでした。最新状態を確認してください。', true);
    document.getElementById('workMemoDialogV167')?.close();
    showFeatureMessage('業務メモを削除しました。');
  }

  async function toggleMemoPin(id) {
    const memo = featureState.memos[id];
    if (!memo) return;
    await commitMemo({ ...memo, id, pinned: !memo.pinned, updatedBy: currentUser(), updatedAt: Date.now() }, finiteRevision(memo.revision));
  }

  async function copyMemo(id) {
    const memo = featureState.memos[id];
    if (!memo) return;
    const text = memo.body || '';
    try {
      await navigator.clipboard.writeText(text);
      showFeatureMessage('メモの内容をコピーしました。');
    } catch {
      window.prompt('コピーしてください。', text);
    }
  }

  function createTaskFromMemo(id) {
    const memo = featureState.memos[id];
    if (!memo) return;
    exitMemoMode();
    document.querySelector('.nav-item[data-layout="tasks"]')?.click();
    setTimeout(() => {
      document.getElementById('newTask')?.click();
      setTimeout(() => {
        const title = document.getElementById('taskTitle');
        const description = document.getElementById('taskDescription');
        const tags = document.getElementById('taskTags');
        if (title) title.value = memo.title || '';
        if (description) description.value = memo.body || '';
        if (tags && Array.isArray(memo.tags)) tags.value = memo.tags.join(', ');
      }, 30);
    }, 30);
  }

  function ensureStartDateField() {
    const form = document.getElementById('taskForm');
    if (!form || document.getElementById('taskStartDateV167')) return;
    const due = document.getElementById('taskDueDate');
    const dueLabel = due?.closest('label');
    if (!dueLabel) return;
    const label = document.createElement('label');
    label.className = 'task-start-date-field-v167';
    label.innerHTML = `開始日
      <input id="taskStartDateV167" type="date" />
      <small>未来日を指定すると、その日までは「予約タスク」で管理します。</small>`;
    dueLabel.insertAdjacentElement('beforebegin', label);
    label.querySelector('input')?.addEventListener('input', event => event.target.setCustomValidity(''));
    installTaskSubmitBridge();
    observeTaskDialog();
  }

  function observeTaskDialog() {
    const dialog = document.getElementById('taskDialog');
    if (!dialog || featureState.taskDialogObserver) return;
    featureState.taskDialogObserver = new MutationObserver(() => {
      if (dialog.open || dialog.hasAttribute('open')) populateStartDateFromCurrentTask();
    });
    featureState.taskDialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }

  function populateStartDateFromCurrentTask() {
    const dialog = document.getElementById('taskDialog');
    const input = document.getElementById('taskStartDateV167');
    const id = document.getElementById('taskId')?.value || '';
    if (!dialog || !(dialog.open || dialog.hasAttribute('open')) || !input) return;
    const start = id ? featureState.taskStarts[id] : null;
    if (document.activeElement !== input) input.value = start?.date || '';
  }

  function installTaskSubmitBridge() {
    const form = document.getElementById('taskForm');
    if (!form || form.dataset.startBridgeV167) return;
    form.dataset.startBridgeV167 = 'true';
    form.addEventListener('submit', event => {
      const startInput = document.getElementById('taskStartDateV167');
      const dueInput = document.getElementById('taskDueDate');
      if (!startInput) return;
      const startDate = startInput.value || '';
      const dueDate = dueInput?.value || '';
      if (startDate && dueDate && startDate > dueDate) {
        startInput.setCustomValidity('開始日は期限日以前の日付を指定してください。');
        startInput.reportValidity();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const idField = document.getElementById('taskId');
      let id = idField?.value || '';
      const isNew = !id;
      if (isNew && startDate && idField) {
        id = generateId('task');
        idField.value = id;
      }
      if (!id) return;
      const baseRevision = finiteRevision(featureState.tasks[id]?.revision);
      const startRevision = finiteRevision(featureState.taskStarts[id]?.revision);
      featureState.pendingStartSave = { id, startDate, baseRevision, startRevision, isNew, submittedAt: Date.now() };
      const dialog = document.getElementById('taskDialog');
      if (!dialog) return;
      const afterClose = () => {
        const pending = featureState.pendingStartSave;
        featureState.pendingStartSave = null;
        if (pending?.id === id) verifyAndPersistStartDate(pending);
      };
      dialog.addEventListener('close', afterClose, { once: true });
    }, true);
  }

  async function readTask(id) {
    await ensureFirebase();
    if (!featureState.online) return loadLocalTasks()[id] || featureState.tasks[id] || null;
    const { ref, get } = firebaseModules;
    const snapshot = await get(ref(featureState.db, `rooms/${featureState.roomId}/tasks/${id}`));
    return snapshot.exists() ? snapshot.val() : null;
  }

  async function verifyAndPersistStartDate(pending) {
    await new Promise(resolve => setTimeout(resolve, 60));
    let task = await readTask(pending.id);
    if (!task) return;
    const revision = finiteRevision(task.revision);
    const updatedByThisUser = normalizeText(task.updatedBy) === normalizeText(currentUser());
    const updatedDuringSubmit = Number(task.updatedAt || 0) >= pending.submittedAt - 1000;
    const saveSucceeded = pending.isNew
      ? revision >= 1 && updatedByThisUser && updatedDuringSubmit
      : revision > pending.baseRevision && updatedByThisUser && updatedDuringSubmit;
    if (!saveSucceeded) return;
    if (String(featureState.taskStarts[pending.id]?.date || '') === String(pending.startDate || '')) return;
    await persistStartDate(pending.id, pending.startDate, pending.startRevision);
  }

  async function persistStartDate(id, startDate, expectedRevision = null) {
    if (!id || featureState.startDateWriteBusy.has(id)) return false;
    featureState.startDateWriteBusy.add(id);
    try {
      await ensureFirebase();
      const nextDate = String(startDate || '');
      const currentRecord = featureState.taskStarts[id] || {};
      const expected = expectedRevision == null ? finiteRevision(currentRecord.revision) : finiteRevision(expectedRevision);
      const now = Date.now();
      if (!featureState.online) {
        const starts = loadLocalStarts();
        const current = starts[id] || {};
        if (finiteRevision(current.revision) !== expected) {
          showFeatureMessage('開始日は別の端末で更新されています。最新状態を確認してください。', true);
          return false;
        }
        starts[id] = { date: nextDate, updatedAt: now, updatedBy: currentUser(), revision: expected + 1 };
        featureState.taskStarts = starts;
        localStorage.setItem(startStorageKey(), JSON.stringify(starts));
        applyFutureTaskUi();
        renderReservedTaskDialogIfOpen();
        showFeatureMessage(nextDate && nextDate > todayIso() ? `開始日 ${formatDate(nextDate)} の予約タスクとして保存しました。` : '開始日を保存しました。');
        return true;
      }
      const { ref, runTransaction } = firebaseModules;
      let conflict = false;
      const result = await runTransaction(ref(featureState.db, `rooms/${featureState.roomId}/taskStarts/${id}`), current => {
        if (finiteRevision(current?.revision) !== expected) {
          conflict = true;
          return;
        }
        return { date: nextDate, updatedAt: now, updatedBy: currentUser(), revision: expected + 1 };
      });
      if (!result.committed || conflict) {
        showFeatureMessage('開始日は別の端末で更新されています。最新状態を確認してください。', true);
        return false;
      }
      showFeatureMessage(nextDate && nextDate > todayIso() ? `開始日 ${formatDate(nextDate)} の予約タスクとして保存しました。` : '開始日を保存しました。');
      return true;
    } catch (error) {
      console.warn('Could not save start date', error);
      showFeatureMessage('開始日の保存に失敗しました。タスク本体は保存されています。', true);
      return false;
    } finally {
      featureState.startDateWriteBusy.delete(id);
    }
  }

  async function cleanupOrphanStarts() {
    if (!featureState.tasksLoaded || !featureState.startsLoaded) return;
    const orphanIds = Object.keys(featureState.taskStarts || {}).filter(id => !featureState.tasks[id]);
    if (!orphanIds.length) return;
    if (!featureState.online) {
      orphanIds.forEach(id => delete featureState.taskStarts[id]);
      localStorage.setItem(startStorageKey(), JSON.stringify(featureState.taskStarts));
      return;
    }
    const { ref, set } = firebaseModules;
    await Promise.all(orphanIds.map(id => set(ref(featureState.db, `rooms/${featureState.roomId}/taskStarts/${id}`), null).catch(() => {})));
  }

  function futureTasks() {
    const today = todayIso();
    return Object.entries(featureState.tasks || {})
      .map(([id, task]) => ({ id, ...(task || {}), startDate: featureState.taskStarts[id]?.date || '' }))
      .filter(task => /^\d{4}-\d{2}-\d{2}$/.test(String(task.startDate || '')) && task.startDate > today)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  }

  function futureIdSet() {
    return new Set(futureTasks().map(task => task.id));
  }

  function applyFutureTaskUi() {
    ensureReservedTaskButton();
    const future = futureIdSet();
    document.querySelectorAll('[data-task-id]').forEach(node => {
      const id = node.getAttribute('data-task-id');
      node.classList.toggle('future-task-v167-hidden', future.has(id));
    });
    document.querySelectorAll('.board-column').forEach(column => {
      const count = [...column.querySelectorAll('.task-list > [data-task-id]')].filter(node => !node.classList.contains('future-task-v167-hidden')).length;
      const output = column.querySelector('.column-head em');
      if (output) output.textContent = String(count);
    });
    updateSummaryCounts(future);
    updateDashboardCounts(future);
    const button = document.querySelector('[data-reserved-task-open]');
    if (button) {
      const count = future.size;
      button.innerHTML = `予約タスク <span>${count}</span>`;
      button.hidden = count === 0;
    }
    addStartDateToDetail();
  }

  function activeTasks(future) {
    return Object.entries(featureState.tasks || {})
      .map(([id, task]) => ({ id, ...(task || {}) }))
      .filter(task => !future.has(task.id));
  }

  function updateSummaryCounts(future) {
    const tasks = activeTasks(future);
    const today = todayIso();
    const open = tasks.filter(task => normalizeText(task.status) !== normalizeText('完了'));
    const current = currentUser();
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = `${value}件`; };
    set('openCount', open.length);
    set('overdueCount', open.filter(task => task.dueDate && task.dueDate < today).length);
    set('todayCount', open.filter(task => task.dueDate === today).length);
    set('myCount', open.filter(task => normalizeText(task.assignee) === normalizeText(current)).length);
  }

  function updateDashboardCounts(future) {
    const root = document.getElementById('dashboardView');
    if (!root || root.hidden) return;
    const tasks = activeTasks(future);
    const today = todayIso();
    const open = tasks.filter(task => normalizeText(task.status) !== normalizeText('完了'));
    const now = Date.now();
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const values = {
      '未完了': open.length,
      '期限超過': open.filter(task => task.dueDate && task.dueDate < today).length,
      '今日まで': open.filter(task => task.dueDate === today).length,
      '放置気味': open.filter(task => now - Number(task.updatedAt || task.createdAt || 0) >= STALE_DAYS * 86400000).length,
      '今月完了': tasks.filter(task => normalizeText(task.status) === normalizeText('完了') && task.completedAt && new Date(task.completedAt).getFullYear() === year && new Date(task.completedAt).getMonth() === month).length
    };
    root.querySelectorAll('.dashboard-kpi').forEach(card => {
      const label = card.querySelector('small')?.textContent?.trim();
      const output = card.querySelector('strong');
      if (output && Object.prototype.hasOwnProperty.call(values, label)) output.textContent = `${values[label]}件`;
    });
  }

  function addStartDateToDetail() {
    const detail = document.getElementById('detailBody');
    if (!detail || detail.classList.contains('empty')) return;
    const selectedTitle = detail.querySelector('h3')?.textContent || '';
    if (!selectedTitle) return;
    const remembered = featureState.lastSelectedTaskId ? featureState.tasks[featureState.lastSelectedTaskId] : null;
    const task = remembered && String(remembered.title || '') === selectedTitle
      ? remembered
      : Object.values(featureState.tasks).find(item => String(item?.title || '') === selectedTitle);
    const startDate = task?.id ? featureState.taskStarts[task.id]?.date || '' : '';
    if (!startDate) return;
    if (detail.querySelector('.task-start-detail-v167')) return;
    const infoSection = [...detail.querySelectorAll('.detail-section')].find(section => section.textContent?.includes('タスク情報')) || detail.querySelector('.detail-section');
    if (!infoSection) return;
    const line = document.createElement('div');
    line.className = 'task-start-detail-v167';
    line.innerHTML = `<span>開始日</span><strong>${escapeHtml(formatDate(startDate))}</strong>`;
    infoSection.insertAdjacentElement('afterbegin', line);
  }

  function ensureReservedTaskButton() {
    if (document.querySelector('[data-reserved-task-open]')) return;
    const row = document.querySelector('.task-control-row');
    if (!row) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost-button reserved-task-button-v167';
    button.dataset.reservedTaskOpen = 'true';
    button.hidden = true;
    button.innerHTML = '予約タスク <span>0</span>';
    row.insertAdjacentElement('afterbegin', button);
    button.addEventListener('click', openReservedTaskDialog);
    ensureReservedTaskDialog();
  }

  function ensureReservedTaskDialog() {
    if (document.getElementById('reservedTaskDialogV167')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'reservedTaskDialogV167';
    dialog.className = 'dialog reserved-task-dialog-v167';
    dialog.innerHTML = `
      <div class="dialog-head">
        <div><p class="eyebrow">FUTURE TASKS</p><h2>予約タスク</h2></div>
        <button class="icon-button" type="button" data-reserved-close aria-label="閉じる">×</button>
      </div>
      <p class="reserved-task-lead-v167">開始日が来るまでは通常のタスク一覧から分けて管理します。開始日当日になると自動的に通常表示へ切り替わります。</p>
      <div id="reservedTaskListV167"></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-reserved-close]')?.addEventListener('click', () => dialog.close());
  }

  function openReservedTaskDialog() {
    ensureReservedTaskDialog();
    renderReservedTaskDialog();
    const dialog = document.getElementById('reservedTaskDialogV167');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function renderReservedTaskDialogIfOpen() {
    const dialog = document.getElementById('reservedTaskDialogV167');
    if (dialog && (dialog.open || dialog.hasAttribute('open'))) renderReservedTaskDialog();
  }

  function renderReservedTaskDialog() {
    const root = document.getElementById('reservedTaskListV167');
    if (!root) return;
    const tasks = futureTasks();
    root.innerHTML = tasks.length ? `<div class="reserved-task-list-v167">${tasks.map(task => `
      <article class="reserved-task-card-v167" data-reserved-id="${escapeHtml(task.id)}">
        <div class="reserved-task-date-v167"><small>開始日</small><strong>${escapeHtml(formatDate(task.startDate))}</strong></div>
        <div class="reserved-task-main-v167">
          <h3>${escapeHtml(task.title || '無題')}</h3>
          <p>${escapeHtml(task.assignee || '担当未設定')} / ${escapeHtml(task.status || '')} / 期限：${escapeHtml(task.dueDate ? formatDate(task.dueDate) : 'なし')}</p>
          ${task.description ? `<div>${escapeHtml(String(task.description).slice(0, 120))}${String(task.description).length > 120 ? '…' : ''}</div>` : ''}
        </div>
        <div class="reserved-task-actions-v167">
          <label>開始日<input type="date" value="${escapeHtml(task.startDate)}" data-reserved-date="${escapeHtml(task.id)}" /></label>
          <button class="ghost-button" type="button" data-reserved-save="${escapeHtml(task.id)}">変更</button>
          <button class="ghost-button" type="button" data-reserved-activate="${escapeHtml(task.id)}">今日から開始</button>
        </div>
      </article>`).join('')}</div>` : '<div class="work-memo-empty-v167"><strong>予約タスクはありません。</strong><p>未来の開始日を設定したタスクがここに表示されます。</p></div>';
    root.querySelectorAll('[data-reserved-save]').forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.reservedSave;
      const input = root.querySelector(`[data-reserved-date="${CSS.escape(id)}"]`);
      if (!input?.value) return;
      const task = featureState.tasks[id];
      if (task?.dueDate && input.value > task.dueDate) return showFeatureMessage('開始日は期限日以前の日付を指定してください。', true);
      await persistStartDate(id, input.value, finiteRevision(featureState.taskStarts[id]?.revision));
    }));
    root.querySelectorAll('[data-reserved-activate]').forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.reservedActivate;
      await persistStartDate(id, todayIso(), finiteRevision(featureState.taskStarts[id]?.revision));
    }));
  }

  function observeCoreDom() {
    if (featureState.domObserver) return;
    const root = document.querySelector('.app-shell');
    if (!root) return;
    let scheduled = false;
    featureState.domObserver = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        createMemoNav();
        ensureMemoView();
        ensureStartDateField();
        bindCoreNavigationExit();
        if (featureState.memoMode) {
          document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.matches('[data-work-memo-layout]')));
          const eyebrow = document.querySelector('.hero .eyebrow');
          const title = document.querySelector('.hero h2');
          if (eyebrow) eyebrow.textContent = 'WORK REFERENCE';
          if (title) title.textContent = '業務メモ';
        }
        applyFutureTaskUi();
      });
    });
    featureState.domObserver.observe(root, { childList: true, subtree: true });
    root.addEventListener('click', event => {
      const taskNode = event.target.closest?.('[data-task-id]');
      if (taskNode?.dataset?.taskId) featureState.lastSelectedTaskId = taskNode.dataset.taskId;
    }, true);
  }

  function scheduleDateBoundaryRefresh() {
    clearTimeout(featureState.midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2, 0);
    featureState.midnightTimer = setTimeout(() => {
      applyFutureTaskUi();
      scheduleDateBoundaryRefresh();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function showFeatureMessage(message, error = false) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.toggle('error', Boolean(error));
      toast.classList.add('show');
      clearTimeout(showFeatureMessage.timer);
      showFeatureMessage.timer = setTimeout(() => toast.classList.remove('show'), 2600);
      return;
    }
    if (error) alert(message);
  }

  async function init() {
    featureState.roomId = getRoomId();
    featureState.memos = loadLocalMemos();
    featureState.tasks = loadLocalTasks();
    featureState.taskStarts = loadLocalStarts();
    createMemoNav();
    ensureMemoView();
    ensureStartDateField();
    ensureReservedTaskButton();
    bindCoreNavigationExit();
    observeCoreDom();
    scheduleDateBoundaryRefresh();
    renderMemoView();
    applyFutureTaskUi();
    subscribeFeatureData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
