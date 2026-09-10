// Ver.175: bulk delete reuses a child-record transaction instead of a room transaction.
// The previous Ver.174 parent-room transaction could receive an incomplete local cache
// in its first callback and misclassify a normal delete as a concurrent update.
(function installBulkDeleteV175() {
  'use strict';

  const VERSION = '175';
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
    return String(localStorage.getItem('systemTaskUser') || '')
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .slice(0, 12) || '未選択';
  }

  function normalizeRevision(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
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

  function selectedIds(root) {
    return [...root.querySelectorAll('[data-bulk-id]:checked')]
      .map(input => String(input.dataset.bulkId || ''))
      .filter(Boolean);
  }

  function canUseRemoteFix() {
    const config = window.firebaseConfig || {};
    const pill = document.getElementById('connectionPill');
    return Boolean(config.apiKey && config.databaseURL && pill?.classList.contains('remote-online'));
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
    showToast._timer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function setBusy(button, value) {
    busy = value;
    if (!button) return;
    button.disabled = value;
    button.setAttribute('aria-busy', value ? 'true' : 'false');
    if (value) {
      button.dataset.bulkOriginalTextV175 ||= button.textContent;
      button.textContent = '削除中…';
    } else if (button.dataset.bulkOriginalTextV175) {
      button.textContent = button.dataset.bulkOriginalTextV175;
    }
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
      const existing = appModule.getApps().find(app => app.name === 'bulk-delete-v175');
      const app = existing || appModule.initializeApp(config, 'bulk-delete-v175');
      return { ...dbModule, db: dbModule.getDatabase(app) };
    })();
    return firebaseReady;
  }

  async function deleteTaskRecord(api, id) {
    const { ref, get, runTransaction, db } = api;
    const rid = roomId();
    const taskRef = ref(db, `rooms/${rid}/tasks/${id}`);
    const beforeSnapshot = await get(taskRef);
    if (!beforeSnapshot.exists()) {
      return { ok: true, alreadyDeleted: true, task: null, cleanupWarnings: [] };
    }

    let base = beforeSnapshot.val();
    let changed = false;
    let abortedForUnknownState = false;

    const tryDelete = async () => {
      changed = false;
      abortedForUnknownState = false;
      return runTransaction(taskRef, current => {
        // Returning null is safe for a delete. If the local transaction cache is
        // temporarily empty while the server still has the task, Firebase retries
        // with the authoritative server value instead of treating that as a conflict.
        if (!current) {
          abortedForUnknownState = true;
          return null;
        }
        if (!sameRecord(current, base)) {
          changed = true;
          return;
        }
        return null;
      }, { applyLocally: false });
    };

    let tx = await tryDelete();
    if (!tx.committed && !changed && abortedForUnknownState) {
      const refreshed = await get(taskRef);
      if (!refreshed.exists()) {
        return { ok: true, alreadyDeleted: true, task: base, cleanupWarnings: [] };
      }
      base = refreshed.val();
      tx = await tryDelete();
    }

    if (!tx.committed) {
      if (changed) return { ok: false, error: 'remote-content-changed', task: base };
      return { ok: false, error: 'transaction-aborted', task: base };
    }

    const afterSnapshot = await get(taskRef);
    if (afterSnapshot.exists()) {
      return { ok: false, error: 'delete-not-persisted', task: base };
    }

    const cleanupWarnings = await cleanupRelations(api, id, String(base?.knowledgeId || ''));
    return { ok: true, alreadyDeleted: false, task: base, cleanupWarnings };
  }

  async function cleanupRelations(api, taskId, baseKnowledgeId) {
    const { ref, get, runTransaction, db } = api;
    const rid = roomId();
    const warnings = [];

    let room = {};
    try {
      room = (await get(ref(db, `rooms/${rid}`))).val() || {};
    } catch (error) {
      console.warn('Ver.175 relation read failed', error);
      return ['room-read'];
    }

    const scheduleIds = Object.entries(room.schedules || {})
      .filter(([, schedule]) => String(schedule?.relatedTaskId || '') === taskId)
      .map(([id]) => id);

    const knowledgeIds = new Set(
      Object.entries(room.knowledge || {})
        .filter(([, item]) => String(item?.taskId || '') === taskId)
        .map(([id]) => id)
    );
    if (baseKnowledgeId && room.knowledge?.[baseKnowledgeId]) knowledgeIds.add(baseKnowledgeId);

    for (const scheduleId of scheduleIds) {
      try {
        const scheduleRef = ref(db, `rooms/${rid}/schedules/${scheduleId}`);
        await runTransaction(scheduleRef, current => {
          if (!current || String(current.relatedTaskId || '') !== taskId) return current;
          return {
            ...current,
            relatedTaskId: '',
            updatedAt: Date.now(),
            updatedBy: currentUser(),
            revision: normalizeRevision(current.revision) + 1
          };
        }, { applyLocally: false });
      } catch (error) {
        console.warn(`Ver.175 related schedule cleanup failed: ${scheduleId}`, error);
        warnings.push(`schedule:${scheduleId}`);
      }
    }

    for (const knowledgeId of knowledgeIds) {
      try {
        const knowledgeRef = ref(db, `rooms/${rid}/knowledge/${knowledgeId}`);
        await runTransaction(knowledgeRef, current => {
          if (!current) return null;
          const linkedByTask = String(current.taskId || '') === taskId;
          const linkedByOriginalId = knowledgeId === baseKnowledgeId;
          return linkedByTask || linkedByOriginalId ? null : current;
        }, { applyLocally: false });
      } catch (error) {
        console.warn(`Ver.175 related knowledge cleanup failed: ${knowledgeId}`, error);
        warnings.push(`knowledge:${knowledgeId}`);
      }
    }

    return warnings;
  }

  async function runBulkDelete(root, button) {
    if (busy) return showToast('同じ操作を保存中です。', true);
    const ids = selectedIds(root);
    if (!ids.length) return showToast('タスクを選択してください', true);
    if (!confirm(`${ids.length}件のタスクを削除しますか？`)) return;

    setBusy(button, true);
    try {
      const api = await ensureFirebase();
      let deleted = 0;
      let alreadyDeleted = 0;
      let conflicts = 0;
      let failed = 0;
      let cleanupWarnings = 0;

      for (const id of ids) {
        const result = await deleteTaskRecord(api, id);
        if (result.ok) {
          if (result.alreadyDeleted) alreadyDeleted += 1;
          else deleted += 1;
          cleanupWarnings += result.cleanupWarnings?.length || 0;
          continue;
        }
        if (result.error === 'remote-content-changed') conflicts += 1;
        else failed += 1;
      }

      root.querySelectorAll('[data-bulk-id]:checked').forEach(input => { input.checked = false; });
      const all = root.querySelector('[data-bulk-all]');
      if (all) all.checked = false;
      const bar = root.querySelector('[data-bulk-bar]');
      if (bar) bar.hidden = true;

      if (conflicts || failed) {
        const parts = [];
        if (deleted) parts.push(`${deleted}件削除`);
        if (alreadyDeleted) parts.push(`${alreadyDeleted}件は削除済み`);
        if (conflicts) parts.push(`${conflicts}件は操作直前に更新されたため未削除`);
        if (failed) parts.push(`${failed}件は削除処理を完了できず未削除`);
        showToast(parts.join(' / ') || '削除できませんでした。', true);
        return;
      }

      if (cleanupWarnings) {
        showToast(`${deleted}件を削除しました。関連情報の解除に失敗した項目があるため再読込後に確認してください。`, true);
        return;
      }

      showToast(alreadyDeleted
        ? `${deleted}件を削除しました（${alreadyDeleted}件はすでに削除済み）`
        : `${deleted}件を削除しました`);
    } catch (error) {
      console.warn('Ver.175 bulk delete failed', error);
      const text = String(error?.message || error || '');
      if (/permission/i.test(text)) showToast('権限がないため削除できません。', true);
      else if (/network|offline|fetch/i.test(text)) showToast('通信を確認できないため削除できません。', true);
      else showToast('一括削除を完了できませんでした。再試行してください。', true);
    } finally {
      setBusy(button, false);
    }
  }

  // Intercept only bulk deletion. Other bulk operations continue to use app.js.
  // This keeps the fix narrowly scoped and avoids replacing unrelated update logic.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-bulk-apply]');
    if (!button || !canUseRemoteFix()) return;
    const root = button.closest('#listView') || document.getElementById('listView');
    if (!root) return;
    const action = root.querySelector('[data-bulk-action]')?.value || '';
    if (action !== 'delete') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void runBulkDelete(root, button);
  }, true);

  window.__WB_BULK_DELETE_V175__ = Object.freeze({ version: VERSION, stableJson, sameRecord });
})();
