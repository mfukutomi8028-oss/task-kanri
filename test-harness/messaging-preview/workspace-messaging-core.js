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

const messageFields = new Set(['body','replyTo','refs','attachmentIds','confirmationRequested']);
const referenceFields = new Set(['roomId','type','recordId']);
const referenceTypes = new Set(['task','schedule','memo']);
const isRecord = value => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const key = value => typeof value === 'string' && value.length > 0
  && new TextEncoder().encode(value).length <= 768 && !/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);

export function messageIdFor(personId, requestId) {
  if (!isPersonId(personId) || !hasOpaqueId(requestId,'q_')) throw new TypeError('Invalid sender or request ID');
  return 'msg_' + personId + '_' + requestId;
}

// The transport and server independently validate the room, membership, ID and
// content. Keep reference titles/body out of the shared payload until authorized.
export function validateMessageInput(input) {
  if (!isRecord(input) || Object.keys(input).some(field => !messageFields.has(field))) {
    throw new TypeError('Invalid message input');
  }
  const {body,replyTo=null,refs=[],attachmentIds=[],confirmationRequested=false} = input;
  if (typeof body !== 'string' || body.length > 6000 || body.includes('\u0000')
      || (replyTo !== null && !key(replyTo)) || !Array.isArray(refs) || refs.length > 20
      || !Array.isArray(attachmentIds) || attachmentIds.length !== 0 || typeof confirmationRequested !== 'boolean') {
    throw new TypeError('Invalid message content');
  }
  const normalizedRefs = Array.from(refs, value => {
    if (!isRecord(value) || Object.keys(value).some(field => !referenceFields.has(field))
        || !isMessagingRoomId(value.roomId) || !referenceTypes.has(value.type) || !key(value.recordId)) {
      throw new TypeError('Invalid business reference');
    }
    return Object.freeze({roomId:value.roomId,type:value.type,recordId:value.recordId});
  });
  if (!body.trim() && normalizedRefs.length === 0) throw new TypeError('Message content required');
  return Object.freeze({body,replyTo,refs:Object.freeze(normalizedRefs),attachmentIds:Object.freeze([]),confirmationRequested});
}

function assertCursor(cursor) {
  if (!isRecord(cursor) || !Number.isSafeInteger(cursor.createdAt) || cursor.createdAt < 0 || !key(cursor.id)) {
    throw new TypeError('Invalid message cursor');
  }
}

export function compareCursor(a,b) {
  assertCursor(a); assertCursor(b);
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  // Message IDs have a nonnumeric prefix and compare consistently by key.
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

export function advanceReadCursor(current,next) {
  assertCursor(next);
  const chosen = current == null || compareCursor(current,next) < 0 ? next : current;
  return Object.freeze({createdAt:chosen.createdAt,id:chosen.id});
}
