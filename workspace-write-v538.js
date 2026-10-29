// Ver.538: shared write-operation coordinator for one canonical workspace owner.
// A presentation may request an operation, but this module never owns a second
// Firebase subscription, room cache, DOM, transaction, or data model.
// The caller supplies the existing canonical writer and its UI-specific hooks.

export function classifyWorkspaceWriteError(error) {
  const raw = String(error?.message || error);
  const code = String(error?.code || '').toLowerCase();
  return code.includes('permission') || raw.includes('permission') ? 'permission-denied'
    : (code.includes('network') || code.includes('offline') ? 'network-or-read-failure' : raw);
}

export function createWorkspaceWriteCoordinator({
  operationKey,
  inFlightOperations,
  getConnectionMode,
  setOperationBusy,
  logFailure,
  onNetworkFailure,
  onSettled
}) {
  if (typeof operationKey !== 'function'
      || !(inFlightOperations instanceof Map)
      || typeof getConnectionMode !== 'function'
      || typeof setOperationBusy !== 'function'
      || typeof logFailure !== 'function'
      || typeof onNetworkFailure !== 'function'
      || typeof onSettled !== 'function') {
    throw new TypeError('The canonical workspace writer and lifecycle hooks are required');
  }

  async function execute(kind, id, writer) {
    const key = operationKey(kind, id);
    const mode = getConnectionMode();
    if (inFlightOperations.has(key)) {
      return { ok: false, mode, operationId: key, error: 'in-flight', affectedPaths: [] };
    }
    if (!['local-only', 'remote-online'].includes(mode)) {
      return { ok: false, mode, operationId: key, error: 'write-not-available', affectedPaths: [] };
    }

    // The existing writer is the ONLY owner of validation, revision checks,
    // runTransaction, commit barriers, history, and room persistence.
    const operation = (async () => {
      try {
        const result = await writer(key);
        return { ok: true, mode: getConnectionMode(), operationId: key, affectedPaths: [], ...result };
      } catch (error) {
        logFailure(key, error);
        const message = classifyWorkspaceWriteError(error);
        if (getConnectionMode() === 'remote-online' && message === 'network-or-read-failure') {
          onNetworkFailure();
        }
        return { ok: false, mode: getConnectionMode(), operationId: key, error: message, affectedPaths: [] };
      } finally {
        inFlightOperations.delete(key);
        setOperationBusy(key, false);
        onSettled(kind);
      }
    })();

    inFlightOperations.set(key, operation);
    setOperationBusy(key, true);
    return operation;
  }

  return Object.freeze({ execute });
}
