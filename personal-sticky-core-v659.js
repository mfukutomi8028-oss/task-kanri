/* Personal sticky note canonical pure model. No DOM, browser storage or Firebase access. */
export const STICKY_COLORS = Object.freeze(['ivory', 'lemon', 'peach', 'mint', 'sky', 'lavender']);
export const STICKY_TEXT_LIMIT = 2000;
export const STICKY_CANVAS = Object.freeze({ width: 1400, height: 900 });
export const STICKY_SIZE = Object.freeze({ width: 280, height: 220, minWidth: 220, minHeight: 160, maxWidth: 480, maxHeight: 500 });
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_FIELDS = new Set(['content', 'appearance', 'layout', 'mobile']);
export function isStickyId(id) {
  return typeof id === 'string' && KEY_PATTERN.test(id);
}
export function isStickyOwner(uid, roomId) {
  return isStickyId(uid) && isStickyId(roomId);
}
export function isRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
function plainText(value) {
  return typeof value === 'string' && value.length <= STICKY_TEXT_LIMIT;
}
function group(revision, data) {
  return { revision, ...data };
}
export function isStickyGroup(field, value) {
  if (!ALLOWED_FIELDS.has(field) || !value || typeof value !== 'object' || Array.isArray(value)
    || !isRevision(value.revision) || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return false;
  if (field === 'content') return plainText(value.text);
  if (field === 'appearance') return STICKY_COLORS.includes(value.color);
  if (field === 'layout') return integer(value.x, 0, 1400) && integer(value.y, 0, 900)
    && integer(value.width, STICKY_SIZE.minWidth, STICKY_SIZE.maxWidth)
    && integer(value.height, STICKY_SIZE.minHeight, STICKY_SIZE.maxHeight)
    && integer(value.zIndex, 0, 1000000000);
  return integer(value.order, 0, 1000000000);
}
/**
 * Propose an unused placement without moving any existing note.
 * Only the create command may apply this proposal; UI themes share the result.
 */
export function planStickyPlacement(notes = []) {
  const entries=Array.isArray(notes)?notes.filter(isStickyNote):[];
  const zIndex=Math.min(1000000000,1+Math.max(0,...entries.map(n=>n.layout.zIndex)));
  const order=Math.min(1000000000,1024+Math.max(0,...entries.map(n=>n.mobile.order)));
  const gap=24;
  const blocked=(x,y)=>entries.some(note=>x<note.layout.x+note.layout.width+gap
    && x+STICKY_SIZE.width+gap>note.layout.x
    && y<note.layout.y+note.layout.height+gap
    && y+STICKY_SIZE.height+gap>note.layout.y);
  for(let y=gap;y+STICKY_SIZE.height<=STICKY_CANVAS.height-gap;y+=STICKY_SIZE.height+gap)
    for(let x=gap;x+STICKY_SIZE.width<=STICKY_CANVAS.width-gap;x+=STICKY_SIZE.width+gap)
      if(!blocked(x,y))return {x,y,zIndex,order};
  // When the board is full, use a deterministic stagger and keep the note
  // inside the scrollable canvas rather than losing it off screen.
  const maxX=STICKY_CANVAS.width-STICKY_SIZE.width-gap;
  const maxY=STICKY_CANVAS.height-STICKY_SIZE.height-gap;
  return {
    x:gap+(entries.length*67)%(maxX-gap+1),
    y:gap+(entries.length*53)%(maxY-gap+1),
    zIndex,order
  };
}
/**
 * Move one note by a mobile list step using sparse integer ranks.
 * Reorder does not modify the desktop position or another user's records.
 * When adjacent ranks have no free integer, refuse instead of partially
 * renumbering multiple notes or silently overwriting concurrent changes.
 */
export function planMobileMove(notes, id, direction) {
  if (!Array.isArray(notes) || !['up', 'down'].includes(direction)) return null;
  const ordered=notes.filter(isStickyNote).sort((a,b)=>a.mobile.order-b.mobile.order
    || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
  const index=ordered.findIndex(note=>note.id===id);
  if(index<0)return null;
  const note=ordered[index];
  if(direction==='up'){
    if(index===0)return null;
    const previous=ordered[index-1],before=ordered[index-2];
    const order=previous.mobile.order-1;
    if(order<0||(before&&order<=before.mobile.order))return null;
    return {id,order,expectedRevision:note.mobile.revision};
  }
  if(index===ordered.length-1)return null;
  const next=ordered[index+1],after=ordered[index+2];
  const order=next.mobile.order+1;
  if(order>1000000000||(after&&order>=after.mobile.order))return null;
  return {id,order,expectedRevision:note.mobile.revision};
}
export function newSticky({ id, ownerUid, roomId, now, x = 24, y = 24, zIndex = 1, order = 0 }) {
  if (!isStickyId(id) || !isStickyOwner(ownerUid, roomId) || !integer(now, 1, Number.MAX_SAFE_INTEGER)
    || !integer(x, 0, STICKY_CANVAS.width) || !integer(y, 0, STICKY_CANVAS.height)
    || !integer(zIndex, 0, 1000000000) || !integer(order, 0, 1000000000)) {
    return { ok: false, error: 'invalid-create' };
  }
  return {
    ok: true,
    note: {
      schemaVersion: 1, id, ownerUid, roomId, createdAt: now, updatedAt: now,
      content: group(1, { text: '', updatedAt: now }),
      appearance: group(1, { color: 'lemon', updatedAt: now }),
      layout: group(1, { x, y, width: STICKY_SIZE.width, height: STICKY_SIZE.height, zIndex, updatedAt: now }),
      mobile: group(1, { order, updatedAt: now })
    }
  };
}
export function isStickyNote(note) {
  return Boolean(note && typeof note === 'object' && !Array.isArray(note)
    && note.schemaVersion === 1 && isStickyId(note.id) && isStickyOwner(note.ownerUid, note.roomId)
    && Number.isSafeInteger(note.createdAt) && note.createdAt > 0
    && Number.isSafeInteger(note.updatedAt) && note.updatedAt >= note.createdAt
    && [...ALLOWED_FIELDS].every(field => isStickyGroup(field, note[field])));
}
export function updateSticky(note, { field, expectedRevision, values, ownerUid, roomId, now }) {
  if (!isStickyNote(note) || note.ownerUid !== ownerUid || note.roomId !== roomId
    || !ALLOWED_FIELDS.has(field) || !isRevision(expectedRevision)
    || !integer(now, 1, Number.MAX_SAFE_INTEGER) || !values || typeof values !== 'object' || Array.isArray(values)) {
    return { ok: false, error: 'invalid-update' };
  }
  if (note[field].revision !== expectedRevision) return { ok: false, error: 'conflict' };
  const fields = { content: ['text'], appearance: ['color'],
    layout: ['x','y','width','height','zIndex'], mobile: ['order'] };
  const allowed = fields[field];
  if (Object.keys(values).some(key => !allowed.includes(key))) return { ok: false, error: 'invalid-update' };
  const next = { ...note[field], ...values, revision: expectedRevision + 1, updatedAt: now };
  if (!isStickyGroup(field, next)) return { ok: false, error: 'invalid-update' };
  return { ok: true, note: { ...note, [field]: next, updatedAt: Math.max(note.updatedAt, now) } };
}
export function canDeleteSticky(note, { ownerUid, roomId, expectedRevisions }) {
  if (!isStickyNote(note) || note.ownerUid !== ownerUid || note.roomId !== roomId
    || !expectedRevisions || typeof expectedRevisions !== 'object') return false;
  return [...ALLOWED_FIELDS].every(field => expectedRevisions[field] === note[field].revision);
}
export function stickyList(snapshot, { query = '', color = 'all' } = {}) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const term = String(query).normalize('NFKC').trim().toLocaleLowerCase('ja');
  return Object.values(snapshot).filter(isStickyNote)
    .filter(note => color === 'all' || note.appearance.color === color)
    .filter(note => !term || note.content.text.normalize('NFKC').toLocaleLowerCase('ja').includes(term))
    .sort((a,b) => a.mobile.order - b.mobile.order || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
}
