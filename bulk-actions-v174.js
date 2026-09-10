// Ver.174: bulk task operations use a fresh authoritative server snapshot.
// This avoids false revision conflicts caused by a stale local subscription state while
// still aborting if a selected task (or relation touched by deletion) changes between
// the preflight read and the Firebase transaction.
(function installBulkActionsV174() {
  'use strict';

  const VERSION = '174';
  const COMPLETED_STATUS = '完了';
  let firebaseReady = null;
  let busy = false;

  function sanitizeRoomId(value) {
    return String(value || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 60);
  }

  function roomId() {
    const query = new URLSearchParams(location.search).get('room');
    return sanitizeRoomId(query || localStorage.getItem('systemTaskRoomId') || 'default');
  }

  function currentUser() {
    return String(localStorage.getItem('systemTaskUser') || '').normalize('NFKC').replace(/\s+/g, '').slice(0, 12) || '未選択';
  }

  function normalizeRevision(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  }

  function isCompleted(status) {
    return normalizeText(status) === normalizeText(COMPLETED_STATUS);
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function sameRecord(left, right) {
    return stableJson(left ?? null) === stableJson(right ?? null);
  }

  function generateId(prefix = 'bulk') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function appendHistory(history, text, user, at = Date.now()) {
    const message = String(text || '').trim();
    if (!message) return Array.isArray(history) ? history : [];
    return [...(Array.isArray(history) ? history : []), {
      id: generateId('history'),
      author: user,
      text: message,
      createdAt: at
    }].slice(-80);
  }

  function makeLastChange(action, before, after, target) {
    if (action === 'assignee') return {
      label: '担当変更',
      summary: `担当: ${before.assignee || '未入力'} → ${after.assignee || target}`,
      details: [`担当: ${before.assignee || '未入力'} → ${after.assignee || target}`]
    };
    if (action === 'category') return {
      label: '分類変更',
      summary: `分類: ${before.category || '未入力'} → ${after.category || target}`,
      details: [`分類: ${before.category || '未入力'} → ${after.category || target}`]
    };
    if (action === 'status' || action === 'complete') return {
      label: '状態変更',
      summary: `状態: ${before.status || '未入力'} → ${after.status}`,
      details: [`状態: ${before.status || '未入力'} → ${after.status}`]
    };
    return { label: '更新', summary: '一括操作で更新', details: [] };
  }

  function actionLabel(action) {
    return ({ status: '状態を変更', assignee: '担当者を変更', category: '分類を変更', complete: '完了', delete: '削除' })[action] || '更新';
  }

  function defaultOpenStatus() {
    const user = currentUser();
    const rid = roomId();
    const keys = [
      `system-task-statuses:${rid}:${user}`,
      `system-task-statuses:${rid}:default`
    ];
    for (const key of keys) {
      try {
        const values = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(values)) {
          const found = values.find(status => !isCompleted(status));
          if (found) return String(found);
        }
      } catch {}
    }
    return '未着手';
  }

  function parseIsoDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function addMonthsKeepDay(date, months, preferredDay = date.getDate()) {
    const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const max = daysInMonth(first);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(preferredDay, max));
  }

  function addYearsKeepDay(date, years) {
    const target = new Date(date.getFullYear() + years, date.getMonth(), 1);
    const max = daysInMonth(target);
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), max));
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function clampWeekday(value) {
    return clampNumber(value, 0, 6, 1);
  }

  function getNthWeekInMonth(date) {
    return Math.ceil(date.getDate() / 7);
  }

  function getNthWeekdayOfMonth(year, month, weekday, nth) {
    const targetWeekday = clampWeekday(weekday);
    if (String(nth) === 'last') {
      const last = new Date(year, month + 1, 0);
      while (last.getDay() !== targetWeekday) last.setDate(last.getDate() - 1);
      return last;
    }
    const n = clampNumber(nth, 1, 5, 1);
    const first = new Date(year, month, 1);
    const offset = (targetWeekday - first.getDay() + 7) % 7;
    const candidate = new Date(year, month, 1 + offset + (n - 1) * 7);
    return candidate.getMonth() === month ? candidate : getNthWeekdayOfMonth(year, month, targetWeekday, 'last');
  }

  function normalizeRecurrence(value) {
    const raw = String(value || 'none');
    if (raw === 'monthly') return 'monthlyDay';
    return ['none', 'daily', 'weekly', 'monthlyDay', 'monthlyNth', 'yearly'].includes(raw) ? raw : 'none';
  }

  function normalizeRecurrenceRule(recurrence, rule = {}, dueDate = '') {
    const base = parseIsoDate(dueDate) || new Date();
    return {
      interval: clampNumber(rule?.interval, 1, 36, 1),
      weekdays: Array.isArray(rule?.weekdays) && rule.weekdays.length
        ? [...new Set(rule.weekdays.map(clampWeekday))]
        : [base.getDay()],
      nth: ['1', '2', '3', '4', '5', 'last'].includes(String(rule?.nth)) ? String(rule.nth) : String(getNthWeekInMonth(base)),
      weekday: clampWeekday(rule?.weekday ?? base.getDay()),
      monthDay: clampNumber(rule?.monthDay ?? base.getDate(), 1, 31, base.getDate())
    };
  }

  function nextRecurringDueDate(dueDate, recurrence, rule = {}) {
    const base = parseIsoDate(dueDate);
    const normalized = normalizeRecurrence(recurrence);
    if (!base || normalized === 'none') return '';
    const r = normalizeRecurrenceRule(normalized, rule, dueDate);
    const interval = r.interval || 1;
    if (normalized === 'daily') return toIsoDate(addDays(base, interval));
    if (normalized === 'weekly') {
      const selected = (r.weekdays || [base.getDay()]).map(Number);
      for (let offset = 1; offset <= 7 * interval + 7; offset += 1) {
        const candidate = addDays(base, offset);
        if (!selected.includes(candidate.getDay())) continue;
        if (interval <= 1 || Math.floor((offset - 1) / 7) % interval === 0) return toIsoDate(candidate);
      }
      return toIsoDate(addDays(base, 7 * interval));
    }
    if (normalized === 'monthlyDay') return toIsoDate(addMonthsKeepDay(base, interval, r.monthDay || base.getDate()));
    if (normalized === 'monthlyNth') {
      const monthBase = new Date(base.getFullYear(), base.getMonth() + interval, 1);
      return toIsoDate(getNthWeekdayOfMonth(monthBase.getFullYear(), monthBase.getMonth(), r.weekday, r.nth));
    }
    if (normalized === 'yearly') return toIsoDate(addYearsKeepDay(base, interval));
    return '';
  }

  function createRecurringChild(parent, dueDate, user, now) {
    const id = `rec-${parent.id}-${dueDate}`;
    return {
      id,
      record: {
        ...parent,
        id,
        status: defaultOpenStatus(),
        dueDate,
        completedAt: 0,
        completedMemo: '',
        knowledgeId: '',
        pinned: false,
        comments: [],
        checklist: (Array.isArray(parent.checklist) ? parent.checklist : []).map(item => ({ ...item, done: false })),
        history: appendHistory([], `定期タスクとして「${parent.title || ''}」から作成されました。`, user, now),
        createdBy: user,
        createdAt: now,
        updatedBy: user,
        updatedAt: now,
        nextRecurringTaskId: '',
        recurringParentId: parent.id,
        revision: 1,
        operationId: id
      }
    };
  }

  function captureBulkBase(root, ids, action) {
    const source = root && typeof root === 'object' ? root : {};
    const tasks = {};
    for (const id of ids) {
      if (!source.tasks?.[id]) throw new Error('target-changed');
      tasks[id] = source.tasks[id];
    }
    if (action !== 'delete') return { tasks, schedules: {}, knowledge: {} };

    const idSet = new Set(ids);
    const schedules = Object.fromEntries(Object.entries(source.schedules || {}).filter(([, item]) => idSet.has(String(item?.relatedTaskId || ''))));
    const knowledgeIds = new Set();
    Object.entries(source.knowledge || {}).forEach(([id, item]) => {
      if (idSet.has(String(item?.taskId || ''))) knowledgeIds.add(id);
    });
    ids.forEach(id => {
      const knowledgeId = String(tasks[id]?.knowledgeId || '');
      if (knowledgeId && source.knowledge?.[knowledgeId]) knowledgeIds.add(knowledgeId);
    });
    const knowledge = Object.fromEntries([...knowledgeIds].map(id => [id, source.knowledge[id]]));
    return { tasks, schedules, knowledge };
  }

  function verifyBulkBase(currentRoot, base, ids, action) {
    const current = currentRoot && typeof currentRoot === 'object' ? currentRoot : {};
    for (const id of ids) {
      if (!sameRecord(current.tasks?.[id], base.tasks[id])) throw new Error('remote-content-changed');
    }
    if (action !== 'delete') return;

    const idSet = new Set(ids);
    const currentSchedules = Object.fromEntries(Object.entries(current.schedules || {}).filter(([, item]) => idSet.has(String(item?.relatedTaskId || ''))));
    const currentKnowledgeIds = new Set();
    Object.entries(current.knowledge || {}).forEach(([id, item]) => {
      if (idSet.has(String(item?.taskId || ''))) currentKnowledgeIds.add(id);
    });
    ids.forEach(id => {
      const knowledgeId = String(current.tasks?.[id]?.knowledgeId || '');
      if (knowledgeId && current.knowledge?.[knowledgeId]) currentKnowledgeIds.add(knowledgeId);
    });
    const currentKnowledge = Object.fromEntries([...currentKnowledgeIds].map(id => [id, current.knowledge[id]]));
    if (!sameRecord(currentSchedules, base.schedules) || !sameRecord(currentKnowledge, base.knowledge)) {
      throw new Error('remote-content-changed');
    }
  }

  function applyBulkMutation(root, base, ids, action, target, user) {
    verifyBulkBase(root, base, ids, action);
    const now = Date.now();
    const next = { ...(root || {}), tasks: { ...(root?.tasks || {}) }, schedules: { ...(root?.schedules || {}) }, knowledge: { ...(root?.knowledge || {}) } };
    const idSet = new Set(ids);

    if (action === 'delete') {
      for (const id of ids) delete next.tasks[id];
      for (const [scheduleId, schedule] of Object.entries(next.schedules)) {
        if (!idSet.has(String(schedule?.relatedTaskId || ''))) continue;
        next.schedules[scheduleId] = {
          ...schedule,
          relatedTaskId: '',
          updatedAt: now,
          updatedBy: user,
          revision: normalizeRevision(schedule.revision) + 1
        };
      }
      for (const [knowledgeId, item] of Object.entries(next.knowledge)) {
        const linkedByTask = idSet.has(String(item?.taskId || ''));
        const linkedById = ids.some(id => String(base.tasks[id]?.knowledgeId || '') === knowledgeId);
        if (linkedByTask || linkedById) delete next.knowledge[knowledgeId];
      }
      return next;
    }

    for (const id of ids) {
      const before = next.tasks[id];
      let task = { ...before };
      if (action === 'status') task.status = String(target || task.status || '');
      if (action === 'assignee') task.assignee = String(target || task.assignee || '');
      if (action === 'category') task.category = String(target || task.category || '');
      if (action === 'complete') task.status = COMPLETED_STATUS;

      const becameCompleted = !isCompleted(before.status) && isCompleted(task.status);
      if (isCompleted(task.status)) task.completedAt = Number(task.completedAt || 0) || now;
      else { task.completedAt = 0; task.completedMemo = ''; }

      task.updatedAt = now;
      task.updatedBy = user;
      task.lastChange = makeLastChange(action, before, task, target);
      task.history = appendHistory(task.history, `一括操作で${actionLabel(action)}しました。`, user, now);
      task.revision = normalizeRevision(before.revision) + 1;

      if (becameCompleted && normalizeRecurrence(task.recurrence) !== 'none' && task.dueDate) {
        const dueDate = nextRecurringDueDate(task.dueDate, task.recurrence, task.recurrenceRule || {});
        if (dueDate) {
          const child = createRecurringChild(task, dueDate, user, now);
          const existingChild = next.tasks[child.id];
          if (task.nextRecurringTaskId && task.nextRecurringTaskId !== child.id) throw new Error('remote-content-changed');
          if (existingChild && (String(existingChild.recurringParentId || '') !== id || String(existingChild.dueDate || '') !== dueDate)) {
            throw new Error('remote-content-changed');
          }
          if (!existingChild) next.tasks[child.id] = child.record;
          task.nextRecurringTaskId = child.id;
          task.history = appendHistory(task.history, `次回の定期タスクを作成しました（期限：${dueDate}）。`, user, now);
        }
      }

      next.tasks[id] = task;
    }
    return next;
  }

  function showToast(message, error = false) {
    const toast = document.getElementById('toast');
    if (!toast) {
      console[error ? 'error' : 'log'](message);
      return;
    }
    const openDialogs = [...document.querySelectorAll('dialog[open]')];
    const topDialog = openDialogs[openDialogs.length - 1];
    (topDialog || document.body).appendChild(toast);
    toast.classList.toggle('in-dialog', Boolean(topDialog));
    toast.textContent = message;
    toast.style.background = error ? '#b91c2b' : '#132b40';
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function setBusy(button, value) {
    busy = value;
    if (!button) return;
    button.disabled = value;
    button.setAttribute('aria-busy', value ? 'true' : 'false');
    if (value) {
      button.dataset.bulkOriginalTextV174 ||= button.textContent;
      button.textContent = '処理中…';
    } else if (button.dataset.bulkOriginalTextV174) {
      button.textContent = button.dataset.bulkOriginalTextV174;
    }
  }

  function selectedIds(root) {
    return [...root.querySelectorAll('[data-bulk-id]:checked')].map(input => String(input.dataset.bulkId || '')).filter(Boolean);
  }

  function canUseRemoteFix() {
    const config = window.firebaseConfig || {};
    const pill = document.getElementById('connectionPill');
    return Boolean(config.apiKey && config.databaseURL && pill?.classList.contains('remote-online'));
  }

  async function ensureFirebase() {
    if (firebaseReady) return firebaseReady;
    firebaseReady = (async () => {
      const [appModule, dbModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js')
      ]);
      const config = window.firebaseConfig || {};
      if (!config.apiKey || !config.databaseURL) throw new Error('write-not-available');
      const existing = appModule.getApps().find(app => app.name === 'bulk-actions-v174');
      const app = existing || appModule.initializeApp(config, 'bulk-actions-v174');
      const db = dbModule.getDatabase(app);
      return { ...dbModule, db };
    })();
    return firebaseReady;
  }

  async function runBulk(root, button) {
    if (busy) return showToast('同じ操作を保存中です。', true);
    const ids = selectedIds(root);
    const action = root.querySelector('[data-bulk-action]')?.value || '';
    const target = root.querySelector('[data-bulk-target]')?.value || '';
    if (!ids.length) return showToast('タスクを選択してください', true);
    if (!action) return showToast('操作を選択してください', true);
    if (['status', 'assignee', 'category'].includes(action) && !target) return showToast('変更先を選択してください', true);
    if (action === 'delete' && !confirm(`${ids.length}件のタスクを削除しますか？`)) return;

    setBusy(button, true);
    try {
      const { ref, get, runTransaction, db } = await ensureFirebase();
      const roomRef = ref(db, `rooms/${roomId()}`);

      // Always base the operation on a fresh server snapshot. The old bulk path
      // compared the transaction against state.tasks, which can lag one revision
      // behind an onValue subscription and caused false conflicts.
      const freshSnapshot = await get(roomRef);
      const freshRoot = freshSnapshot.val() || {};
      const base = captureBulkBase(freshRoot, ids, action);
      let conflict = false;
      let reason = '';

      const tx = await runTransaction(roomRef, current => {
        try {
          return applyBulkMutation(current || {}, base, ids, action, target, currentUser());
        } catch (error) {
          conflict = true;
          reason = String(error?.message || error || 'remote-content-changed');
          return;
        }
      }, { applyLocally: false });

      if (!tx.committed) {
        if (conflict) {
          showToast(reason === 'target-changed'
            ? '対象タスクが変更または削除されました。最新内容を確認してください'
            : '他の更新と競合しました。最新内容を確認してください', true);
          return;
        }
        showToast('一括操作を完了できませんでした。再試行してください。', true);
        return;
      }

      root.querySelectorAll('[data-bulk-id]:checked').forEach(input => { input.checked = false; });
      const all = root.querySelector('[data-bulk-all]');
      if (all) all.checked = false;
      const bar = root.querySelector('[data-bulk-bar]');
      if (bar) bar.hidden = true;
      showToast(action === 'delete' ? `${ids.length}件を削除しました` : `${ids.length}件の一括操作を実行しました`);
    } catch (error) {
      console.warn('Ver.174 bulk operation failed', error);
      const text = String(error?.message || error || '');
      if (/permission/i.test(text)) showToast('権限がないため一括操作を実行できません。', true);
      else if (/network|offline|fetch/i.test(text)) showToast('通信を確認できないため一括操作を実行できません。', true);
      else showToast('一括操作を完了できませんでした。再試行してください。', true);
    } finally {
      setBusy(button, false);
    }
  }

  // Capture phase prevents the legacy bubble listener in app.js from running.
  // Local-only / degraded modes deliberately fall through to the existing handler.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-bulk-apply]');
    if (!button || !canUseRemoteFix()) return;
    const root = button.closest('#listView') || document.getElementById('listView');
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void runBulk(root, button);
  }, true);

  window.__WB_BULK_ACTIONS_V174__ = Object.freeze({
    version: VERSION,
    stableJson,
    captureBulkBase,
    verifyBulkBase,
    applyBulkMutation
  });
})();
