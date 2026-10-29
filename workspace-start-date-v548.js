// Ver.548: canonical task-start-date persistence shared by future presentations.
// The Classic sidecar remains the only cache, subscription, UI and task-submit owner.
// This adapter does not initialize Firebase, subscribe or persist another state copy.
(function installStartDatePersistenceV548(root) {
  'use strict';
  if (root.WorkBoardStartDatePersistenceV548) return;

  function create({
    getFeatureState, ensureFirebase, firebaseModules, finiteRevision,
    currentUser, loadLocalStarts, persistLocalStarts, reportCleanupError = () => {}
  }) {
    if ([getFeatureState, ensureFirebase, finiteRevision, currentUser,
      loadLocalStarts, persistLocalStarts].some(fn => typeof fn !== 'function')
      || !firebaseModules || typeof firebaseModules !== 'object') {
      throw new TypeError('Canonical start-date owner and persistence dependencies are required');
    }

    async function save(id, date, expectedRevision) {
      if (!id) throw new TypeError('A task id is required');
      await ensureFirebase();
      const state = getFeatureState();
      const expected = finiteRevision(expectedRevision);
      const nextDate = String(date || '');
      const now = Date.now();
      const next = {
        date: nextDate,
        updatedAt: now,
        updatedBy: currentUser(),
        revision: expected + 1
      };

      if (!state.online) {
        const starts = loadLocalStarts();
        const current = starts[id] || {};
        if (finiteRevision(current.revision) !== expected) {
          return { ok: false, conflict: true, localOnly: true };
        }
        starts[id] = next;
        state.taskStarts = starts;
        persistLocalStarts(starts);
        return { ok: true, conflict: false, localOnly: true };
      }

      const { ref, runTransaction } = firebaseModules;
      let conflict = false;
      const result = await runTransaction(ref(state.db, `rooms/${state.roomId}/taskStarts/${id}`), current => {
        if (finiteRevision(current?.revision) !== expected) {
          conflict = true;
          return;
        }
        return { ...next };
      });
      return { ok: Boolean(result.committed && !conflict), conflict: Boolean(conflict || !result.committed), localOnly: false };
    }


    // Ver.549: keep the existing two authoritative task reads and child-revision
    // transaction. This is best-effort cleanup, not an atomic task+start delete.
    // The Classic sidecar still owns the subscription and lifecycle.
    async function cleanupOrphans() {
      const state = getFeatureState();
      if (!state.tasksLoaded || !state.startsLoaded) return;
      const orphanIds = Object.keys(state.taskStarts || {}).filter(id => !state.tasks[id]);
      if (!orphanIds.length) return;
      if (!state.online) {
        orphanIds.forEach(id => delete state.taskStarts[id]);
        persistLocalStarts(state.taskStarts);
        return;
      }
      const { ref, get, runTransaction } = firebaseModules;
      await Promise.all(orphanIds.map(async id => {
        try {
          const taskRef = ref(state.db, `rooms/${state.roomId}/tasks/${id}`);
          const startRef = ref(state.db, `rooms/${state.roomId}/taskStarts/${id}`);
          const taskSnapshot = await get(taskRef);
          if (taskSnapshot.exists()) return;
          const startSnapshot = await get(startRef);
          if (!startSnapshot.exists()) return;
          const expectedRevision = finiteRevision(startSnapshot.val()?.revision);
          const taskRecheck = await get(taskRef);
          if (taskRecheck.exists()) return;
          await runTransaction(startRef, current => {
            if (!current || finiteRevision(current.revision) !== expectedRevision) return;
            return null;
          });
        } catch (error) {
          reportCleanupError(error);
        }
      }));
    }

    return Object.freeze({ save, cleanupOrphans });
  }

  root.WorkBoardStartDatePersistenceV548 = Object.freeze({ create });
})(window);
