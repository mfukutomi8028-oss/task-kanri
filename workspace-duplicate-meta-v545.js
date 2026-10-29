// Ver.545: duplicate metadata expected-base writer. The workflow sidecar
// remains the single subscriber, cache and event owner.
(function installDuplicateMetaV545(root) {
  'use strict';
  if (root.WorkBoardDuplicateMetaV545) return;

  function normalize(value) {
    if (!value || typeof value !== 'object' || !value.targetId) return null;
    return {
      targetId: String(value.targetId),
      mergedAt: Number(value.mergedAt || 0),
      mergedBy: String(value.mergedBy || '')
    };
  }
  function same(left, right) {
    const a = normalize(left), b = normalize(right);
    if (!a || !b) return !a && !b;
    return a.targetId === b.targetId
      && a.mergedAt === b.mergedAt && a.mergedBy === b.mergedBy;
  }

  function create({ roomId, getDuplicates, ensureRemote, getRemoteState,
                    currentUser, applyLocal, notify, log }) {
    if (typeof roomId !== 'string' || !roomId ||
      [getDuplicates, ensureRemote, getRemoteState, currentUser, applyLocal, notify, log]
        .some(fn => typeof fn !== 'function')) {
      throw new TypeError('A single workflow owner and its persistence dependencies are required');
    }

    async function write(sourceId, targetId, expectedDuplicate, hasExpected = false) {
      const id = String(sourceId);
      const previous = normalize(getDuplicates()?.[id] || null);
      const expected = hasExpected ? normalize(expectedDuplicate) : previous;
      const item = { targetId: String(targetId), mergedAt: Date.now(), mergedBy: currentUser() };
      applyLocal(id, item);

      // Preserve the original local-only and unavailable startup behavior.
      const r = await ensureRemote();
      if (!r) {
        const localOnly = getRemoteState() === 'local-only';
        return { ok: localOnly, localOnly };
      }

      try {
        const target = r.ref(r.db, 'rooms/' + roomId + '/workflowV152/duplicates/' + id);
        let conflict = false;
        const tx = await r.runTransaction(target, current => {
          if (!same(current, expected)) { conflict = true; return; }
          return item;
        }, { applyLocally: false });
        if (!tx.committed) {
          const latest = normalize(tx.snapshot?.val?.());
          applyLocal(id, latest);
          if (conflict) {
            notify('別の端末で重複統合情報が更新されています。最新の内容を反映しました。', true);
            return { ok: false, conflict: true };
          }
          throw new Error('duplicate-transaction-aborted');
        }
        applyLocal(id, tx.snapshot?.val?.());
        return { ok: true };
      } catch (error) {
        log('Ver.152 duplicate metadata write failed', error);
        applyLocal(id, previous);
        return { ok: false, error: String(error?.message || error) };
      }
    }

    return Object.freeze({ write });
  }

  root.WorkBoardDuplicateMetaV545 = Object.freeze({ create, normalize, same });
})(window);
