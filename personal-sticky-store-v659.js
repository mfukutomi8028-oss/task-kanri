/* Auth-bound personal sticky persistence. Never connected to legacy /rooms. */
import { newSticky, updateSticky, canDeleteSticky, isStickyNote, isStickyId, stickyList, planStickyPlacement } from './personal-sticky-core-v659.js';

/**
 * @param {{
 *  auth: object, database: object, roomId: string,
 *  firebase: {ref: Function, onValue: Function, runTransaction: Function, onAuthStateChanged: Function},
 *  approvedMember: (uid:string, roomId:string) => Promise<boolean>
 * }} deps
 * This adapter cannot grant access: Firebase Rules MUST independently validate
 * Auth UID + approved room membership on every read and write.
 */
export function createPersonalStickyStore({ auth, database, roomId, firebase, approvedMember }) {
  if (!isStickyId(roomId) || !auth || !database || !firebase
    || ['ref', 'onValue', 'runTransaction', 'onAuthStateChanged'].some(key => typeof firebase[key] !== 'function')
    || typeof approvedMember !== 'function') throw new TypeError('Authenticated sticky dependencies are required');

  const subscribers = new Set();
  let unsubscribeAuth = null, unsubscribeDb = null;
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
    const runId = generation, candidate = user.uid;
    state = 'checking'; notify();
    try {
      const allowed = await approvedMember(candidate, roomId);
      // Re-check actual Firebase Auth identity after async membership lookup.
      if (!allowed || destroyed || runId !== generation || auth.currentUser?.uid !== candidate) {
        if (runId === generation) clear();
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
  unsubscribeAuth = firebase.onAuthStateChanged(auth, changeAuth, () => clear('error'));
  const requireIdentity = (ownerRoom, ownerUid) => {
    if (destroyed || state !== 'ready' || !uid || ownerRoom !== roomId || ownerUid !== uid
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
    if (!['sticky.create', 'sticky.content', 'sticky.appearance', 'sticky.layout', 'sticky.mobile', 'sticky.delete'].includes(kind)) {
      return { ok: false, error: 'unsupported-command' };
    }
    const myGeneration = generation;
    const now = Date.now();
    const expected = command.expectedRevision;
    const fields = { 'sticky.content': 'content', 'sticky.appearance': 'appearance',
      'sticky.layout': 'layout', 'sticky.mobile': 'mobile' };
    let reason = '';
    try {
      const result = await firebase.runTransaction(firebase.ref(database, path(identity, id)), current => {
        if (generation !== myGeneration || auth.currentUser?.uid !== identity || state !== 'ready') {
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
          field: fields[kind], expectedRevision: expected, values: command.values,
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
      clear();
      subscribers.clear();
    }
  });
}
