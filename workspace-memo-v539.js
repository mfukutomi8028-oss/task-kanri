// Ver.539: canonical business-memo write adapter shared by future presentations.
// Registered before the existing work-features sidecar; this module never starts
// Firebase, subscribes to data, owns a second cache, or creates Classic UI.
(function installMemoPersistenceV539(root) {
  'use strict';
  if (root.WorkBoardMemoPersistenceV539) return;

  function create({
    getFeatureState, ensureFirebase, firebaseModules,
    finiteRevision, persistLocalMemos, renderMemoView
  }) {
    if ([getFeatureState, ensureFirebase, finiteRevision, persistLocalMemos, renderMemoView]
      .some(fn => typeof fn !== 'function') || !firebaseModules || typeof firebaseModules !== 'object') {
      throw new TypeError('Canonical memo owner and persistence dependencies are required');
    }

    async function commit(next, expectedRevision) {
      await ensureFirebase();
      const state = getFeatureState();
      if (!state.online) {
        const current = state.memos[next.id];
        if (current && finiteRevision(current.revision) !== finiteRevision(expectedRevision)) return false;
        state.memos[next.id] = { ...next, revision: finiteRevision(current?.revision) + 1 };
        persistLocalMemos();
        renderMemoView();
        return true;
      }

      const { ref, runTransaction } = firebaseModules;
      let conflict = false;
      const result = await runTransaction(ref(state.db, `rooms/${state.roomId}/businessMemos/${next.id}`), current => {
        if (current && finiteRevision(current.revision) !== finiteRevision(expectedRevision)) {
          conflict = true;
          return;
        }
        return { ...next, revision: finiteRevision(current?.revision) + 1 };
      });
      return Boolean(result.committed && !conflict);
    }

    async function remove(id, expectedRevision) {
      await ensureFirebase();
      const state = getFeatureState();
      if (!state.online) {
        // Keep Classic's original local-delete behavior. Validation of the
        // selected record and confirmation remain with its UI owner.
        delete state.memos[id];
        persistLocalMemos();
        renderMemoView();
        return true;
      }

      const { ref, runTransaction } = firebaseModules;
      const result = await runTransaction(ref(state.db, `rooms/${state.roomId}/businessMemos/${id}`), current => {
        if (!current || finiteRevision(current.revision) !== expectedRevision) return;
        return null;
      });
      return Boolean(result.committed);
    }

    return Object.freeze({ commit, remove });
  }

  root.WorkBoardMemoPersistenceV539 = Object.freeze({ create });
})(window);
