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

// Canonical validation is shared by the server projection and client state.
export const isConversationId=value=>typeof value==='string'&&/^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$/.test(value);
export const isMessageId=value=>typeof value==='string'&&/^msg_p_[0-9a-f]{32}_q_[0-9a-f]{32}$/.test(value);
export const isMessagingTimestamp=value=>Number.isSafeInteger(value)&&value>=0;

export function validateRoomMessageInput(input,roomId){
  const data=validateMessageInput(input);
  if(!isMessagingRoomId(roomId)||data.refs.some(ref=>ref.roomId!==roomId)||data.replyTo!==null&&!isMessageId(data.replyTo))throw new TypeError('Invalid message reference');
  return data;
}

// Only project known fields. Never expose arbitrary stored metadata, old
// deleted text, cached reference titles or another room's business reference.
export function projectMessagingMessage(raw,{roomId,joinedAt}){
  if(!isMessagingRoomId(roomId)||!isMessagingTimestamp(joinedAt)||!isRecord(raw)||!isMessageId(raw.id)||!isPersonId(raw.senderId)
      ||!raw.id.startsWith('msg_'+raw.senderId+'_')||!isMessagingTimestamp(raw.createdAt)||raw.createdAt<=joinedAt
      ||!Number.isSafeInteger(raw.revision)||raw.revision<1)throw new TypeError('Invalid stored message');
  const base={id:raw.id,senderId:raw.senderId,createdAt:raw.createdAt,revision:raw.revision};
  if(raw.deletedAt!=null){
    if(!isMessagingTimestamp(raw.deletedAt)||raw.deletedAt<raw.createdAt)throw new TypeError('Invalid deletion timestamp');
    return {...base,deletedAt:raw.deletedAt};
  }
  if(raw.editedAt!=null){
    if(!isMessagingTimestamp(raw.editedAt)||raw.editedAt<raw.createdAt)throw new TypeError('Invalid edit timestamp');
    base.editedAt=raw.editedAt;
  }
  const rawRefs=raw.refs??[];
  if(!Array.isArray(rawRefs)||rawRefs.length>20)throw new TypeError('Invalid stored references');
  const refs=Array.from(rawRefs,ref=>{
    if(!isRecord(ref)||ref.roomId!==roomId)throw new TypeError('Cross-room reference');
    return {roomId:ref.roomId,type:ref.type,recordId:ref.recordId};
  });
  const input=validateRoomMessageInput({body:raw.body,replyTo:raw.replyTo??null,refs,
    attachmentIds:raw.attachmentIds??[],confirmationRequested:raw.confirmationRequested??false},roomId);
  const confirmation=raw.confirmation==null?null:projectConfirmation(raw);
  return {...base,...input,...(confirmation?{confirmation}:{})};
}

// Confirmation targets are immutable for one request. The membership epoch
// prevents a person who rejoined later from acknowledging an old message.
function projectConfirmation(raw){
  const value=raw.confirmation;
  if(raw.confirmationRequested!==true||!isRecord(value)||Object.keys(value).some(k=>!['round','targets'].includes(k))
      ||value.round!==raw.revision||!isRecord(value.targets))throw new TypeError('Invalid confirmation round');
  const entries=Object.entries(value.targets);
  if(entries.length<1||entries.length>99||entries.some(([id,epoch])=>!isPersonId(id)||id===raw.senderId||!isMessagingTimestamp(epoch)||epoch>=raw.createdAt))throw new TypeError('Invalid confirmation targets');
  return {round:value.round,targets:Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)))};
}

// A sender views explicit responses; read cursors are never confirmation input.
export function summarizeMessageConfirmation(message,members,receipts){
  if(message?.deletedAt!=null||message?.confirmation==null)return [];
  const {targets}=projectConfirmation(message);
  const openedAt=message.editedAt??message.createdAt;
  return Object.entries(targets).map(([personId,epoch])=>{
    const stamp=receipts?.[personId];
    const confirmedAt=isMessagingTimestamp(stamp)&&stamp>=openedAt?stamp:null;
    const member=members?.[personId];
    return {personId,status:member?.active!==true||member.joinedAt!==epoch?'left':confirmedAt===null?'pending':'confirmed',confirmedAt};
  });
}
