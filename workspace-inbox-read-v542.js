// Ver.542: canonical inbox read-toggle persistence, independent from views.
// The workflow-v152 sidecar remains the single inbox subscription/cache owner.
// No Firebase initialization, authentication, browser persistence, DOM or second writer.
(function installInboxReadPersistenceV542(root) {
  'use strict';
  if (root.WorkBoardInboxReadV542) return;

  function normalizeReadAt(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function create({ roomId, getInbox, ensureRemote, getRemoteState, applyLocal, notify, log }) {
    if (typeof roomId !== 'string' ||
      [getInbox, ensureRemote, getRemoteState, applyLocal, notify, log]
        .some(fn => typeof fn !== 'function')) {
      throw new TypeError('Canonical inbox owner and persistence dependencies are required');
    }

    async function write(eventId, read, normalizedUser, expectedReadAt, hasExpected = false) {
      const user = String(normalizedUser), id = String(eventId);
      const item = getInbox()?.[user]?.[id];
      if (!item) return { ok: false };
      const before = normalizeReadAt(item.readAt);
      const expected = hasExpected ? normalizeReadAt(expectedReadAt) : before;
      const next = read ? Date.now() : 0;
      applyLocal(user, id, next);

      const r = await ensureRemote();
      if (!r) {
        if (getRemoteState() === 'local-only') return { ok: true, localOnly: true };
        applyLocal(user, id, before);
        notify('通知の既読状態を保存できませんでした。', true);
        return { ok: false };
      }

      try {
        const target = r.ref(r.db, 'rooms/' + roomId + '/workflowV152/inbox/' + user + '/' + id);
        let conflict = false, matched = false, coldProbe = false;
        const tx = await r.runTransaction(target, current => {
          // The first Firebase transaction callback can be a cold null probe.
          // Preserve the original probe rather than treating it as a deletion.
          if (current === null && !coldProbe) { coldProbe = true; return null; }
          if (!current || typeof current !== 'object' || !current.taskId) {
            conflict = true;
            return;
          }
          if (normalizeReadAt(current.readAt) !== expected) {
            conflict = true;
            return;
          }
          matched = true;
          return { ...current, readAt: next };
        }, { applyLocally: false });
        const latest = normalizeReadAt(tx.snapshot?.val?.()?.readAt);
        if (!tx.committed || !matched) {
          applyLocal(user, id, latest);
          if (conflict || !matched) {
            notify('別の端末で通知の既読状態が更新されています。最新の内容を反映しました。', true);
            return { ok: false, conflict: true };
          }
          throw new Error('inbox-read-transaction-aborted');
        }
        applyLocal(user, id, latest);
        return { ok: true };
      } catch (error) {
        log('Ver.152 inbox read write failed', error);
        applyLocal(user, id, before);
        notify('通知の既読状態を保存できませんでした。', true);
        return { ok: false, error: String(error?.message || error) };
      }
    }

    return Object.freeze({ write });
  }

  root.WorkBoardInboxReadV542 = Object.freeze({ create, normalizeReadAt });
})(window);
