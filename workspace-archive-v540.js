// Ver.540. Shared archive write owner. No Firebase subscription, DOM, or cache.
// Existing workflow-v152 remains the only room workflow state owner.
(function installArchivePersistenceV540(root) {
  'use strict';
  if (root.WorkBoardArchivePersistenceV540) return;

  function normalize(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      archivedAt: Number(value.archivedAt || 0),
      archivedBy: String(value.archivedBy || ''),
      reason: String(value.reason || 'manual')
    };
  }
  function same(left, right) {
    const a = normalize(left), b = normalize(right);
    if (!a || !b) return !a && !b;
    return a.archivedAt === b.archivedAt
      && a.archivedBy === b.archivedBy && a.reason === b.reason;
  }

  function create({ roomId, getArchives, ensureRemote, getRemoteState,
                    currentUser, applyLocal, notify, log }) {
    if (typeof roomId !== 'string'
      || [getArchives, ensureRemote, getRemoteState, currentUser, applyLocal, notify, log]
        .some(fn => typeof fn !== 'function')) {
      throw new TypeError('Archive persistence needs the canonical workflow owner');
    }
    const recordPath = id => 'rooms/' + roomId + '/workflowV152/archives/' + id;

    async function archive(taskId, reason = 'manual', expectedArchive, hasExpected = false) {
      const id = String(taskId);
      const previous = normalize(getArchives()[id] || null);
      const expected = hasExpected ? normalize(expectedArchive) : previous;
      const item = { archivedAt: Date.now(), archivedBy: currentUser(), reason: String(reason || 'manual') };
      applyLocal(id, item);
      const r = await ensureRemote();
      if (!r) {
        return { ok: getRemoteState() === 'local-only', localOnly: getRemoteState() === 'local-only' };
      }
      try {
        const target = r.ref(r.db, recordPath(id));
        let conflict = false;
        const tx = await r.runTransaction(target, current => {
          if (!same(current, expected)) { conflict = true; return; }
          return item;
        }, { applyLocally: false });
        if (!tx.committed) {
          const latest = normalize(tx.snapshot?.val?.());
          applyLocal(id, latest);
          if (conflict) {
            notify('別の端末でアーカイブ状態が更新されています。最新の内容を反映しました。', true);
            return { ok: false, conflict: true };
          }
          throw new Error('archive-transaction-aborted');
        }
        applyLocal(id, tx.snapshot?.val?.());
        return { ok: true };
      } catch (error) {
        log('Ver.152 archive write failed', error);
        applyLocal(id, previous);
        notify('アーカイブを保存できませんでした。', true);
        return { ok: false, error: String(error?.message || error) };
      }
    }

    async function restore(taskId, expectedArchive, hasExpected = false) {
      const id = String(taskId);
      const previous = normalize(getArchives()[id] || null);
      const expected = hasExpected ? normalize(expectedArchive) : previous;
      applyLocal(id, null);
      const r = await ensureRemote();
      if (!r) {
        return { ok: getRemoteState() === 'local-only', localOnly: getRemoteState() === 'local-only' };
      }
      try {
        const target = r.ref(r.db, recordPath(id));
        let conflict = false;
        const tx = await r.runTransaction(target, current => {
          if (!same(current, expected)) { conflict = true; return; }
          return null;
        }, { applyLocally: false });
        if (!tx.committed) {
          const latest = normalize(tx.snapshot?.val?.());
          applyLocal(id, latest);
          if (conflict) {
            notify('別の端末でアーカイブ状態が更新されています。最新の内容を反映しました。', true);
            return { ok: false, conflict: true };
          }
          throw new Error('unarchive-transaction-aborted');
        }
        applyLocal(id, null);
        return { ok: true };
      } catch (error) {
        log('Ver.152 unarchive write failed', error);
        applyLocal(id, previous);
        notify('アーカイブから復元できませんでした。', true);
        return { ok: false, error: String(error?.message || error) };
      }
    }

    return Object.freeze({ archive, restore });
  }

  root.WorkBoardArchivePersistenceV540 = Object.freeze({ create, normalize, same });
})(window);
