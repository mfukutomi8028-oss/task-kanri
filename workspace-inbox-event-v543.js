// Ver.543: one notification-event writer for Classic and future Modern.
// Only the workflow-v152 owner subscribes/caches/emits room events.
// Observer queue ownership, Firebase initialization and GUI remain unchanged.
(function installInboxEventPersistenceV543(root) {
  'use strict';
  if (root.WorkBoardInboxEventV543) return;

  function create({ roomId, normalizeRecipient, sanitizeEventId,
                    applyLocal, ensureRemote, getRemoteState, log }) {
    if (typeof roomId !== 'string' ||
      [normalizeRecipient, sanitizeEventId, applyLocal, ensureRemote, getRemoteState, log]
        .some(fn => typeof fn !== 'function')) {
      throw new TypeError('Canonical inbox owner and event writer dependencies are required');
    }

    async function write(recipient, eventId, event) {
      const u = normalizeRecipient(recipient), id = sanitizeEventId(eventId);
      // Preserve the v152 record schema, defaults, size limits, and timestamp.
      const item = {
        taskId: String(event.taskId || ''),
        type: String(event.type || 'update'),
        title: String(event.title || '更新があります').slice(0, 120),
        body: String(event.body || '').slice(0, 300),
        actor: String(event.actor || ''),
        createdAt: Number(event.createdAt || Date.now()),
        readAt: 0
      };
      if (!item.taskId) return { ok: false };

      // The existing workflow sidecar owns the first-wins local record and
      // always emits, including retries. Never create a second local cache.
      applyLocal(u, id, item);
      const r = await ensureRemote();
      if (!r) {
        const localOnly = getRemoteState() === 'local-only';
        return { ok: localOnly, localOnly };
      }

      try {
        const target = r.ref(r.db, 'rooms/' + roomId + '/workflowV152/inbox/' + u + '/' + id);
        // Firebase first-write-wins is essential. Retrying an event must not
        // reset readAt, actor, body, or the original createdAt timestamp.
        await r.runTransaction(target,current=>current||item,{applyLocally:false});
        return { ok: true };
      } catch (error) {
        log('Ver.152 inbox write failed', error);
        // The observer must keep its durable queued event until ok:true.
        return { ok: false };
      }
    }

    return Object.freeze({ write });
  }
  root.WorkBoardInboxEventV543 = Object.freeze({ create });
})(window);
