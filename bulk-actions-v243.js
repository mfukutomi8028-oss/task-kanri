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

  // The canonical bulk writer owns the revision and recurrence rules.
  function normalizeRevision(value) {
    return window.WorkBoardBulkUpdateV547.normalizeRevision(value);
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

  const sharedBulk=window.WorkBoardBulkUpdateV547.create({currentUser,defaultOpenStatus});
  const nextRecurringDueDate=sharedBulk.nextRecurringDueDate;
  const applyOneTask=sharedBulk.applyOneTask;

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
    const expected=await sharedBulk.commit(api,selected,action,target);
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
