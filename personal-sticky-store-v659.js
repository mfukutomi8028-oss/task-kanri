/* Auth-bound personal sticky persistence. Never connected to legacy /rooms. */
import { newSticky, updateSticky, canDeleteSticky, isStickyNote, isStickyId, stickyList, planStickyPlacement, planMobileMove } from './personal-sticky-core-v659.js';

/**
 * @param {{
 *  auth: object, database: object, roomId: string,
 *  firebase: {ref: Function, onValue: Function, runTransaction: Function, onAuthStateChanged: Function},
 *  approvedMember: (uid:string, roomId:string) => Promise<boolean>,
 *  accessCheckIntervalMs?: number,
 *  requireLiveConnection?: boolean
 * }} deps
 * This adapter cannot grant access: Firebase Rules MUST independently validate
 * Auth UID + approved room membership on every read and write.
 */
export function createPersonalStickyStore({ auth, database, roomId, firebase, approvedMember,
  accessCheckIntervalMs = 0, requireLiveConnection = false }) {
  if (!isStickyId(roomId) || !auth || !database || !firebase
    || ['ref', 'onValue', 'runTransaction', 'onAuthStateChanged'].some(key => typeof firebase[key] !== 'function')
    || typeof approvedMember !== 'function' || typeof requireLiveConnection !== 'boolean'
    || !Number.isSafeInteger(accessCheckIntervalMs)
    || (accessCheckIntervalMs !== 0 && (accessCheckIntervalMs < 200 || accessCheckIntervalMs > 60000)))
    throw new TypeError('Authenticated sticky dependencies are required');

  const subscribers = new Set();
  let unsubscribeAuth = null, unsubscribeDb = null, unsubscribeConnection = null;
  let connectionOnline = !requireLiveConnection;
  let generation = 0, destroyed = false, uid = '', state = 'locked', notes = Object.create(null);
  const snapshot = () => Object.freeze({
    status: state, ownerUid: uid, ownerRoom: roomId,
    notes: Object.freeze(Object.values(notes).filter(isStickyNote).map(note => structuredClone(note)))
  });
  const notify = () => {
    const current = snapshot();
    for (const fn of [...subscribers]) {
      try { fn(current); } catch (error) { console.error('Sticky subscriber failed.', error); }
    }
  };
  const clear = (next = 'locked') => {
    generation++;
    if (unsubscribeDb) { unsubscribeDb(); unsubscribeDb = null; }
    uid = '';
    notes = Object.create(null);
    state = next;
    notify();
  };
  const path = (u, id = '') => `roomsV2/${roomId}/personal/${u}/stickyNotes${id ? '/' + id : ''}`;
  const changeAuth = async user => {
    clear();
    if (!user || typeof user.uid !== 'string' || !isStickyId(user.uid) || destroyed) return;
    if (!connectionOnline) { state = 'offline'; notify(); return; }
    const runId = generation, candidate = user.uid;
    state = 'checking'; notify();
    try {
      const allowed = await approvedMember(candidate, roomId);
      // Re-check actual Firebase Auth identity after async membership lookup.
      if (!allowed || destroyed || runId !== generation || !connectionOnline
        || auth.currentUser?.uid !== candidate) {
        if (runId === generation) clear(connectionOnline ? 'locked' : 'offline');
        return;
      }
      uid = candidate;
      state = 'loading'; notify();
      unsubscribeDb = firebase.onValue(firebase.ref(database, path(uid)), snap => {
        if (destroyed || runId !== generation || auth.currentUser?.uid !== candidate) return;
        const incoming = snap.val() || {};
        const safe = Object.create(null);
        for (const [id, value] of Object.entries(incoming)) {
          if (isStickyId(id) && isStickyNote(value)
            && value.id === id && value.ownerUid === candidate && value.roomId === roomId) safe[id] = value;
        }
        notes = safe;
        state = 'ready';
        notify();
      }, () => {
        if (runId === generation) clear('error');
      });
    } catch {
      if (runId === generation) clear('error');
    }
  };
  if (requireLiveConnection) {
    // RTDB get() can return cached membership while offline. Use the SDK's
    // actual client connection signal and never display or queue private
    // writes without an active connection to the database.
    unsubscribeConnection = firebase.onValue(firebase.ref(database, '.info/connected'), snap => {
      if (destroyed) return;
      const next = snap.val() === true;
      if (next === connectionOnline) return;
      connectionOnline = next;
      if (!next) clear('offline');
      else if (auth.currentUser) void changeAuth(auth.currentUser);
      else clear();
    }, () => {
      if (destroyed) return;
      connectionOnline = false;
      clear('offline');
    });
  }
  unsubscribeAuth = firebase.onAuthStateChanged(auth, changeAuth, () => clear('error'));
  // Approval changes can occur without an Auth state event. The verified
  // adapter must therefore recheck membership even while signed in.
  let checkingAccess = false;
  const accessTimer = accessCheckIntervalMs > 0 ? setInterval(async () => {
    if (checkingAccess || destroyed || state !== 'ready' || !uid) return;
    checkingAccess = true;
    const currentUid = uid, ticket = generation;
    let stillAllowed = false;
    try { stillAllowed = await approvedMember(currentUid, roomId) === true; }
    catch { /* Verification failures lock instead of retaining private data. */ }
    finally { checkingAccess = false; }
    if (!destroyed && ticket === generation && auth.currentUser?.uid === currentUid
      && !stillAllowed) clear('locked');
  }, accessCheckIntervalMs) : null;
  const requireIdentity = (ownerRoom, ownerUid) => {
    if (destroyed || !connectionOnline || state !== 'ready' || !uid || ownerRoom !== roomId || ownerUid !== uid
      || auth.currentUser?.uid !== uid) return null;
    return uid;
  };
  async function dispatch(command = {}) {
    const identity = requireIdentity(command.ownerRoom, command.ownerUid);
    if (!identity) return { ok: false, error: 'auth-required' };
    const kind = String(command.type || '');
    if (kind==='sticky.create' && Object.keys(notes).length >= 200)
      return { ok:false,error:'limit-reached' };
    const placement=kind==='sticky.create' ? planStickyPlacement(Object.values(notes)) : null;
    const id = kind === 'sticky.create'
      ? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '')
      : String(command.id || '');
    if (!isStickyId(id)) return { ok: false, error: 'invalid-id' };
    if (!['sticky.create', 'sticky.content', 'sticky.appearance', 'sticky.layout', 'sticky.mobile', 'sticky.mobileMove', 'sticky.delete'].includes(kind)) {
      return { ok: false, error: 'unsupported-command' };
    }
    const mobileMove=kind==='sticky.mobileMove'
      ? planMobileMove(Object.values(notes),id,command.direction) : null;
    if(kind==='sticky.mobileMove'&&!mobileMove)return {ok:false,error:'reorder-unavailable'};
    const myGeneration = generation;
    const now = Date.now();
    const expected = command.expectedRevision;
    const fields = { 'sticky.content': 'content', 'sticky.appearance': 'appearance',
      'sticky.layout': 'layout', 'sticky.mobile': 'mobile' };
    let reason = '';
    try {
      const result = await firebase.runTransaction(firebase.ref(database, path(identity, id)), current => {
        if (generation !== myGeneration || !connectionOnline || auth.currentUser?.uid !== identity || state !== 'ready') {
          reason = 'auth-changed'; return;
        }
        if (kind === 'sticky.create') {
          if (current) { reason = 'already-exists'; return; }
          const created = newSticky({ id, ownerUid: identity, roomId, now, x: Number(command.x ?? placement.x), y: Number(command.y ?? placement.y),
            zIndex: placement.zIndex, order: placement.order });
          if (!created.ok) { reason = created.error; return; }
          return created.note;
        }
        if (!isStickyNote(current) || current.id !== id || current.ownerUid !== identity || current.roomId !== roomId) {
          reason = 'record-not-found'; return;
        }
        if (kind === 'sticky.delete') {
          const matching = canDeleteSticky(current, { ownerUid: identity, roomId, expectedRevisions: command.expectedRevisions });
          if (!matching) { reason = 'conflict'; return; }
          return null;
        }
        const updated = updateSticky(current, {
          field: kind==='sticky.mobileMove' ? 'mobile' : fields[kind],
          expectedRevision: mobileMove?.expectedRevision ?? expected,
          values: kind==='sticky.mobileMove' ? {order:mobileMove.order} : command.values,
          ownerUid: identity, roomId, now
        });
        if (!updated.ok) { reason = updated.error; return; }
        return updated.note;
      }, { applyLocally: false });
      if (generation !== myGeneration || auth.currentUser?.uid !== identity) return { ok: false, error: 'auth-changed' };
      return result.committed ? { ok: true, id, note: result.snapshot?.val?.() || null }
        : { ok: false, error: reason || 'conflict' };
    } catch (error) {
      return { ok: false, error: 'write-failed' };
    }
  }
  return Object.freeze({
    readSnapshot: snapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener required');
      if (destroyed) throw new Error('Sticky store destroyed');
      subscribers.add(listener); listener(snapshot());
      return () => subscribers.delete(listener);
    },
    dispatch,
    list: filters => stickyList(notes, filters),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeConnection) unsubscribeConnection();
      if (accessTimer !== null) clearInterval(accessTimer);
      clear();
      subscribers.clear();
    }
  });
}


/**
 * Verified client SDK adapter for a future authenticated Origin session.
 * Not wired into the legacy /rooms app. The membership read is allowed only
 * for this Firebase Auth UID when the selected room has approved it.
 *
 * Never trust a selected display name, cached role, or caller-supplied UID.
 * Production Realtime Database Rules must independently protect all writes.
 */
export function createVerifiedPersonalStickyStore({
  auth, database, roomId, firebase, accessCheckIntervalMs = 5000
}) {
  if (!firebase || typeof firebase.get !== 'function'
    || !Number.isSafeInteger(accessCheckIntervalMs)
    || accessCheckIntervalMs < 200 || accessCheckIntervalMs > 60000) {
    throw new TypeError('Verified Auth and periodic access checks are required');
  }
  const approvedMember = async (candidate, requestedRoom) => {
    if (!isStickyId(candidate) || !isStickyId(requestedRoom)
      || auth?.currentUser?.uid !== candidate) return false;
    try {
      // This leaf's Firebase Rules require approved identity + membership
      // AND auth.uid === candidate. Display names cannot grant access.
      const accessRef = firebase.ref(database,
        `roomsV2/${requestedRoom}/access/members/${candidate}`);
      const access = await firebase.get(accessRef);
      return auth.currentUser?.uid === candidate
        && ['viewer', 'editor', 'admin'].includes(access.val());
    } catch {
      // Permission denied, offline, expired identity or missing membership
      // must all fail closed. Never fall back to localStorage or /rooms.
      return false;
    }
  };
  return createPersonalStickyStore({
    auth, database, roomId, firebase, approvedMember, accessCheckIntervalMs,
    requireLiveConnection: true
  });
}


/**
 * Connect the existing Origin sticky presentation to a Firebase Auth session.
 *
 * Called by the future authorized startup path BEFORE Origin is mounted.
 * Does not perform sign-in, accept a selected display name as identity,
 * persist credentials, or change the legacy /rooms application.
 *
 * A live Auth object and the Firebase Rules protected database are required.
 * The underlying store owns authorization, subscription and sign-out cleanup.
 */
export function mountVerifiedOriginStickyStore({
  root, auth, database, roomId, firebase, accessCheckIntervalMs = 5000
} = {}) {
  const slot = 'WorkBoardPersonalStickyStoreV659';
  if (!root || (typeof root !== 'object' && typeof root !== 'function')
    || !Object.isExtensible(root) || slot in root) {
    throw new TypeError('Origin personal sticky store already mounted or invalid target');
  }
  const store = createVerifiedPersonalStickyStore({
    auth, database, roomId, firebase, accessCheckIntervalMs
  });
  try {
    // Read-only while active: another view cannot silently replace the
    // authorized store with a display-name or localStorage scoped service.
    Object.defineProperty(root, slot, {
      configurable: true, enumerable: false, writable: false, value: store
    });
  } catch (error) {
    store.destroy();
    throw error;
  }
  let disposed = false;
  return Object.freeze({
    store,
    destroy() {
      if (disposed) return;
      disposed = true;
      // Destroy first so subscribing Origin cards hide private data before
      // removing the integration slot. Repeated teardown is a no-op.
      store.destroy();
      if (Object.getOwnPropertyDescriptor(root, slot)?.value === store) {
        Reflect.deleteProperty(root, slot);
      }
    }
  });
}
