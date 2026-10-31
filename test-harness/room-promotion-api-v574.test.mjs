import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePromotionHttpV574 as handle, planPromotionRecoveryV574 as recover,
  PROMOTION_ROUTE_V574 as route, PROMOTION_SCHEMA_V574 as schema } from '../security/room-promotion-api-v574.mjs';
import { auditLegacyRoomForV574 as audit } from '../security/legacy-room-schema-audit-v574.mjs';
import { evaluateLosslessSchemaV576, DRAFT_PATHS_V576, DRAFT_SCHEMA_V576 } from '../security/classic-lossless-schema-v576.mjs';

const headers = () => ({
  'authorization': 'Bearer emulator-only-token-alice-12345',
  'content-type': 'application/json',
  'x-workboard-schema': schema
});
const request = () => ({
  method: 'POST', path: route, headers: headers(),
  body: { schemaVersion: schema, roomId: 'room-a', intent: {
    todoId: 'todo1', expectedRevision: 2, requestId: 'sameOperationA',
    title: '共有タスク', description: 'APIの試験'
  } }
});
function sandbox() {
  let verify = 0, written = 0, taskNumber = 0;
  let lostAck = false;
  let room = {
    access: { members: { alice: 'editor', bob: 'viewer' } },
    shared: { tasks: {} },
    personal: { alice: { todos: { todo1: {
      id: 'todo1', ownerUid: 'alice', text: '旧ToDo', revision: 2, completed: false
    } } } }
  };
  const service = {
    expectedProjectId: 'demo-task-kanri-v574',
    async verifyIdToken(token, checkRevoked) {
      verify++; assert.equal(checkRevoked, true);
      if (token !== 'emulator-only-token-alice-12345') throw Error('test-token-invalid');
      return { uid: 'alice', aud: this.expectedProjectId,
        iss: 'https://securetoken.google.com/' + this.expectedProjectId };
    },
    makeTaskId: () => 'task' + (++taskNumber),
    now: () => 1761880000000,
    async transactRoom(roomId, updateRoom) {
      assert.equal(roomId, 'room-a');
      const result = updateRoom(structuredClone(room));
      if (result === undefined) return { committed: false, snapshot: { val: () => structuredClone(room) } };
      room = structuredClone(result);
      written++;
      if (lostAck) { lostAck = false; throw Error('acknowledgement missing after commit'); }
      return { committed: true, snapshot: { val: () => structuredClone(room) } };
    }
  };
  return { service, state: () => structuredClone(room),
    stats: () => ({verify, written}),
    dropAcknowledgement: () => {lostAck=true;},
    revokeMembership: () => {delete room.access.members.alice;}
  };
}
test('Ver.574 API creates and replays through existing Ver.572/570 with strict no-store response', async () => {
  const s = sandbox();
  const created = await handle(request(), s.service);
  assert.deepEqual(created.body, {status:'created', taskId:'task1'});
  assert.equal(created.statusCode, 201);
  assert.equal(created.headers['cache-control'], 'no-store');
  assert.equal(created.headers['access-control-allow-origin'], undefined);
  assert.equal(created.headers['set-cookie'], undefined);
  assert.deepEqual((await handle(request(), s.service)).body, {status:'already-applied',taskId:'task1'});
  assert.equal(s.stats().written, 1);
  assert.equal(s.state().personal.alice.todos.todo1.revision, 3);
  assert.equal(Object.keys(s.state().operations.promotions.alice).length, 1);
});
test('Ver.574 old routes/schema markers cannot reach Auth or DB adapter', async () => {
  const s = sandbox();
  for (const changed of [
    {...request(), method:'GET'},
    {...request(), path:'/rooms/room-a/todos'},
    {...request(), path:route+'?room=room-a'},
    {...request(), headers:{...headers(), 'x-workboard-schema':'classic'}},
    {...request(), headers:{'authorization':headers().authorization,'content-type':'application/json'}},
    {...request(), body:{...request().body, schemaVersion:'classic'}},
    {...request(), body:{...request().body, owner:'alice'}},
    {...request(), body:{...request().body, legacyRoom:'room-a'}},
    {...request(), body:{...request().body, intent:{...request().body.intent, owner:'alice'}}}
  ]) {
    const result = await handle(changed, s.service);
    assert.ok([400, 409].includes(result.statusCode));
    assert.equal(result.body.status === 'created', false);
  }
  assert.deepEqual(s.stats(), {verify:0, written:0});
});
test('Ver.574 malformed/missing Bearer and duplicate headers never authenticate', async () => {
  const s = sandbox();
  const inputs = [
    {...request(), headers:{...headers(),authorization:'not-bearer'}},
    {...request(), headers:{...headers(), Authorization:headers().authorization}},
    {...request(), headers:{...headers(),'content-type':'text/plain'}},
    {...request(), headers:{...headers(),authorization:['Bearer invalid']}},
    {...request(), body:{...request().body, intent:{...request().body.intent, requestId:'../bad'}}},
    {...request(), headers:{...headers(), 'x-workboard-schema':['roomsV2/1']}}
  ];
  for (const bad of inputs) {
    const response = await handle(bad, s.service);
    assert.notEqual(response.body.status,'created');
  }
  assert.equal(s.stats().written,0);
});
test('Ver.574 bounded parsed JSON and malicious getters cannot force unexpected commit', async () => {
  const s = sandbox();
  const oversize = request();oversize.body.intent.description='X'.repeat(8500);
  assert.equal((await handle(oversize,s.service)).statusCode,400);
  const fake = request();Object.defineProperty(fake.body,'roomId',{get(){throw Error('secret');}});
  const result=await handle(fake,s.service);
  assert.equal(result.body.status,'indeterminate');
  assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.deepEqual(s.stats(),{verify:0,written:0});
});
test('Ver.574 failed acknowledgement demands same request ID, reauth, and never duplicates a task', async () => {
  const s=sandbox();s.dropAcknowledgement();
  const first=await handle(request(),s.service);
  assert.equal(first.statusCode,503);
  assert.deepEqual(first.body,{status:'indeterminate',retrySameRequestId:true});
  assert.deepEqual(recover(first.body.status,request().body.intent.requestId),{
    action:'confirm-then-retry-same-id',requestId:'sameOperationA',
    renewIdToken:true,automaticRetry:false
  });
  assert.deepEqual((await handle(request(),s.service)).body,{status:'already-applied',taskId:'task1'});
  assert.equal(s.stats().written,1);
});
test('Ver.574 revoked membership is denied even when the previous operation was committed',async()=>{
  const s=sandbox();
  assert.equal((await handle(request(),s.service)).statusCode,201);
  s.revokeMembership();
  assert.equal((await handle(request(),s.service)).statusCode,403);
  assert.equal(s.stats().written,1);
});
test('Ver.574 retry policy never generates a replacement ID, logs a token or writes automatically',()=>{
  for (const state of ['transport-unknown','indeterminate','unavailable']) {
    const plan=recover(state,'sameOperationA');
    assert.equal(plan.requestId,'sameOperationA');
    assert.equal(plan.automaticRetry,false);
    assert.equal(plan.renewIdToken,true);
  }
  for (const [state,action] of [
    ['created','complete'],['already-applied','complete'],['conflict','refresh-and-review'],
    ['unauthenticated','reauthenticate'],['forbidden','access-denied'],
    ['client-upgrade-required','upgrade-client'],['invalid-request','correct-request']
  ])assert.equal(recover(state,'sameOperationA').action,action);
  assert.equal(recover('transport-unknown','../bad').action,'stop-invalid-request');
});
test('Ver.574 legacy inventory is read-only, identifies owner/schema incompatibilities and returns no IDs',()=>{
  const old={tasks:{task1:{id:'task1',title:'旧タスク',assignee:'担当',history:[{text:'内訳'}],revision:1}},
    todos:{todo1:{id:'todo1',text:'ToDo',memo:'説明',owner:'表示名',revision:0}},
    schedules:{one:{title:'予定'}}};
  const snapshot=structuredClone(old);
  const report=audit(old);
  assert.deepEqual(old,snapshot);
  assert.equal(report.result,'NO_GO');
  assert.equal(report.tasks.extraFields,1);
  assert.equal(report.todos.displayNameOwners,1);
  assert.equal(report.todos.missingUidOwner,1);
  assert.equal(report.todos.invalidRevision,1);
  assert.equal(report.otherCollectionsPresent.schedules,true);
  assert.equal(JSON.stringify(report).includes('表示名'),false);
  assert.equal(JSON.stringify(report).includes('担当'),false);
  assert.equal(JSON.stringify(report).includes('内訳'),false);
  assert.equal(JSON.stringify(report).includes('task1'),false);
  assert.equal(JSON.stringify(report).includes('todo1'),false);
});
test('Ver.574 even apparently valid legacy-shaped samples cannot automatically pass migration gate',()=>{
  const safe=audit({tasks:{},todos:{}});
  assert.equal(safe.result,'NO_GO');
  assert.equal(safe.countsVerified,true);
  assert.equal(safe.requiresRulesAndOldClientCutover,true);
  assert.equal(audit(null).countsVerified,false);
  assert.equal(audit({todos:[]}).reason,'unrecognized-legacy-schema');
  assert.equal(audit({tasks:{'bad.id':{title:'X',revision:1}}}).tasks.incompatibleKey,1);
});


test('Ver.575 reads related Classic records without modifying data or exposing content',()=>{
  const source={
    tasks:{taskA:{id:'taskA',title:'原本タイトル',revision:2,assignee:'担当A',
      history:[{text:'内部履歴'}],comments:[],checklist:[],nextRecurringTaskId:'taskB',knowledgeId:'knowA'},
      taskB:{id:'taskB',title:'定期',revision:1,recurringParentId:'taskA'}},
    todos:{todoA:{id:'todoA',text:'個人予定',memo:'非公開メモ',owner:'担当A',revision:2}},
    schedules:{schedA:{id:'schedA',relatedTaskId:'taskA',revision:1}},
    knowledge:{knowA:{taskId:'taskA'}},businessMemos:{memoA:{createdBy:'担当A'}},
    taskStarts:{taskA:{at:1}},
    workflowV148:{reminders:{'担当A':{taskA:{at:1}}}},
    workflowV152:{inbox:{'担当A':{note:{taskId:'taskA',title:'秘密のお知らせ'}}},
      duplicates:{oldSource:{targetId:'taskB'}},archives:{oldArchive:{archivedAt:1}}},
    meta:{users:['担当A','担当B']}
  };
  const original=structuredClone(source),result=audit(source);
  assert.deepEqual(source,original);
  assert.equal(result.result,'NO_GO');
  assert.equal(result.countsVerified,true);
  assert.equal(result.tasks.extraFields,2);
  assert.equal(result.relations.tasks.structuredDetailRecords,1);
  assert.equal(result.relations.tasks.recurrenceLinks,2);
  assert.equal(result.relations.tasks.missingActiveRecurrence,0);
  assert.equal(result.relations.tasks.knowledgeLinks,1);
  assert.equal(result.relations.schedules.taskLinks,1);
  assert.equal(result.relations.knowledge.taskLinks,1);
  assert.equal(result.relations.workflow.inboxEvents,1);
  assert.equal(result.relations.workflow.reminders,1);
  assert.equal(result.relations.workflow.duplicates,1);
  assert.equal(result.relations.workflow.archives,1);
  assert.equal(result.relations.businessMemos.total,1);
  for(const sensitive of ['担当A','内部履歴','個人予定','秘密のお知らせ','taskA','todoA']){
    assert.equal(JSON.stringify(result).includes(sensitive),false);
  }
});

test('Ver.575 reports missing targets and display-name collisions without deleting archives',()=>{
  const report=audit({
    tasks:{taskA:{title:'既存タスク',revision:1,
      nextRecurringTaskId:'removedTask',knowledgeId:'removedKnowledge',history:'old-text'}},
    todos:{'old.todo':{id:'old.todo',text:'テスト',owner:'担当A',revision:0}},
    schedules:{schedA:{relatedTaskId:'removedTask'}},
    knowledge:{knowA:{taskId:'removedTask'}},businessMemos:{memoA:{createdBy:'担当A'}},
    taskStarts:{removedTask:{at:1}},
    workflowV148:{reminders:{'担当A':{removedTask:{at:1}}}},
    workflowV152:{inbox:{'担当A':{note:{taskId:'removedTask'}}},
      duplicates:{oldSource:{targetId:'removedTask'}},archives:{oldSource:{archivedAt:1}}},
    meta:{users:['担当Ａ','担当A']},unexpectedRoot:{data:'private'}
  });
  assert.equal(report.result,'NO_GO');
  assert.equal(report.relations.tasks.missingActiveRecurrence,1);
  assert.equal(report.relations.tasks.missingKnowledge,1);
  assert.equal(report.relations.tasks.invalidDetailTypes,1);
  assert.equal(report.relations.schedules.missingActiveTask,1);
  assert.equal(report.relations.knowledge.missingActiveTask,1);
  assert.equal(report.relations.taskStarts.missingActiveTask,1);
  assert.equal(report.relations.workflow.missingActiveTask,1);
  assert.equal(report.relations.workflow.missingReminderTask,1);
  assert.equal(report.relations.workflow.missingDuplicateTarget,1);
  assert.equal(report.relations.workflow.archives,1);
  assert.equal(report.relations.users.normalizedNameCollisions,1);
  assert.equal(report.unknownTopLevelCollections,1);
  assert.equal(JSON.stringify(report).includes('private'),false);
});

test('Ver.575 invalid nested data is not misreported as an empty successful inventory',()=>{
  for(const source of [
    {tasks:{},workflowV152:{inbox:{user:[]}}},
    {tasks:{},workflowV148:{reminders:{user:[]}}},
    {tasks:{},businessMemos:{memo:'invalid'}},
    {tasks:{},meta:{users:[null]}},
    {tasks:{},meta:{users:{user:'invalid'}}}
  ]){
    const report=audit(source);
    assert.equal(report.result,'NO_GO');
    assert.equal(report.countsVerified,false);
    assert.equal(report.relations,undefined);
  }
  const report=audit({tasks:{},todos:{},meta:{users:[]}});
  assert.equal(report.countsVerified,true);
  assert.equal(report.result,'NO_GO');
  assert.equal(report.requiresUidMapping,true);
  assert.equal(report.requiresRulesAndOldClientCutover,true);
  assert.equal(report.requiresLocalClientInventory,true);
  assert.equal(report.sourceSnapshotHashVerified,false);
  assert.equal(report.restoredSnapshotHashVerified,false);
});


test('Ver.576 preserves every Classic JSON field with explicit UID mapping and stays NO_GO',()=>{
  const longTodoId='todo_'+('L'.repeat(140));
  const original={
    tasks:{taskA:{id:'taskA',title:'引継ぎ',description:'元の説明',revision:0,
      status:'未着手',assignee:'職員Ａ',dueDate:'2026-10-31',dueTime:'15:00',
      checklist:[{title:'確認',done:false}],history:[{note:'履歴の内容'}],
      comments:[{content:'個人情報のある返信'}],tags:['重要'],recurrenceRule:{interval:1},
      nextRecurringTaskId:'taskB',knowledgeId:'knowledgeA',futureField:{unknown:true}},
      taskB:{id:'taskB',title:'翌月',revision:1,recurringParentId:'taskA'}},
    todos:{[longTodoId]:{id:longTodoId,owner:'職員Ａ',text:'依頼内容',memo:'機密事項',
      revision:0,completed:false,order:0,createdAt:1710000000}},
    schedules:{scheduleA:{id:'scheduleA',revision:0,relatedTaskId:'taskA',memo:'開催予定'}},
    knowledge:{knowledgeA:{id:'knowledgeA',taskId:'taskA',body:'原文資料'}},
    businessMemos:{memoA:{id:'memoA',createdBy:'職員Ａ',body:'業務メモ'}},
    taskStarts:{taskA:{startAt:1234}},
    workflowV148:{reminders:{'職員Ａ':{taskA:{notifyAt:1234}},'職員B':{}},
      otherSettings:{custom:'残す'}},
    workflowV152:{inbox:{'職員Ａ':{eventA:{taskId:'taskA',body:'通知内容'}},'職員B':{}},
      archives:{historical:{archivedAt:1234}},duplicates:{former:{targetId:'taskB'}},
      futureExtension:{a:'not-discarded'}},
    meta:{users:['職員Ａ','職員B'],settings:{colors:['青','紫']}}
  };
  const snapshot=structuredClone(original);
  const identity={'職員Ａ':'uid_A','職員B':'uid_B'};
  const result=evaluateLosslessSchemaV576(original,identity);
  assert.deepEqual(original,snapshot,'dry-run must not mutate source');
  assert.equal(DRAFT_SCHEMA_V576,'roomsV2-lossless-draft/1');
  assert.equal(DRAFT_PATHS_V576.todos,'personal/{uid}/todos');
  assert.equal(DRAFT_PATHS_V576.meta,'internal/meta');
  assert.equal(result.result,'NO_GO');
  assert.equal(result.draftDeployable,false);
  assert.equal(result.reason,'pending-production-design');
  assert.equal(result.roundTripVerified,true);
  assert.equal(result.counts.tasks,2);
  assert.equal(result.counts.todos,1);
  assert.equal(result.counts.schedules,1);
  assert.equal(result.counts.businessMemos,1);
  assert.equal(result.identityMappingsSupplied,2);
  assert.ok(result.blockers.includes('target-rules-incompatible'));
  assert.ok(result.blockers.includes('legacy-revision-and-id-constraints'));
  for(const sensitive of ['職員Ａ','職員B','引継ぎ','依頼内容','機密事項','taskA',
    '知識','通知内容','uid_A',longTodoId]){
    assert.equal(JSON.stringify(result).includes(sensitive),false,'result must not leak source data');
  }
});

test('Ver.576 refuses guessed, missing, duplicate, extra and malformed identity mappings',()=>{
  const room={
    tasks:{t:{id:'t',title:'共有',revision:1}},
    todos:{one:{id:'one',owner:'担当X',text:'内容',revision:1}},
    workflowV152:{inbox:{'担当Y':{note:{taskId:'t'}}}},
    meta:{users:['担当X','担当Y']}
  };
  for(const [identity,reason] of [
    [undefined,'identity-map-missing'],
    [{'担当X':'uidX'},'unmapped-display-name'],
    [{'担当X':'uidX','担当Y':'uidX'},'identity-map-collision-or-invalid'],
    [{'担当X':'../bad','担当Y':'uidY'},'identity-map-collision-or-invalid'],
    [{'担当X':'uidX','担当Y':'uidY','別人':'uidZ'},'identity-map-extra-entry']
  ]){
    const result=evaluateLosslessSchemaV576(room,identity);
    assert.equal(result.result,'NO_GO');
    assert.equal(result.roundTripVerified,false);
    assert.equal(result.reason,reason);
    assert.equal(JSON.stringify(result).includes('担当X'),false);
  }
});

test('Ver.576 rejects incomplete/unknown/non-JSON source instead of a lossy projection',()=>{
  const cases=[
    [{},'legacy-snapshot-incomplete'],
    [{tasks:{},otherData:{private:'hidden'}},'unknown-source-collection'],
    [{tasks:{t:{title:'OK',unexpected:undefined}}},'non-json-or-oversized-source'],
    [{tasks:{t:{title:'OK',score:Number.POSITIVE_INFINITY}}},'non-json-or-oversized-source'],
    [{tasks:{t:{title:'OK',value:()=>7}}},'non-json-or-oversized-source'],
    [{tasks:{t:{title:'OK',arr:Array(3)}}},'non-json-or-oversized-source']
  ];
  for(const [value,reason] of cases){
    const report=evaluateLosslessSchemaV576(value,{});
    assert.equal(report.reason,reason);
    assert.equal(report.roundTripVerified,false);
    assert.equal(report.draftDeployable,false);
  }
  assert.equal(evaluateLosslessSchemaV576({tasks:{}},{}).roundTripVerified,true);
  assert.equal(evaluateLosslessSchemaV576({tasks:{}},{}).result,'NO_GO');
});
