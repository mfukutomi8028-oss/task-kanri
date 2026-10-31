// Ver.576: read-only, in-memory schema projection; NEVER a DB writer or deployment.
// Preserve every JSON value/field verbatim, segregate per-user data, then
// reconstruct and compare locally. No names, IDs, contents or digests in reports.
import { auditLegacyRoomForV574 } from './legacy-room-schema-audit-v574.mjs';

export const DRAFT_SCHEMA_V576 = 'roomsV2-lossless-draft/1';
export const DRAFT_PATHS_V576 = Object.freeze({
  tasks:'shared/tasks', schedules:'shared/schedules',
  knowledge:'shared/knowledge', businessMemos:'shared/businessMemos',
  taskStarts:'shared/taskStarts', todos:'personal/{uid}/todos',
  inbox:'personal/{uid}/inbox', reminders:'personal/{uid}/reminders',
  meta:'internal/meta', workflowV148Rest:'internal/workflowV148Rest',
  workflowV152Rest:'internal/workflowV152Rest'
});
const sharedKeys=['tasks','schedules','knowledge','businessMemos','taskStarts'];
const rootKeys=[...sharedKeys,'todos','workflowV148','workflowV152','meta'];
const validUid = value=>typeof value==='string' && value.length>0 && value.length<=128
  && !/[.#$\/\[\]\u0000-\u001f\u007f]/.test(value)
  && !['__proto__','prototype','constructor'].includes(value);
const plain = value => value!==null && typeof value==='object' && !Array.isArray(value)
  && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const safeObject=()=>Object.create(null);
const enumerable=record=>Object.entries(record);
const jsonClone=value=>structuredClone(value);

function validJson(value,state,depth=0) {
  if(depth>32||++state.nodes>30000)return false;
  if(value===null||typeof value==='boolean'||typeof value==='string')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value)){
    if(value.length>10000||Object.keys(value).length!==value.length)return false;
    for(let i=0;i<value.length;i++)if(!has(value,i)||!validJson(value[i],state,depth+1))return false;
    return true;
  }
  if(!plain(value)||Object.keys(value).length>5000)return false;
  if(state.seen.has(value))return false;
  state.seen.add(value);
  for(const [k,v] of enumerable(value)){
    if(!k || /[.#$\/\[\]\u0000-\u001f\u007f]/.test(k))return false;
    if(!validJson(v,state,depth+1))return false;
  }
  return true;
}
const checkJson=root=>{
  try{
    if(!validJson(root,{nodes:0,seen:new WeakSet()}))return false;
    return Buffer.byteLength(JSON.stringify(root),'utf8')<=2_000_000;
  }catch{return false;}
};
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(plain(value))return Object.fromEntries(enumerable(value)
    .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)]));
  return value;
};
const equalJson=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const report=(reason,extra={})=>({
  result:'NO_GO',scope:'schema-dry-run',schema:DRAFT_SCHEMA_V576,
  reason,roundTripVerified:false,draftDeployable:false,...extra
});
const isRecord=value=>plain(value);
const nestedMap=(raw)=>{
  if(raw===undefined)return safeObject();
  if(!isRecord(raw))throw Error('not-a-map');
  return raw;
};
const remainder=(source,omit)=>{
  const result=safeObject();
  for(const [k,v] of enumerable(source))if(k!==omit)result[k]=jsonClone(v);
  return result;
};

// Explicit, externally approved identity mapping is REQUIRED before migration.
// This test function cannot authenticate the approval; it NEVER declares GO.
// It does not return a projection or copy data to any destination.
export function evaluateLosslessSchemaV576(source,identityByDisplayName) {
  const inventory=auditLegacyRoomForV574(source);
  if(!inventory.countsVerified)return report('legacy-inventory-incomplete');
  if(!plain(source)||Object.keys(source).some(k=>!rootKeys.includes(k)))
    return report('unknown-source-collection');
  if(!rootKeys.some(key=>has(source,key)))return report('legacy-snapshot-incomplete');
  if(!checkJson(source))return report('non-json-or-oversized-source');
  if(!plain(identityByDisplayName))return report('identity-map-missing');
  const uidValues=Object.values(identityByDisplayName);
  if(uidValues.some(uid=>!validUid(uid)) || new Set(uidValues).size!==uidValues.length)
    return report('identity-map-collision-or-invalid');
  try {
    const names=new Set();
    const todos=nestedMap(source.todos);
    for(const [,item] of enumerable(todos)){
      if(!plain(item)||typeof item.owner!=='string'||!item.owner)
        return report('todo-owner-unmapped');
      names.add(item.owner);
    }
    const w148=nestedMap(source.workflowV148);
    const w152=nestedMap(source.workflowV152);
    const inbox=nestedMap(w152.inbox),reminders=nestedMap(w148.reminders);
    for(const [name,events] of enumerable(inbox)){
      nestedMap(events);names.add(name);
    }
    for(const [name,items] of enumerable(reminders)){
      nestedMap(items);names.add(name);
    }
    const meta=nestedMap(source.meta);
    if(meta.users!==undefined){
      if(!Array.isArray(meta.users))return report('legacy-users-invalid');
      for(const name of meta.users){
        if(typeof name!=='string'||!name)return report('legacy-users-invalid');
        names.add(name);
      }
    }
    for(const name of names)if(!has(identityByDisplayName,name)
      ||!validUid(identityByDisplayName[name]))return report('unmapped-display-name');
    if(Object.keys(identityByDisplayName).some(name=>!names.has(name)))
      return report('identity-map-extra-entry');

    const draft={shared:safeObject(),personal:safeObject(),internal:safeObject()};
    for(const key of sharedKeys)if(has(source,key))draft.shared[key]=jsonClone(source[key]);
    if(has(source,'meta'))draft.internal.meta=jsonClone(source.meta);
    if(has(source,'workflowV148'))draft.internal.workflowV148Rest=remainder(w148,'reminders');
    if(has(source,'workflowV152'))draft.internal.workflowV152Rest=remainder(w152,'inbox');
    // Never infer UID from display name; use the explicitly supplied mapping.
    const bind=name=>{
      const uid=identityByDisplayName[name];
      if(!has(draft.personal,uid))draft.personal[uid]={
        todos:safeObject(),inbox:safeObject(),reminders:safeObject()
      };
      return draft.personal[uid];
    };
    for(const [key,item] of enumerable(todos))bind(item.owner).todos[key]=jsonClone(item);
    for(const [name,events] of enumerable(inbox)){
      const person=bind(name);
      for(const [key,item] of enumerable(events))person.inbox[key]=jsonClone(item);
    }
    for(const [name,items] of enumerable(reminders)){
      const person=bind(name);
      for(const [key,item] of enumerable(items))person.reminders[key]=jsonClone(item);
    }

    const recovered=safeObject();
    for(const key of sharedKeys)if(has(source,key))recovered[key]=jsonClone(draft.shared[key]);
    if(has(source,'meta'))recovered.meta=jsonClone(draft.internal.meta);
    if(has(source,'todos')){
      recovered.todos=safeObject();
      for(const person of Object.values(draft.personal))
        for(const [key,item] of enumerable(person.todos)){
          if(has(recovered.todos,key))return report('todo-key-collision');
          recovered.todos[key]=jsonClone(item);
        }
    }
    const inverse=new Map(Object.entries(identityByDisplayName)
      .map(([name,uid])=>[uid,name]));
    for(const [name,section] of [['workflowV148','reminders'],['workflowV152','inbox']]){
      if(!has(source,name))continue;
      const partName=name==='workflowV148'?'workflowV148Rest':'workflowV152Rest';
      const raw=jsonClone(draft.internal[partName]);
      if(has(source[name],section)){
        raw[section]=safeObject();
        for(const [uid,person] of enumerable(draft.personal)){
          const displayName=inverse.get(uid);
          const entriesForUser=person[section];
          if(has(section==='inbox'?inbox:reminders,displayName))
            raw[section][displayName]=jsonClone(entriesForUser);
        }
        // Restore an originally present, empty recipient map without dropping it.
      }
      recovered[name]=raw;
    }
    if(!equalJson(source,recovered))return report('round-trip-mismatch');
    // The in-memory draft is ephemeral. The existing Rules cannot validate it,
    // client access, historical revision/ID constraints and UID approvals remain.
    return report('pending-production-design',{
      roundTripVerified:true,legacyRecordsVerified:true,
      identityMappingsSupplied:names.size,
      counts:{tasks:inventory.tasks.total,todos:inventory.todos.total,
        schedules:inventory.relations.schedules.total,
        businessMemos:inventory.relations.businessMemos.total},
      blockers:['identity-approval','target-rules-incompatible',
        'legacy-revision-and-id-constraints','backup-restore-unverified',
        'offline-client-cutover-unverified','operational-approval']
    });
  }catch{return report('unrecognized-legacy-structure');}
}
