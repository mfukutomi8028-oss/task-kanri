// Ver.572: future-only trusted-service request boundary. NOT an HTTP route or browser writer.
// A real backend must supply Firebase Admin Auth.verifyIdToken and a privileged,
// hydrated room transaction adapter. Do not expose the injected service to clients.
import { planRoomTodoPromotionV570 } from './room-atomic-promotion.mjs';
import { planRoomTaskEditV578, validTaskEditCommandV578 } from './staged-task-edit-contract-v577.mjs';

const keyPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const projectPattern = /^[a-z0-9][a-z0-9-]{3,99}$/;
const requestFields = new Set(['authorizationHeader', 'roomId', 'intent']);
const commandFields = new Set(['todoId', 'expectedRevision', 'requestId', 'title', 'description']);
const isRecord = value => value !== null && typeof value === 'object'
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const validKey = value => typeof value === 'string' && keyPattern.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value);
const hasOnly = (object, allowed) => Reflect.ownKeys(object).every(key => allowed.has(key));
const indeterminate = () => ({ status: 'indeterminate', retrySameRequestId: true });

function validCommand(value) {
  return isRecord(value) && hasOnly(value, commandFields)
    && validKey(value.todoId) && validKey(value.requestId)
    && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 1
    && typeof value.title === 'string' && value.title.trim().length > 0
    && value.title.trim().length <= 120
    && (value.description === undefined || (typeof value.description === 'string'
      && value.description.trim().length <= 2000));
}
function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(header);
  return match && header === 'Bearer ' + match[1] ? match[1] : null;
}


// Shared Auth and SDK transaction-result gates. Service remains a trusted
// server injection; browser callers cannot supply identity/role or credentials.
async function verifiedUidV578(header,service){
  const idToken=bearerToken(header);
  if(!idToken)return null;
  try{
    const decoded=await service.verifyIdToken(idToken,true);
    if(!isRecord(decoded)||!validKey(decoded.uid)
      ||decoded.aud!==service.expectedProjectId
      ||decoded.iss!=='https://securetoken.google.com/'+service.expectedProjectId)return null;
    return decoded.uid;
  }catch{return null;}
}
function transactionSnapshotV578(result){
  try{
    if(result===null||typeof result!=='object'||Array.isArray(result)
      ||typeof result.committed!=='boolean'
      ||!result.snapshot||typeof result.snapshot.val!=='function')return null;
    return {committed:result.committed,state:result.snapshot.val()};
  }catch{return null;}
}

// request is a *server-parsed* header/body. service is injected ONLY by a trusted
// backend; the caller cannot select the expected project, UID, role, clock or task ID.
// Do not catch/log the raw token or database exceptions in a user-visible response.
export async function handleRoomTodoPromotionV572(request, service) {
  if (!isRecord(service) || !projectPattern.test(service.expectedProjectId)
    || typeof service.verifyIdToken !== 'function'
    || typeof service.transactRoom !== 'function'
    || typeof service.makeTaskId !== 'function'
    || typeof service.now !== 'function') {
    throw new TypeError('Trusted service adapter is not configured');
  }
  if (!isRecord(request) || !hasOnly(request, requestFields)
    || !validKey(request.roomId) || !validCommand(request.intent)) {
    return { status: 'invalid-request' };
  }
  const uid = await verifiedUidV578(request.authorizationHeader, service);
  if (!uid) return { status: 'unauthenticated' };

  // Generate once outside the retryable transaction callback. Never use the
  // browser's claimed UID/role/task ID or current date as server authority.
  let trusted;
  try {
    trusted = {
      uid,
      generatedTaskId: service.makeTaskId(),
      now: service.now()
    };
  } catch {
    return { status: 'unavailable' };
  }
  if (!validKey(trusted.generatedTaskId)
    || !Number.isSafeInteger(trusted.now) || trusted.now <= 0) {
    return { status: 'unavailable' };
  }

  let result;
  try {
    result = await service.transactRoom(request.roomId, currentRoom => {
      const planned = planRoomTodoPromotionV570(currentRoom, request.intent, trusted);
      return planned.action === 'commit' ? planned.room : undefined;
    });
  } catch {
    // A timeout may happen AFTER the server committed. Do not claim failure.
    return indeterminate();
  }
  // Firebase returns TransactionResult class instances; do not require a plain prototype.
  // Invalid shapes and throwing getters are still treated as indeterminate.
  const transaction = transactionSnapshotV578(result);
  if (!transaction) return indeterminate();
  const { committed, state } = transaction;
  // A transaction can retry/abort, so inspect its final snapshot, not a mutable
  // "last callback result" which might describe an earlier retry.
  let finalState;
  try {
    finalState = planRoomTodoPromotionV570(state, request.intent, trusted);
  } catch {
    return indeterminate();
  }
  if (committed) {
    return finalState.action === 'replayed' && finalState.taskId === trusted.generatedTaskId
      ? { status: 'created', taskId: finalState.taskId }
      : indeterminate();
  }
  if (finalState.action === 'replayed') {
    return { status: 'already-applied', taskId: finalState.taskId };
  }
  if (finalState.reason === 'not-authorized') return { status: 'forbidden' };
  if (finalState.reason === 'invalid-intent') return { status: 'invalid-request' };
  if (finalState.reason === 'room-unavailable' || finalState.action === 'commit') return indeterminate();
  return { status: 'conflict' };
}


// Ver.578: NEW task-edit operation, SAME trusted Auth and RTDB transaction
// adapter as Ver.572 ToDo promotion. No HTTP route or browser writer exists.
export async function handleRoomTaskEditV578(request,service){
  if(!isRecord(service)||!projectPattern.test(service.expectedProjectId)
    ||typeof service.verifyIdToken!=='function'
    ||typeof service.transactRoom!=='function'
    ||typeof service.now!=='function')
    throw new TypeError('Trusted service adapter is not configured');
  try{
    if(!isRecord(request)||!hasOnly(request,requestFields)
      ||!validKey(request.roomId)||!validTaskEditCommandV578(request.intent))
      return {status:'invalid-request'};
  }catch{return {status:'invalid-request'};}
  const uid=await verifiedUidV578(request.authorizationHeader,service);
  if(!uid)return {status:'unauthenticated'};
  let now;
  try{now=service.now();}catch{return {status:'unavailable'};}
  if(!Number.isSafeInteger(now)||now<=0)return {status:'unavailable'};
  const trusted={uid,now};
  let result;
  try{
    result=await service.transactRoom(request.roomId,current=>{
      const planned=planRoomTaskEditV578(current,request.intent,trusted);
      return planned.action==='commit'?planned.room:undefined;
    });
  }catch{return indeterminate();} // Lost ACK can occur after commit.
  const parsed=transactionSnapshotV578(result);
  if(!parsed)return indeterminate();
  let finalState;
  try{finalState=planRoomTaskEditV578(parsed.state,request.intent,trusted);}
  catch{return indeterminate();}
  if(parsed.committed){
    return finalState.action==='replayed'
      &&finalState.revision===request.intent.expectedRevision+1
      ? {status:'updated',taskKey:finalState.taskKey,revision:finalState.revision}
      : indeterminate();
  }
  if(finalState.action==='replayed')
    return {status:'already-applied',taskKey:finalState.taskKey,
      revision:finalState.revision};
  if(finalState.reason==='not-authorized')return {status:'forbidden'};
  if(finalState.reason==='invalid-intent')return {status:'invalid-request'};
  if(finalState.reason==='room-unavailable'||finalState.action==='commit')
    return indeterminate();
  return {status:'conflict'};
}
