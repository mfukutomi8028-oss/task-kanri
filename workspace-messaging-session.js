// Client session projection only. The authoritative Firebase rules must independently
// verify UID, operator approval, membership and the current write/read target.
import { isPersonId, isMessagingRoomId } from './workspace-messaging-core.js';

const locked = Object.freeze({status:'locked'});
const record = value => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const validUid = uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 128
  && !/[.#$/\[\]\u0000-\u001f\u007f]/.test(uid);
const validLabel = label => typeof label === 'string' && label.length > 0 && label.length <= 64
  && label.trim() === label && !/[\u0000-\u001f\u007f]/.test(label);

export function resolveMessagingIdentity(context, binding) {
  if (!record(context) || !record(binding) || !validUid(context.uid)
      || !isMessagingRoomId(context.roomId) || !validLabel(context.selectedDisplayName)
      || binding.approved !== true || binding.active !== true
      || binding.uid !== context.uid || binding.roomId !== context.roomId
      || binding.displayName !== context.selectedDisplayName || !isPersonId(binding.personId)) return locked;
  return Object.freeze({status:'bound',personId:binding.personId,roomId:context.roomId});
}

/** A single context owns the binding subscription. Adapters must read and watch
 * the approved binding for the current Firebase UID and report denied/disconnected
 * reads through onError. A local label, cached binding, or this UI state alone is
 * never proof of server authorization. */
export function createMessagingSession({getAuthUid,readBinding,observeAuth,observeBinding,onLock} = {}) {
  if ([getAuthUid,readBinding,observeAuth,observeBinding,onLock].some(fn => typeof fn !== 'function')) {
    throw new TypeError('Messaging session requires authoritative identity adapters');
  }
  let context = null, generation = 0, snapshot = locked, disposed = false;
  let closeBinding = null, closeAuth = null;
  const listeners = new Set();
  const safely = fn => { try { fn?.(); } catch (_) { /* Keep revocation and cleanup independent. */ } };
  const currentUid = () => { try { return getAuthUid(); } catch (_) { return null; } };
  function publish(next) {
    if (snapshot.status === next.status && snapshot.personId === next.personId && snapshot.roomId === next.roomId) return;
    snapshot = next;
    const token = generation;
    for (const listener of [...listeners]) {
      if (token !== generation || snapshot !== next) break;
      if (listeners.has(listener)) safely(() => listener(next));
    }
  }
  function invalidate() {
    const token = ++generation;
    const stop = closeBinding; closeBinding = null;
    safely(stop);
    if (token === generation) publish(locked);
    if (token === generation) safely(onLock);
    return token;
  }
  async function refresh() {
    if (disposed) return locked;
    const token = invalidate(), uid = currentUid();
    if (disposed || token !== generation) return locked;
    if (!context || !validUid(uid) || !isMessagingRoomId(context.roomId) || !validLabel(context.selectedDisplayName)) return locked;
    const target = Object.freeze({...context,uid});
    let sawLiveValue = false;
    const stillCurrent = () => !disposed && token === generation && uid === currentUid();
    const fail = () => { if (!disposed && token === generation) invalidate(); };
    function apply(binding) {
      if (!stillCurrent()) { fail(); return; }
      const next = resolveMessagingIdentity(target,binding);
      if (next.status === 'locked') { publish(locked); if (stillCurrent()) safely(onLock); return; }
      // A binding can be revoked or reassigned. Never expose a previous person's state.
      if (snapshot.status === 'bound' && snapshot.personId !== next.personId) { publish(locked); if (stillCurrent()) safely(onLock); }
      if (stillCurrent()) publish(next);
    }
    try {
      const stop = observeBinding(target,binding => {
        if (!stillCurrent()) { fail(); return; }
        sawLiveValue = true; apply(binding);
      },fail);
      if (typeof stop !== 'function') { fail(); return locked; }
      if (!stillCurrent()) { safely(stop); fail(); return locked; }
      closeBinding = stop;
      const binding = await readBinding(target);
      if (!stillCurrent()) { fail(); return locked; }
      if (!sawLiveValue) apply(binding);
      return stillCurrent() ? snapshot : locked;
    } catch (_) { fail(); return locked; }
  }
  try {
    closeAuth = observeAuth(() => { void refresh(); });
    if (typeof closeAuth !== 'function') throw new TypeError('Auth observer must be disposable');
  } catch (_) { invalidate(); throw new Error('Messaging authentication observer unavailable'); }
  return Object.freeze({
    setContext(value) {
      if (disposed) return Promise.resolve(locked);
      context = record(value) ? Object.freeze({roomId:value.roomId,selectedDisplayName:value.selectedDisplayName}) : null;
      return refresh();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener required');
      if (disposed) { safely(() => listener(locked)); return () => {}; }
      listeners.add(listener); safely(() => listener(snapshot));
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    dispose() {
      if (disposed) return;
      disposed = true; context = null;
      invalidate(); safely(closeAuth); closeAuth = null; listeners.clear();
    }
  });
}
