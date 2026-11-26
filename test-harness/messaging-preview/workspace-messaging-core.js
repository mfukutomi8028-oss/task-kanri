// Shared, storage-independent messaging identifiers. Never derive them from labels.
const hasOpaqueId = (value, prefix) => typeof value === 'string' && value.length === 34
  && value.startsWith(prefix) && /^[0-9a-f]{32}$/.test(value.slice(2));

export function isPersonId(value) { return hasOpaqueId(value, 'p_'); }

export function isMessagingRoomId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 60
    && value.trim() === value && !/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);
}

// IDs are unique inside a room. The caller generates opaque person/group UUIDs;
// neither display names nor group titles affect identity.
export function conversationIdFor({roomId, kind, personIds, groupId} = {}) {
  if (!isMessagingRoomId(roomId) || !Array.isArray(personIds)
      || personIds.length < 1 || personIds.length > 100
      || Array.from(personIds).some(id => !isPersonId(id))
      || new Set(personIds).size !== personIds.length) {
    throw new TypeError('Invalid conversation room or participants');
  }
  if (kind === 'direct' && personIds.length === 2 && groupId === undefined) {
    return 'dm_' + [...personIds].sort().join('_');
  }
  if (kind === 'self' && personIds.length === 1 && groupId === undefined) {
    return 'self_' + personIds[0];
  }
  if (kind === 'group' && hasOpaqueId(groupId, 'g_')) return 'group_' + groupId;
  throw new TypeError('Invalid conversation kind or identifier');
}
