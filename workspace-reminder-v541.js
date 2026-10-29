// Ver.541: canonical reminder write adapter. No Firebase subscription or second cache.
(function installReminderPersistenceV541(root) {
  'use strict';
  if (root.WorkBoardReminderPersistenceV541) return;

  function normalizeReminderValue(value) {
    if (!value || typeof value !== 'object') return null;
    const at = Number(value.at || 0);
    if (!Number.isFinite(at) || at <= 0) return null;
    return { at, note: String(value.note || '').slice(0, 240), updatedAt: Number(value.updatedAt || 0) };
  }

  function sameReminderValue(left, right) {
    const a = normalizeReminderValue(left), b = normalizeReminderValue(right);
    if (!a || !b) return !a && !b;
    return a.at === b.at && a.note === b.note && a.updatedAt === b.updatedAt;
  }

  function create({
    roomId, getReminders, ensureRemote, getDependencyState,
    applyLocal, notify, log
  }) {
    if (typeof roomId !== 'string' ||
      [getReminders, ensureRemote, getDependencyState, applyLocal, notify, log]
        .some(fn => typeof fn !== 'function')) {
      throw new TypeError('Canonical reminder owner and persistence dependencies are required');
    }
    async function write(taskId, item, normalizedUser, expectedReminder, hasExpected = false) {
      const u = String(normalizedUser), id = String(taskId);
      const next = item && Number(item.at) > 0
        ? { at: Number(item.at), note: String(item.note || '').slice(0, 240), updatedAt: Date.now() }
        : null;
      const previous = normalizeReminderValue(getReminders()?.[u]?.[id] || null);
      const expected = hasExpected ? normalizeReminderValue(expectedReminder) : previous;
      applyLocal(u, id, next);

      const r = await ensureRemote();
      if (!r) {
        if (getDependencyState() === 'local-only') return { ok: true, localOnly: true };
        applyLocal(u, id, previous);
        notify('リマインダーを保存できませんでした。', true);
        return { ok: false };
      }
      try {
        const target = r.ref(r.db, 'rooms/' + roomId + '/workflowV148/reminders/' + u + '/' + id);
        let conflict = false;
        const tx = await r.runTransaction(target, current => {
          if (!sameReminderValue(current, expected)) { conflict = true; return; }
          return next;
        }, { applyLocally: false });
        if (!tx.committed) {
          const latest = normalizeReminderValue(tx.snapshot?.val?.());
          applyLocal(u, id, latest);
          if (conflict) {
            notify('別の端末でリマインダーが更新されています。最新の内容を反映しました。', true);
            return { ok: false, conflict: true };
          }
          throw new Error('reminder-transaction-aborted');
        }
        applyLocal(u, id, tx.snapshot?.val?.());
        return { ok: true };
      } catch (error) {
        log('Ver.152 reminder write failed', error);
        applyLocal(u, id, previous);
        notify(next
          ? 'リマインダーを保存できませんでした。'
          : '確認済みにできませんでした。通信状態を確認して再試行してください。', true);
        return { ok: false, error: String(error?.message || error) };
      }
    }
    return Object.freeze({ write });
  }

  root.WorkBoardReminderPersistenceV541 = Object.freeze({
    create, normalizeReminderValue, sameReminderValue
  });
})(window);
