// Ver.243: remote bulk actions use subscribed task boundaries and delegate deletion
// to the application's canonical Ver.134/143 delete controller.
(function installBulkActionsV243() {
  'use strict';

  const VERSION = '243';
  const COMPLETE = '完了';
  let busy = false;

  function baseApi() {
    return window.WorkBoardWorkflowV152 || window.WorkBoardWorkflowV150 || null;
  }

  function canUseRemoteBoundary() {
    const config = window.firebaseConfig || {};
    const pill = document.getElementById('connectionPill');
    return Boolean(config.apiKey && config.databaseURL && pill?.classList.contains('remote-online'));
  }

  function normalizeRevision(value) {
    const revision = Number(value);
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
  }

  function selectedIds(root) {
    return [...root.querySelectorAll('[data-bulk-id]:checked')]
      .map(input => String(input.dataset.bulkId || ''))
      .filter(Boolean);
  }

  function currentUser() {
    return String(localStorage.getItem('systemTaskUser') || '')
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .slice(0, 12) || '未選択';
  }

  function statusesKey(roomId, user) {
    return `system-task-statuses:${roomId}:${String(user || '').normalize('NFKC').replace(/\s+/g, '').slice(0, 12) || 'default'}`;
  }

  function defaultOpenStatus(roomId) {
    const user = currentUser();
    try {
      const byUser = JSON.parse(localStorage.getItem(`system-task-statuses-by-user:${roomId}`) || '{}');
      const list = Array.isArray(byUser?.[user]) ? byUser[user] : null;
      const open = list?.find(status => String(status || '').normalize('NFKC').trim() !== COMPLETE);
      if (open) return String(open);
    } catch (_) {}
    try {
      const list = JSON.parse(localStorage.getItem(statusesKey(roomId, user)) || '[]');
      const open = Array.isArray(list) ? list.find(status => String(status || '').normalize('NFKC').trim() !== COMPLETE) : '';
      if (open) return String(open);
    } catch (_) {}
    return '未着手';
  }

  function appendHistory(history, text, api, at = Date.now()) {
    let id = `history-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const key = api?.push?.(api.ref(api.db, `rooms/${api.roomId}/tasks`))?.key;
      if (key) id = key;
    } catch (_) {}
    return [...(Array.isArray(history) ? history : []), {
      id,
      author: currentUser(),
      text: String(text || ''),
      createdAt: at
    }].slice(-80);
  }

  function normalizeRecurrence(value) {
    const raw = String(value || 'none');
    if (raw === 'monthly') return 'monthlyDay';
    return ['none', 'daily', 'weekly', 'monthlyDay', 'monthlyNth', 'yearly'].includes(raw) ? raw : 'none';
  }

  function parseISODate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function addMonthsKeepDay(date, months, preferredDay = date.getDate()) {
    const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(preferredDay, daysInMonth(first)));
  }

  function addYearsKeepDay(date, years) {
    const first = new Date(date.getFullYear() + years, date.getMonth(), 1);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), daysInMonth(first)));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function clampWeekday(value) {
    return clampNumber(value, 0, 6, 1);
  }

  function getNthWeekInMonth(date) {
    return Math.ceil(date.getDate() / 7);
  }

  function getNthWeekdayOfMonth(year, month, weekday, nth) {
    const target = clampWeekday(weekday);
    if (String(nth) === 'last') {
      const last = new Date(year, month + 1, 0);
      while (last.getDay() !== target) last.setDate(last.getDate() - 1);
      return last;
    }
    const index = clampNumber(nth, 1, 5, 1);
    const first = new Date(year, month, 1);
    const offset = (target - first.getDay() + 7) % 7;
    const candidate = new Date(year, month, 1 + offset + (index - 1) * 7);
    if (candidate.getMonth() !== month) return getNthWeekdayOfMonth(year, month, target, 'last');
    return candidate;
  }

  function recurrenceRule(task) {
    const due = parseISODate(task?.dueDate || '') || new Date();
    const rule = task?.recurrenceRule && typeof task.recurrenceRule === 'object' ? task.recurrenceRule : {};
    const weekdays = Array.isArray(rule.weekdays)
      ? [...new Set(rule.weekdays.map(clampWeekday))]
      : [due.getDay()];
    return {
      interval: clampNumber(rule.interval, 1, 36, 1),
      weekdays: weekdays.length ? weekdays : [due.getDay()],
      nth: ['1', '2', '3', '4', '5', 'last'].includes(String(rule.nth)) ? String(rule.nth) : String(getNthWeekInMonth(due)),
      weekday: clampWeekday(rule.weekday ?? due.getDay()),
      monthDay: clampNumber(rule.monthDay ?? due.getDate(), 1, 31, due.getDate())
    };
  }

  function nextRecurringDueDate(task) {
    const base = parseISODate(task?.dueDate || '');
    const recurrence = normalizeRecurrence(task?.recurrence);
    if (!base || recurrence === 'none') return '';
    const rule = recurrenceRule(task);
    if (recurrence === 'daily') return toISODate(addDays(base, rule.interval));
    if (recurrence === 'weekly') {
      for (let offset = 1; offset <= 7 * rule.interval + 7; offset += 1) {
        const candidate = addDays(base, offset);
        if (!rule.weekdays.includes(candidate.getDay())) continue;
        if (rule.interval <= 1 || Math.floor((offset - 1) / 7) % rule.interval === 0) return toISODate(candidate);
      }
      return toISODate(addDays(base, 7 * rule.interval));
    }
    if (recurrence === 'monthlyDay') return toISODate(addMonthsKeepDay(base, rule.interval, rule.monthDay));
    if (recurrence === 'monthlyNth') {
      const month = new Date(base.getFullYear(), base.getMonth() + rule.interval, 1);
      return toISODate(getNthWeekdayOfMonth(month.getFullYear(), month.getMonth(), rule.weekday, rule.nth));
    }
    if (recurrence === 'yearly') return toISODate(addYearsKeepDay(base, rule.interval));
    return '';
  }

  function changeInfo(before, after) {
    if (before.status !== after.status) {
      const detail = `状態: ${before.status} → ${after.status}`;
      return { label: '状態変更', summary: detail, details: [detail] };
    }
    if (before.assignee !== after.assignee) {
      const detail = `担当: ${before.assignee} → ${after.assignee}`;
      return { label: '担当変更', summary: detail, details: [detail] };
    }
    if (before.category !== after.category) {
      const detail = `分類: ${before.category} → ${after.category}`;
      return { label: '分類変更', summary: detail, details: [detail] };
    }
    return { label: '保存', summary: '変更なしで保存', details: ['変更なしで保存'] };
  }

  function bulkActionLabel(action) {
    return ({ status: '状態を変更', assignee: '担当者を変更', category: '分類を変更', complete: '完了' })[action] || '更新';
  }

  function applyOneTask(records, original, action, target, api) {
    const current = records?.[original.id];
    if (!current || normalizeRevision(current.revision) !== normalizeRevision(original.revision)) throw new Error('revision-or-relation-mismatch');

    const before = JSON.parse(JSON.stringify(current));
    const now = Date.now();
    let saved = { ...current };
    if (action === 'status') saved.status = String(target || '');
    if (action === 'assignee') saved.assignee = String(target || '');
    if (action === 'category') saved.category = String(target || '');
    if (action === 'complete') saved.status = COMPLETE;

    if (String(saved.status || '') === COMPLETE) saved.completedAt = Number(saved.completedAt || 0) || now;
    else {
      saved.completedAt = 0;
      saved.completedMemo = '';
    }
    saved.updatedAt = now;
    saved.updatedBy = currentUser();
    saved.lastChange = changeInfo(before, saved);
    saved.history = appendHistory(saved.history, `一括操作で${bulkActionLabel(action)}しました。`, api, now);
    saved.revision = normalizeRevision(current.revision) + 1;

    const becameCompleted = String(before.status || '') !== COMPLETE && String(saved.status || '') === COMPLETE;
    const nextDueDate = becameCompleted ? nextRecurringDueDate(saved) : '';
    if (nextDueDate) {
      const childId = `rec-${original.id}-${nextDueDate}`;
      const child = records[childId];
      if (current.nextRecurringTaskId && current.nextRecurringTaskId !== childId) throw new Error('revision-or-relation-mismatch');
      if (child && (String(child.recurringParentId || '') !== original.id || String(child.dueDate || '') !== nextDueDate)) throw new Error('revision-or-relation-mismatch');
      if (!child) {
        records[childId] = {
          ...saved,
          id: childId,
          status: defaultOpenStatus(api.roomId),
          dueDate: nextDueDate,
          completedAt: 0,
          completedMemo: '',
          knowledgeId: '',
          pinned: false,
          comments: [],
          checklist: (Array.isArray(saved.checklist) ? saved.checklist : []).map(item => ({ ...item, done: false })),
          history: appendHistory([], `定期タスクとして「${saved.title || ''}」から作成されました。`, api, now),
          createdBy: currentUser(),
          createdAt: now,
          updatedBy: currentUser(),
          updatedAt: now,
          nextRecurringTaskId: '',
          recurringParentId: original.id,
          revision: 1,
          operationId: childId
        };
      }
      saved.nextRecurringTaskId = childId;
      saved.history = appendHistory(saved.history, `次回の定期タスクを作成しました（期限：${nextDueDate}）。`, api, now);
    }

    records[original.id] = saved;
    return saved;
  }

  function setBusy(button, value, label = '保存中…') {
    busy = value;
    if (!button) return;
    button.disabled = value;
    button.setAttribute('aria-busy', value ? 'true' : 'false');
    if (value) {
      button.dataset.bulkOriginalTextV243 ||= button.textContent;
      button.textContent = label;
    } else if (button.dataset.bulkOriginalTextV243) {
      button.textContent = button.dataset.bulkOriginalTextV243;
    }
  }

  function notify(message, error = false) {
    const api = baseApi();
    if (api?.notify) return api.notify(message, error);
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = error ? '#b91c2b' : '#132b40';
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 3800);
  }

  function clearSelection(root) {
    root.querySelectorAll('[data-bulk-id]:checked').forEach(input => { input.checked = false; });
    const all = root.querySelector('[data-bulk-all]');
    if (all) all.checked = false;
    const bar = root.querySelector('[data-bulk-bar]');
    if (bar) bar.hidden = true;
  }

  async function ensureRemoteApi() {
    const Base = baseApi();
    if (!Base?.ensureRemote) throw new Error('write-not-available');
    const remote = await Base.ensureRemote();
    if (!remote) throw new Error('write-not-available');
    return { ...remote, roomId: Base.ROOM_ID };
  }

  async function waitForTaskRevisions(expected, timeout = 12000) {
    const Base = baseApi();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const map = Base?.taskMap?.() || new Map();
      if ([...expected.entries()].every(([id, revision]) => normalizeRevision(map.get(id)?.revision) >= revision)) return true;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return false;
  }

  async function runRemoteUpdate(root, button, ids, action, target) {
    const Base = baseApi();
    const taskMap = Base?.taskMap?.() || new Map();
    const selected = ids.map(id => taskMap.get(id)).filter(Boolean);
    if (selected.length !== ids.length) throw new Error('stale-selection');
    const api = await ensureRemoteApi();
    const tasksRef = api.ref(api.db, `rooms/${api.roomId}/tasks`);

    // This helper client does not subscribe to tasks. Warm the same collection
    // before starting a transaction so the first callback never sees an empty
    // parent cache and aborts a valid bulk operation.
    await api.get(tasksRef);
    let conflict = false;
    const result = await api.runTransaction(tasksRef, current => {
      try {
        const records = current && typeof current === 'object' ? { ...current } : {};
        for (const original of selected) applyOneTask(records, original, action, target, api);
        return records;
      } catch (error) {
        conflict = true;
        return;
      }
    }, { applyLocally: false });
    if (!result.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');

    const committed = result.snapshot?.val() || {};
    const expected = new Map(selected.map(task => [task.id, normalizeRevision(committed[task.id]?.revision)]));
    await waitForTaskRevisions(expected);
    clearSelection(root);
    notify('一括操作を実行しました');
  }

  async function waitCanonicalDeleteOutcome(api, id, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (document.getElementById('deleteConflictDialog')?.open) return { ok: false, conflict: true };
      const task = await api.get(api.ref(api.db, `rooms/${api.roomId}/tasks/${id}`));
      if (!task.exists()) {
        await new Promise(resolve => setTimeout(resolve, 80));
        return { ok: true };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { ok: false, timeout: true };
  }

  async function invokeCanonicalDelete(api, id) {
    const escaped = window.CSS?.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&');
    const row = document.querySelector(`#listView tr[data-task-id="${escaped}"]`);
    if (!row) {
      const snapshot = await api.get(api.ref(api.db, `rooms/${api.roomId}/tasks/${id}`));
      return snapshot.exists() ? { ok: false, error: 'task-not-visible' } : { ok: true, alreadyDeleted: true };
    }

    row.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const button = document.querySelector('.detail-panel [data-action="delete"]');
    if (!button) return { ok: false, error: 'canonical-delete-control-missing' };

    const originalConfirm = window.confirm;
    window.confirm = message => String(message || '').includes('このタスクを削除しますか？') ? true : originalConfirm(message);
    try { button.click(); } finally { window.confirm = originalConfirm; }
    return waitCanonicalDeleteOutcome(api, id);
  }

  async function runRemoteDelete(root, button, ids) {
    if (!confirm(`${ids.length}件のタスクを削除しますか？`)) return;
    const api = await ensureRemoteApi();
    let deleted = 0;
    let failed = 0;
    let conflicts = 0;

    for (const id of ids) {
      const result = await invokeCanonicalDelete(api, id);
      if (result.ok) deleted += result.alreadyDeleted ? 0 : 1;
      else if (result.conflict) {
        conflicts += 1;
        document.getElementById('deleteConflictDialog')?.close();
      } else failed += 1;
    }

    clearSelection(root);
    if (conflicts || failed) {
      const parts = [];
      if (deleted) parts.push(`${deleted}件削除`);
      if (conflicts) parts.push(`${conflicts}件は競合のため未削除`);
      if (failed) parts.push(`${failed}件は削除を完了できず未削除`);
      notify(parts.join(' / ') || '一括削除を完了できませんでした。', true);
      return;
    }
    notify(`${deleted}件を削除しました`);
  }

  async function handleRemoteBulk(root, button) {
    if (busy) return notify('同じ操作を保存中です。', true);
    const ids = selectedIds(root);
    const action = root.querySelector('[data-bulk-action]')?.value || '';
    const target = root.querySelector('[data-bulk-target]')?.value || '';
    if (!ids.length) return notify('タスクを選択してください', true);
    if (!action) return notify('操作を選択してください', true);
    if (['status', 'assignee', 'category'].includes(action) && !target) return notify('変更先を選択してください', true);

    setBusy(button, true, action === 'delete' ? '削除中…' : '保存中…');
    try {
      if (action === 'delete') await runRemoteDelete(root, button, ids);
      else if (['status', 'assignee', 'category', 'complete'].includes(action)) await runRemoteUpdate(root, button, ids, action, target);
      else throw new Error('unsupported-bulk-action');
    } catch (error) {
      console.warn('Ver.243 bulk action failed', error);
      const message = String(error?.message || error || '');
      if (/revision-or-relation-mismatch|stale-selection/.test(message)) notify('対象が他の更新と競合しました。最新内容を確認して選び直してください。', true);
      else if (/permission/i.test(message)) notify('権限がないため一括操作を保存できません。', true);
      else if (/network|offline|fetch/i.test(message)) notify('通信を確認できないため一括操作を保存できません。', true);
      else notify('一括操作を完了できませんでした。再試行してください。', true);
    } finally {
      setBusy(button, false);
    }
  }

  // Local-only mode stays app-owned. Remote mode is captured before app.js so
  // the old unsubscribed roomRef transaction is never entered.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-bulk-apply]');
    if (!button || !canUseRemoteBoundary()) return;
    const root = button.closest('#listView') || document.getElementById('listView');
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void handleRemoteBulk(root, button);
  }, true);

  window.WorkBoardBulkV243 = Object.freeze({
    version: VERSION,
    normalizeRevision,
    nextRecurringDueDate,
    applyOneTask
  });
})();
