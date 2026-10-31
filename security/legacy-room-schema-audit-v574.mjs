// Ver.574: READ-ONLY inventory of Classic /rooms data for manual migration review.
// Does not transform records, write to either database, or expose names/IDs in output.
import { TODO_MAX_LENGTH, TODO_MEMO_MAX_LENGTH } from '../todo-sync-v136.js';

const record = v => v !== null && typeof v === 'object'
  && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const newKey = v => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)
  && !['__proto__', 'constructor', 'prototype'].includes(v);
const futureTaskFields = new Set(['title', 'description', 'revision']);
const otherCollections = Object.freeze(['schedules', 'knowledge', 'businessMemos', 'taskStarts', 'meta', 'workflowV148', 'workflowV152']);
const resultUnavailable = reason => ({
  result: 'NO_GO', scope: 'legacy-read-only', reason,
  // Never infer that an inaccessible or malformed snapshot means empty.
  countsVerified: false
});


// Ver.575: relationship inspection is a PART of this existing auditor, not a
// second migration path. Only numeric counts/known labels leave this function.
function inspectRelationsV575(room, taskKeys) {
  let inspected=0;
  const entries=value=>{
    if(value===undefined||value===null)return [];
    if(!record(value))throw Error('invalid-collection');
    const keys=Object.keys(value);
    inspected+=keys.length;
    if(keys.length>5000||inspected>25000)throw RangeError('audit-limit');
    return keys.map(key=>[key,value[key]]);
  };
  const item=value=>{
    if(!record(value)||Object.keys(value).length>160)throw Error('invalid-record');
    return value;
  };
  const tasks=new Set(taskKeys),knowledgeRows=entries(room.knowledge);
  const knowledge=new Set(knowledgeRows.map(([key])=>key));
  const summary={
    schedules:{total:0,taskLinks:0,missingActiveTask:0},
    knowledge:{total:knowledgeRows.length,taskLinks:0,missingActiveTask:0},
    businessMemos:{total:0,displayNameAuthors:0},
    taskStarts:{total:0,missingActiveTask:0},
    tasks:{recurrenceLinks:0,missingActiveRecurrence:0,knowledgeLinks:0,
      missingKnowledge:0,structuredDetailRecords:0,invalidDetailTypes:0},
    workflow:{inboxRecipients:0,inboxEvents:0,missingActiveTask:0,
      reminders:0,missingReminderTask:0,duplicates:0,missingDuplicateTarget:0,
      archives:0},users:{displayNameEntries:0,normalizedNameCollisions:0}
  };
  for(const [,row] of entries(room.tasks)){
    const t=item(row);
    const details=['comments','checklist','history','tags'];
    if(details.some(field=>Object.hasOwn(t,field)))summary.tasks.structuredDetailRecords++;
    if(details.some(field=>Object.hasOwn(t,field)&&!Array.isArray(t[field])))
      summary.tasks.invalidDetailTypes++;
    for(const field of ['nextRecurringTaskId','recurringParentId']){
      if(!t[field])continue;
      summary.tasks.recurrenceLinks++;
      if(typeof t[field]!=='string'||!tasks.has(t[field]))
        summary.tasks.missingActiveRecurrence++;
    }
    if(t.knowledgeId){
      summary.tasks.knowledgeLinks++;
      if(typeof t.knowledgeId!=='string'||!knowledge.has(t.knowledgeId))
        summary.tasks.missingKnowledge++;
    }
  }
  for(const [,row] of knowledgeRows){
    const k=item(row);
    if(!k.taskId)continue;
    summary.knowledge.taskLinks++;
    if(typeof k.taskId!=='string'||!tasks.has(k.taskId))
      summary.knowledge.missingActiveTask++;
  }
  for(const [,row] of entries(room.schedules)){
    const schedule=item(row);summary.schedules.total++;
    if(!schedule.relatedTaskId)continue;
    summary.schedules.taskLinks++;
    if(typeof schedule.relatedTaskId!=='string'||!tasks.has(schedule.relatedTaskId))
      summary.schedules.missingActiveTask++;
  }
  for(const [,row] of entries(room.businessMemos)){
    const memo=item(row);summary.businessMemos.total++;
    if(typeof memo.createdBy==='string'&&memo.createdBy.trim())
      summary.businessMemos.displayNameAuthors++;
  }
  for(const [taskId] of entries(room.taskStarts)){
    summary.taskStarts.total++;
    if(!tasks.has(taskId))summary.taskStarts.missingActiveTask++;
  }
  const workflow=room.workflowV152==null?{}:item(room.workflowV152);
  const oldWorkflow=room.workflowV148==null?{}:item(room.workflowV148);
  for(const [,messages] of entries(workflow.inbox)){
    summary.workflow.inboxRecipients++;
    for(const [,message] of entries(messages)){
      const event=item(message);summary.workflow.inboxEvents++;
      if(event.taskId&&!tasks.has(event.taskId))summary.workflow.missingActiveTask++;
    }
  }
  for(const [,reminders] of entries(oldWorkflow.reminders)){
    for(const [taskId] of entries(reminders)){
      summary.workflow.reminders++;
      if(!tasks.has(taskId))summary.workflow.missingReminderTask++;
    }
  }
  for(const [,value] of entries(workflow.duplicates)){
    const duplicate=item(value);summary.workflow.duplicates++;
    if(duplicate.targetId&&!tasks.has(duplicate.targetId))
      summary.workflow.missingDuplicateTarget++;
  }
  // Archive IDs can be tombstones; never infer automatic deletion from them.
  summary.workflow.archives=entries(workflow.archives).length;
  const meta=room.meta==null?{}:item(room.meta);
  if(meta.users!==undefined&&meta.users!==null){
    if(!Array.isArray(meta.users)||meta.users.length>5000)throw Error('invalid-users');
    const names=new Set();summary.users.displayNameEntries=meta.users.length;
    for(const name of meta.users){
      if(typeof name!=='string')throw Error('invalid-name');
      const normalized=name.trim().normalize('NFKC');
      if(names.has(normalized))summary.users.normalizedNameCollisions++;
      names.add(normalized);
    }
  }
  return summary;
}

export function auditLegacyRoomForV574(snapshot) {
  try {
  if (!record(snapshot)) return resultUnavailable('snapshot-unavailable');
  if ((snapshot.tasks !== undefined && snapshot.tasks !== null && !record(snapshot.tasks))
    || (snapshot.todos !== undefined && snapshot.todos !== null && !record(snapshot.todos))) {
    return resultUnavailable('unrecognized-legacy-schema');
  }
  const tasks = Object.entries(snapshot.tasks ?? {});
  const todos = Object.entries(snapshot.todos ?? {});
  if (tasks.length > 5000 || todos.length > 5000) {
    return resultUnavailable('inventory-size-limit');
  }
  const taskStats = { total: tasks.length, extraFields: 0, missingTitle: 0, incompatibleKey: 0 };
  const todoStats = {
    total: todos.length, displayNameOwners: 0, missingUidOwner: 0,
    incompatibleKey: 0, invalidRevision: 0, tooLong: 0
  };
  for (const [key, item] of tasks) {
    if (!record(item)) return resultUnavailable('unrecognized-task');
    if (!newKey(key)) taskStats.incompatibleKey++;
    if (typeof item.title !== 'string' || !item.title.trim()) taskStats.missingTitle++;
    if (Object.keys(item).some(field => !futureTaskFields.has(field))) taskStats.extraFields++;
  }
  for (const [key, item] of todos) {
    if (!record(item)) return resultUnavailable('unrecognized-todo');
    if (!newKey(key)) todoStats.incompatibleKey++;
    if (typeof item.owner === 'string' && item.owner.length) todoStats.displayNameOwners++;
    if (typeof item.ownerUid !== 'string' || !item.ownerUid.length) todoStats.missingUidOwner++;
    if (!Number.isSafeInteger(item.revision) || item.revision < 1) todoStats.invalidRevision++;
    if (typeof item.text !== 'string' || item.text.length > TODO_MAX_LENGTH
      || typeof item.memo === 'string' && item.memo.length > TODO_MEMO_MAX_LENGTH) todoStats.tooLong++;
  }
  const relations = inspectRelationsV575(snapshot, tasks.map(([key]) => key));
  const collections = Object.fromEntries(otherCollections.map(key => [
    key, snapshot[key] !== undefined && snapshot[key] !== null
  ]));
  // Always NO_GO even when the counts look clean. Verified UID mapping,
  // complete task schema + relations, rollback and actual applied Rules are
  // separate mandatory gates (not inferred from anonymous JSON).
  return {
    result: 'NO_GO', scope: 'legacy-read-only', countsVerified: true,
    tasks: taskStats, todos: todoStats, relations,
    otherCollectionsPresent: collections,
    unknownTopLevelCollections: Object.keys(snapshot).filter(key =>
      !['tasks','todos',...otherCollections].includes(key)).length,
    requiresUidMapping: true, requiresLosslessTaskSchema: true,
    requiresRulesAndOldClientCutover: true,
    requiresBackupRestoreAndReconciliation: true,
    requiresLocalClientInventory: true,
    sourceSnapshotHashVerified: false, restoredSnapshotHashVerified: false
  };
  } catch (error) {
    return resultUnavailable(error instanceof RangeError
      ? 'inventory-size-limit' : 'unrecognized-legacy-schema');
  }
}
