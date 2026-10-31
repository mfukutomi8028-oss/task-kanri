// Ver.577: a pure, read-only candidate for a FUTURE trusted task editor.
// Do not use this as an authorization decision or a database writer.
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

const fields=new Set([
  'title','description','status','priority','assignee','category','requester',
  'tags','checklist','comments','history','recurrence','recurrenceRule',
  'nextRecurringTaskId','recurringParentId','operationId','dueDate','dueTime',
  'pinned','updatedBy','updatedAt','completedAt','completedMemo',
  'knowledgeId','lastChange'
]);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  && (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const has=(r,k)=>Object.prototype.hasOwnProperty.call(r,k);
const validId=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v,'utf8')<=768
  &&!/[.#$\/\[\]\u0000-\u001f\u007f]/.test(v)
  &&!['__proto__','constructor','prototype'].includes(v);
const jsonOk=value=>{
  try{
    const encoded=JSON.stringify(value);
    return typeof encoded==='string'&&Buffer.byteLength(encoded,'utf8')<=1_000_000
      &&isDeepStrictEqual(value,JSON.parse(encoded));
  }catch{return false;}
};
const result=(reason,candidateCompatible=false)=>({
  result:'NO_GO',scope:'trusted-task-edit-validation-only',reason,
  candidateCompatible,clientWriteAllowed:false,databaseWritePerformed:false
});

// Caller MUST obtain task snapshot, authorization and revision from a trusted
// server inside a single room-scoped transaction. This function does not do so.
export function inspectTaskEditContractV577(before,after,context) {
  try{
    if(!plain(before)||!plain(after)||!plain(context)||!jsonOk(before)||!jsonOk(after))
      return result('invalid-task-json');
    if(!validId(context.taskKey))return result('invalid-task-key');
    const base=context.expectedRevision;
    if(!Number.isSafeInteger(base)||base<0||before.revision!==base)
      return result('stale-or-invalid-revision');
    if(!Number.isSafeInteger(after.revision)||after.revision!==base+1)
      return result('non-sequential-revision');
    if(has(before,'id')&&before.id!==context.taskKey)return result('source-key-mismatch');
    if(has(after,'id')&&after.id!==context.taskKey)return result('target-key-mismatch');
    for(const key of Object.keys(before)){
      if(!has(after,key))return result('removed-existing-field');
      if(!fields.has(key)&&key!=='revision'&&!isDeepStrictEqual(before[key],after[key]))
        return result('immutable-or-unknown-field-changed');
    }
    for(const key of Object.keys(after)){
      if(!has(before,key)&&!fields.has(key))
        return result('unapproved-new-field');
    }
    // Existing history and comments are append-only for this *draft* editor.
    // Removing or rewriting past entries is not a normal edit.
    for(const key of ['history','comments']){
      if(!has(before,key)&&!has(after,key))continue;
      if((has(before,key)&&!Array.isArray(before[key]))
        ||(has(after,key)&&!Array.isArray(after[key])))
        return result('legacy-activity-shape-unreviewed');
      const a=before[key]??[],b=after[key]??[];
      if(b.length<a.length||a.some((item,i)=>!isDeepStrictEqual(item,b[i])))
        return result('history-or-comment-rewrite');
    }
    return result('awaiting-trusted-writer-and-approval',true);
  }catch{return result('unrecognized-task-shape');}
}


// Ver.578: draft title/description edit, not an independent DB writer.
// Ver.577's existing field/history contract is the single validation authority.
const taskEditFieldsV578=new Set(['taskKey','expectedRevision','requestId','title','description']);
const requestIdV578=value=>typeof value==='string'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)
  && !['__proto__','constructor','prototype'].includes(value);
export function validTaskEditCommandV578(intent){
  try{
    return plain(intent)
      && Reflect.ownKeys(intent).every(key=>taskEditFieldsV578.has(key))
      && validId(intent.taskKey)&&requestIdV578(intent.requestId)
      && Number.isSafeInteger(intent.expectedRevision)&&intent.expectedRevision>=0
      && typeof intent.title==='string'&&intent.title.trim().length>0
      && intent.title.trim().length<=120
      && typeof intent.description==='string'&&intent.description.trim().length<=2000;
  }catch{return false;}
}
const denyEditV578=reason=>({action:'deny',reason});
export function planRoomTaskEditV578(room,intent,trusted){
  try{
    if(!plain(room))return denyEditV578('room-unavailable');
    if(!validTaskEditCommandV578(intent)||!plain(trusted)
      ||!requestIdV578(trusted.uid)
      ||!Number.isSafeInteger(trusted.now)||trusted.now<=0)
      return denyEditV578('invalid-intent');
    const {uid,now}=trusted;
    const role=room.access?.members?.[uid];
    // Re-evaluate membership inside the CURRENT room transaction, even on replay.
    if(role!=='editor'&&role!=='admin')return denyEditV578('not-authorized');
    const title=intent.title.trim(),description=intent.description.trim();
    const digest=createHash('sha256').update(JSON.stringify([
      'task-edit-v578',intent.taskKey,intent.expectedRevision,title,description
    ])).digest('hex');
    const previous=room.operations?.taskEdits?.[uid]?.[intent.requestId];
    if(previous!==undefined){
      const saved=room.shared?.tasks?.[intent.taskKey];
      if(!plain(previous)||previous.digest!==digest
        ||previous.taskKey!==intent.taskKey
        ||previous.revision!==intent.expectedRevision+1
        ||previous.authorUid!==uid
        ||!plain(saved)||!Number.isSafeInteger(saved.revision)
        ||saved.revision<previous.revision)
        return denyEditV578('request-id-reused-or-state-inconsistent');
      return {action:'replayed',taskKey:intent.taskKey,
        revision:previous.revision,room};
    }
    const before=room.shared?.tasks?.[intent.taskKey];
    if(!plain(before)||before.revision!==intent.expectedRevision)
      return denyEditV578('stale-or-missing-task');
    if(before.title===title&&(before.description??'')===description)
      return denyEditV578('no-change');
    const after={...before,title,description,revision:intent.expectedRevision+1,
      updatedAt:now};
    // Unchanged unknown fields/activity history are kept byte-for-byte at
    // the JSON value level. Server-only operation metadata records the actor.
    const report=inspectTaskEditContractV577(before,after,{
      taskKey:intent.taskKey,expectedRevision:intent.expectedRevision
    });
    if(!report.candidateCompatible)return denyEditV578('task-shape-incompatible');
    const operations=room.operations??{};
    const taskEdits=operations.taskEdits??{};
    const authorOps=taskEdits[uid]??{};
    if(!plain(operations)||!plain(taskEdits)||!plain(authorOps))
      return denyEditV578('room-unavailable');
    const nextRoom={
      ...room,
      shared:{...room.shared,tasks:{...room.shared.tasks,[intent.taskKey]:after}},
      operations:{...operations,taskEdits:{...taskEdits,[uid]:{
        ...authorOps,[intent.requestId]:{
          taskKey:intent.taskKey,revision:after.revision,digest,
          authorUid:uid,committedAt:now
        }
      }}}
    };
    return {action:'commit',taskKey:intent.taskKey,
      revision:after.revision,room:nextRoom};
  }catch{return denyEditV578('unrecognized-task-or-room');}
}
