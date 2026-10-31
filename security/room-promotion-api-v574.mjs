// Ver.574: FUTURE-ONLY HTTP boundary, protocol compatibility and recovery policy.
// This is a pure server-side contract, NOT a listener/router or deployed endpoint.
// All authorized writes still belong exclusively to handleRoomTodoPromotionV572.
import { handleRoomTodoPromotionV572 } from './room-promotion-request-v572.mjs';

export const PROMOTION_ROUTE_V574 = '/api/v2/todo-promotions';
export const PROMOTION_SCHEMA_V574 = 'roomsV2/1';
const BYTE_LIMIT = 8192;
const ALLOWED_BODY = new Set(['schemaVersion', 'roomId', 'intent']);
const ALLOWED_INTENT = new Set(['todoId', 'expectedRevision', 'requestId', 'title', 'description']);
const RESPONSE_CODES = {
  created: 201,
  'already-applied': 200,
  unauthenticated: 401,
  forbidden: 403,
  'invalid-request': 400,
  conflict: 409,
  unavailable: 503,
  indeterminate: 503
};
const validRequestId = value => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value);
const isRecord = value => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function response(status, detail = {}) {
  return {
    statusCode: RESPONSE_CODES[status] ?? (status === 'client-upgrade-required' ? 409 : 503),
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff'
      // No Access-Control-Allow-Origin or Set-Cookie: a real server must
      // enforce its own explicit host/origin/transport policy before calling.
    },
    body: { status, ...detail }
  };
}

function allowedHeaders(headers) {
  if (!isRecord(headers)) return null;
  const found = Object.create(null);
  for (const key of Reflect.ownKeys(headers)) {
    if (typeof key !== 'string') return null;
    const name = key.toLowerCase();
    if (!['authorization', 'content-type', 'x-workboard-schema'].includes(name)) continue;
    if (Object.hasOwn(found, name) || typeof headers[key] !== 'string') return null;
    found[name] = headers[key];
  }
  return found;
}

export async function handlePromotionHttpV574(request, trustedService) {
  try {
    if (!isRecord(request) || request.path !== PROMOTION_ROUTE_V574) {
      return response('invalid-request'); // Do not disclose any room data.
    }
    if (request.method !== 'POST') return response('invalid-request');
    const headers = allowedHeaders(request.headers);
    if (!headers) return response('invalid-request');
    if (headers['x-workboard-schema'] !== PROMOTION_SCHEMA_V574) {
      // This version marker is compatibility negotiation, NOT authentication.
      return response('client-upgrade-required');
    }
    if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers['content-type'] ?? '')) {
      return response('invalid-request');
    }
    const body = request.body;
    if (!isRecord(body) || body.schemaVersion !== PROMOTION_SCHEMA_V574
      || Reflect.ownKeys(body).some(key => !ALLOWED_BODY.has(key))) {
      return response('client-upgrade-required');
    }
    if (!isRecord(body.intent)
      || Reflect.ownKeys(body.intent).some(key => !ALLOWED_INTENT.has(key))) {
      return response('invalid-request');
    }
    // The actual HTTP server must enforce this bound while reading the stream.
    // Here we enforce a second limit on the already-parsed JSON contract.
    const serialized = JSON.stringify(body);
    if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > BYTE_LIMIT) {
      return response('invalid-request');
    }
    const result = await handleRoomTodoPromotionV572({
      authorizationHeader: headers.authorization,
      roomId: body.roomId,
      intent: body.intent
    }, trustedService);
    if (!isRecord(result) || !Object.hasOwn(RESPONSE_CODES, result.status)) {
      return response('indeterminate', { retrySameRequestId: true });
    }
    if (result.status === 'created' || result.status === 'already-applied') {
      return response(result.status, { taskId: result.taskId });
    }
    if (result.status === 'indeterminate') {
      return response('indeterminate', { retrySameRequestId: true });
    }
    return response(result.status);
  } catch {
    // This includes misconfigured test-service exceptions, bad getters, and
    // lost acknowledgements. Never leak tokens, exception strings or payloads.
    return response('indeterminate', { retrySameRequestId: true });
  }
}

// UI-facing decision only. Never save an ID token or generate a replacement
// operation ID when delivery/commit status is uncertain.
export function planPromotionRecoveryV574(status, originalRequestId) {
  if (!validRequestId(originalRequestId)) return { action: 'stop-invalid-request' };
  if (status === 'created' || status === 'already-applied') return { action: 'complete' };
  if (status === 'indeterminate' || status === 'transport-unknown' || status === 'unavailable') {
    return { action: 'confirm-then-retry-same-id', requestId: originalRequestId,
      renewIdToken: true, automaticRetry: false };
  }
  if (status === 'unauthenticated') return { action: 'reauthenticate', automaticRetry: false };
  if (status === 'forbidden') return { action: 'access-denied', automaticRetry: false };
  if (status === 'client-upgrade-required') return { action: 'upgrade-client', automaticRetry: false };
  if (status === 'conflict') return { action: 'refresh-and-review', automaticRetry: false };
  if (status === 'invalid-request') return { action: 'correct-request', automaticRetry: false };
  return { action: 'stop-unknown-outcome', automaticRetry: false };
}
