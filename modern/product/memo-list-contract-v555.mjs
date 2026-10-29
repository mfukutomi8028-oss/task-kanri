// Ver.555: pure read-only Modern business-memo presentation contract.
// Business memo ownership, pin grouping and user-local manual order live
// exclusively in the Classic work-features sidecar read facade.
const EMPTY = Object.freeze([]);
const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function fail(reason) {
  return Object.freeze({
    ready:false, reason, source:null, roomId:'', selectedUser:'',
    total:0, visible:0, pinnedCount:0, categories:EMPTY, rows:EMPTY
  });
}
export function selectModernMemosV555(memoSnapshot, classicSnapshot, {
  query = '', category = ''
} = {}) {
  if (!classicSnapshot || classicSnapshot.ready !== true
    || classicSnapshot.version !== '550'
    || !['local-only','remote-online'].includes(classicSnapshot.source)
    || typeof classicSnapshot.roomId !== 'string' || !classicSnapshot.roomId
    || typeof classicSnapshot.selectedUser !== 'string' || !classicSnapshot.selectedUser) {
    return fail(classicSnapshot?.reason || 'classic-unavailable');
  }
  if (!memoSnapshot || memoSnapshot.version !== '555' || memoSnapshot.ready !== true
    || !['local-only','remote-online'].includes(memoSnapshot.source)
    || !Array.isArray(memoSnapshot.rows) || !Array.isArray(memoSnapshot.categories)) {
    return fail(memoSnapshot?.reason || 'memo-unavailable');
  }
  if (memoSnapshot.roomId !== classicSnapshot.roomId
    || memoSnapshot.selectedUser !== classicSnapshot.selectedUser
    || memoSnapshot.source !== classicSnapshot.source) {
    return fail('inconsistent-owner');
  }
  const seen = new Set();
  const ordered = [];
  let normalSeen = false;
  let pinnedCount = 0;
  for (const item of memoSnapshot.rows) {
    if (!item || typeof item.id !== 'string' || !item.id
      || /[.#$/\[\]]/.test(item.id) || seen.has(item.id)
      || typeof item.title !== 'string' || typeof item.body !== 'string'
      || typeof item.category !== 'string' || typeof item.pinned !== 'boolean'
      || typeof item.updatedBy !== 'string' || typeof item.createdBy !== 'string'
      || !Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string')
      || !Number.isSafeInteger(item.revision) || item.revision < 0
      || !Number.isFinite(item.updatedAt) || !Number.isFinite(item.createdAt)) {
      return fail('invalid-snapshot');
    }
    if (item.pinned) {
      if (normalSeen) return fail('invalid-order'); // Pinned always first.
      pinnedCount++;
    } else normalSeen = true;
    seen.add(item.id);
    ordered.push(Object.freeze({
      id:item.id, title:item.title, body:item.body, category:item.category,
      tags:Object.freeze([...item.tags]), pinned:item.pinned,
      updatedBy:item.updatedBy, createdBy:item.createdBy,
      updatedAt:item.updatedAt, createdAt:item.createdAt, revision:item.revision
    }));
  }
  if (memoSnapshot.categories.some(category => typeof category !== 'string'))
    return fail('invalid-snapshot');
  const normalizedCategories = Object.freeze([...new Set(memoSnapshot.categories)]);
  const needle = norm(query);
  const filter = String(category ?? '');
  const visible = ordered.filter(memo => (!filter || memo.category === filter)
    && (!needle || norm([
      memo.title,memo.body,memo.category,...memo.tags
    ].join(' ')).includes(needle)));
  return Object.freeze({
    ready:true, reason:null, source:memoSnapshot.source,
    roomId:memoSnapshot.roomId, selectedUser:memoSnapshot.selectedUser,
    total:ordered.length, visible:visible.length, pinnedCount,
    categories:normalizedCategories,
    rows:Object.freeze(visible)
  });
}
