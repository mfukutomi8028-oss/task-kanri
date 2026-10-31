// Ver.577: a pure, read-only candidate for a FUTURE trusted task editor.
// Do not use this as an authorization decision or a database writer.
import { isDeepStrictEqual } from 'node:util';

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
