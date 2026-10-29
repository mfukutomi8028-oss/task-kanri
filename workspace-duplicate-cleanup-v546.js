// Ver.546: post-commit cleanup audit for duplicate merges.
// The tasks + duplicate/archive metadata have ALREADY COMMITTED atomically.
// These relation and personal-reminder writes are independent and cannot roll
// back the merge. Never retry the root merge to repair a partial cleanup.
(function installDuplicateCleanupV546(root) {
  'use strict';
  if (root.WorkBoardDuplicateCleanupV546) return;

  function create({ getRelations, writeRelations, writeReminder, log }) {
    if ([getRelations, writeRelations, writeReminder, log].some(fn => typeof fn !== 'function')) {
      throw new TypeError('Canonical post-commit cleanup dependencies are required');
    }

    async function run(source, target) {
      const pending = [];
      let sourceRelations = null, targetRelations = null;
      try {
        sourceRelations = getRelations(source) || [];
        targetRelations = getRelations(target) || [];
        if (!Array.isArray(sourceRelations) || !Array.isArray(targetRelations)) {
          throw new TypeError('Invalid relation snapshots');
        }
      } catch (error) {
        log('Ver.546 duplicate relation inspection failed after commit', error);
        pending.push('relations-inspection');
      }

      if (sourceRelations && sourceRelations.length) {
        const next = [...new Set([...targetRelations, ...sourceRelations].filter(id => id !== source))];
        let targetSaved = false;
        try {
          const result = await writeRelations(target, next);
          // An optimistic local-only result cannot prove that a remote cleanup
          // survived the already-committed remote merge.
          targetSaved = result?.ok === true && result?.localOnly !== true;
          if (!targetSaved) pending.push('target-relations');
        } catch (error) {
          log('Ver.546 target relation cleanup failed after commit', error);
          pending.push('target-relations');
        }
        if (targetSaved) {
          try {
            const result = await writeRelations(source, []);
            if (result?.ok !== true || result?.localOnly === true) pending.push('source-relations');
          } catch (error) {
            log('Ver.546 source relation cleanup failed after commit', error);
            pending.push('source-relations');
          }
        }
      }

      try {
        const result = await writeReminder(source, null);
        if (result?.ok !== true || result?.localOnly === true) pending.push('reminder');
      } catch (error) {
        log('Ver.546 reminder cleanup failed after commit', error);
        pending.push('reminder');
      }

      return Object.freeze({ ok: pending.length === 0, pending: Object.freeze(pending) });
    }

    return Object.freeze({ run });
  }
  root.WorkBoardDuplicateCleanupV546 = Object.freeze({ create });
})(window);
