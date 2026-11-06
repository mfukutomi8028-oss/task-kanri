// Ver.579: FUTURE-ONLY verified Firebase UID / legacy user-label binding.
// Trusted Node service probe only. Not deployed in the existing browser app.
import { verifiedUidV578, validKey } from './room-promotion-request-v572.mjs';

const roles = new Set(['viewer', 'editor', 'admin']);
const requestKeys = new Set(['authorizationHeader', 'roomId', 'targetDisplayName']);
const isRecord = value => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype
    || Object.getPrototypeOf(value) === null);
const validLabel = value => typeof value === 'string' && value.length > 0
  && value.length <= 64 && value === value.trim()
  && !/[\u0000-\u001f\u007f]/.test(value);
const result = (status, clearPrivateState = false) =>
  Object.freeze({ status, clearPrivateState, productionReady: false });

/**
 * The caller supplies a trusted Admin-backed service, never a browser
 * object. Auth UID is verified using the existing Ver.578 validator.
 * Server-owned membership and approved UID-to-label binding are mandatory.
 * This preflight NEVER grants Firebase database permissions.
 */
export async function inspectStagedIdentityV579(request, service) {
  if (!isRecord(service) || typeof service.verifyIdToken !== 'function'
    || typeof service.readIdentityBinding !== 'function'
    || typeof service.expectedProjectId !== 'string') return result('unavailable', true);
  if (!isRecord(request)
    || Reflect.ownKeys(request).some(key => !requestKeys.has(key))
    || !validKey(request.roomId)
    || (request.targetDisplayName !== undefined && !validLabel(request.targetDisplayName))) {
    return result('invalid-request');
  }
  const uid = await verifiedUidV578(request.authorizationHeader, service);
  if (!uid) return result('unauthenticated', true);

  let binding;
  try {
    binding = await service.readIdentityBinding(request.roomId, uid);
  } catch {
    // Never convert a failed membership lookup into permission.
    return result('unavailable', true);
  }
  if (!isRecord(binding) || !roles.has(binding.role)
    || !validLabel(binding.displayName) || binding.approved !== true) {
    return result('forbidden', true);
  }
  if (request.targetDisplayName !== undefined
    && request.targetDisplayName !== binding.displayName) {
    // A different person needs a new sign-in, not an application label swap.
    return result('reauthentication-required');
  }
  const session = Object.freeze({
    uid, roomId: request.roomId, displayName: binding.displayName,
    role: binding.role, canWriteShared: binding.role !== 'viewer'
  });
  return Object.freeze({
    status: 'bound', session,
    clearPrivateState: false, productionReady: false
  });
}

/**
 * Future UI-only planning helper. Not an authorization decision or data writer.
 * Existing Classic/Origin/Palette selectors stay as they are until migration.
 */
export function planStagedUserSwitchV579({ session, targetDisplayName, pendingWrites, dirtyDraft } = {}) {
  if (!isRecord(session) || !validKey(session.uid)
    || !validKey(session.roomId) || !validLabel(session.displayName)) {
    return result('sign-in-required', true);
  }
  if (!validLabel(targetDisplayName)) return result('invalid-request');
  if (pendingWrites === true) return result('wait-for-pending-writes');
  if (targetDisplayName === session.displayName) return result('same-account');
  if (dirtyDraft === true) return result('confirm-discard-before-reauthentication');
  return result('reauthentication-required');
}

/**
 * Auth identity or room changes must clear private data even if edits are
 * unsaved. A same-identity token refresh needs authorization revalidation.
 */
export function planStagedAuthChangeV579({ previousSession, nextUid, nextRoomId, dirtyDraft } = {}) {
  const previous = isRecord(previousSession) ? previousSession : null;
  if (!validKey(nextUid) || !validKey(nextRoomId)
    || !previous || previous.uid !== nextUid || previous.roomId !== nextRoomId) {
    return Object.freeze({
      status: 'lock-and-clear', clearPrivateState: true,
      warnAboutUnsavedDraft: dirtyDraft === true, productionReady: false
    });
  }
  return result('revalidate-same-identity');
}
