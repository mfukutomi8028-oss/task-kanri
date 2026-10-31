// Ver.573: real Admin Auth+RTDB SDK against two local Emulators only.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { handleRoomTodoPromotionV572 } from '../security/room-promotion-request-v572.mjs';
import { auditLegacyRoomForV574 } from '../security/legacy-room-schema-audit-v574.mjs';
import { evaluateLosslessSchemaV576 } from '../security/classic-lossless-schema-v576.mjs';
import { handlePromotionHttpV574, PROMOTION_ROUTE_V574, PROMOTION_SCHEMA_V574 } from '../security/room-promotion-api-v574.mjs';
import { createDemoAdminServiceV573, DEMO_PROJECT_V573, DEMO_DB_URL_V573 }
  from '../security/firebase-admin-staging-v573.mjs';

const authHost = '127.0.0.1:9099', dbHost = '127.0.0.1:9001';
if ((process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost)
  || (process.env.FIREBASE_DATABASE_EMULATOR_HOST && process.env.FIREBASE_DATABASE_EMULATOR_HOST !== dbHost)) {
  throw Error('不正なエミュレータ接続先');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = dbHost;
const app = initializeApp({ projectId: DEMO_PROJECT_V573, databaseURL: DEMO_DB_URL_V573 },
  'task-kanri-v573-demo');
try {
  const auth = getAuth(app), database = getDatabase(app);
  const service = createDemoAdminServiceV573(app);
  const email = 'alice@example.invalid', password = 'V573-Only-Demo!123';
  await auth.createUser({ uid: 'alice', email, password });
  const signIn = await fetch(
    'http://' + authHost + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',
    { method: 'POST', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken:true }) });
  assert.equal(signIn.ok, true);
  const signedIn = await signIn.json();
  assert.equal(signedIn.localId, 'alice');
  assert.equal(typeof signedIn.idToken, 'string');
  await database.ref('roomsV2/room-a').set({
    access: { members: { alice: 'editor', bob: 'viewer' } },
    shared: { tasks: { existing: { title:'既存の共有タスク',revision:1 } } },
    personal: { alice: { todos: { todo1: {
      id:'todo1',ownerUid:'alice',text:'依頼',revision:1,completed:false
    } } } }
  });
  await database.ref('roomsV2/room-b').set({
    access: { members: { bob:'editor' } }, shared: { tasks:{ another:{title:'別室',revision:1} } }
  });
  // Synthetic Classic room only: proof that the audit never writes a target.
  const legacyRef=database.ref('rooms/test-v575-audit');
  await legacyRef.set({
    tasks:{taskA:{id:'taskA',title:'架空タスク',revision:1,
      assignee:'テスト利用者',history:[{text:'履歴'}],nextRecurringTaskId:'taskB'},
      taskB:{id:'taskB',title:'次回タスク',revision:1,recurringParentId:'taskA'}},
    todos:{todoA:{id:'todoA',owner:'テスト利用者',text:'確認',revision:2}},
    schedules:{scheduleA:{id:'scheduleA',relatedTaskId:'taskA',revision:1}},
    knowledge:{knowledgeA:{taskId:'taskA'}},
    workflowV152:{inbox:{testUser:{notificationA:{taskId:'taskA'}}}},
    meta:{users:['テスト利用者']}
  });
  const beforeAudit=(await legacyRef.once('value')).val();
  const auditResult=auditLegacyRoomForV574(beforeAudit);
  assert.equal(auditResult.result,'NO_GO');
  assert.equal(auditResult.relations.tasks.recurrenceLinks,2);
  assert.equal(auditResult.relations.schedules.taskLinks,1);
  assert.equal(auditResult.relations.workflow.inboxEvents,1);
  assert.equal(JSON.stringify(auditResult).includes('テスト利用者'),false);
  assert.deepEqual((await legacyRef.once('value')).val(),beforeAudit);
  const draft=evaluateLosslessSchemaV576(beforeAudit,{
    'テスト利用者':'alice','testUser':'bob'
  });
  assert.equal(draft.result,'NO_GO');
  assert.equal(draft.reason,'pending-production-design');
  assert.equal(draft.roundTripVerified,true);
  assert.equal(JSON.stringify(draft).includes('テスト利用者'),false);
  assert.deepEqual((await legacyRef.once('value')).val(),beforeAudit);
  assert.equal((await database.ref('roomsV2/test-v575-audit').once('value')).exists(),false);

  const request = { authorizationHeader:'Bearer '+signedIn.idToken,roomId:'room-a',
    intent: { todoId:'todo1',expectedRevision:1,requestId:'operationA',
      title:'Admin SDKの試験',description:'トランザクション' } };
  const first = await handleRoomTodoPromotionV572(request, service);
  assert.equal(first.status,'created','Admin RTDB transaction must commit');
  assert.match(first.taskId,/^task_[0-9a-f]{32}$/);
  assert.deepEqual(await handleRoomTodoPromotionV572(request,service),
    {status:'already-applied',taskId:first.taskId});
  const data = (await database.ref('roomsV2/room-a').once('value')).val();
  assert.equal(data.personal.alice.todos.todo1.revision,2);
  assert.equal(data.personal.alice.todos.todo1.completed,true);
  assert.equal(data.shared.tasks[first.taskId].revision,1);
  assert.equal(Object.keys(data.operations.promotions.alice).length,1);
  assert.equal(Object.keys(data.shared.tasks).length,2);

  // Ver.574: no HTTP port or route is deployed. Exercise the EXACT parsed
  // envelope against the actual Auth + Admin RTDB emulator adapters.
  await database.ref('roomsV2/room-a/personal/alice/todos/todo2').set({
    id:'todo2',ownerUid:'alice',text:'次の作業',revision:1,completed:false
  });
  const apiRequest = {
    method:'POST', path:PROMOTION_ROUTE_V574,
    headers:{
      authorization:'Bearer '+signedIn.idToken,
      'content-type':'application/json',
      'x-workboard-schema':PROMOTION_SCHEMA_V574
    },
    body:{schemaVersion:PROMOTION_SCHEMA_V574,roomId:'room-a',intent:{
      todoId:'todo2',expectedRevision:1,requestId:'apiOperationB',
      title:'API受付の試験',description:'検証用の新規タスク'
    }}
  };
  const apiCreated = await handlePromotionHttpV574(apiRequest, service);
  assert.equal(apiCreated.statusCode,201);
  assert.equal(apiCreated.body.status,'created');
  assert.equal(apiCreated.headers['cache-control'],'no-store');
  assert.equal(apiCreated.headers['access-control-allow-origin'],undefined);
  const apiReplay = await handlePromotionHttpV574(apiRequest, service);
  assert.deepEqual(apiReplay.body,{status:'already-applied',taskId:apiCreated.body.taskId});
  const oldClient = await handlePromotionHttpV574({...apiRequest,headers:{
    authorization:'Bearer '+signedIn.idToken,'content-type':'application/json'
  }},service);
  assert.equal(oldClient.body.status,'client-upgrade-required');
  assert.equal(oldClient.statusCode,409);
  const afterApi=(await database.ref('roomsV2/room-a').once('value')).val();
  assert.equal(Object.keys(afterApi.shared.tasks).length,3);
  assert.equal(Object.keys(afterApi.operations.promotions.alice).length,2);
  assert.equal(afterApi.personal.alice.todos.todo2.revision,2);
  assert.equal(afterApi.personal.alice.todos.todo2.completed,true);
  assert.equal((await handleRoomTodoPromotionV572({...request,roomId:'room-b'},service)).status,
    'forbidden');
  await database.ref('roomsV2/room-a/access/members/alice').remove();
  assert.equal((await handleRoomTodoPromotionV572(request,service)).status,'forbidden');
  await auth.updateUser('alice',{disabled:true});
  assert.equal((await handleRoomTodoPromotionV572(request,service)).status,'unauthenticated');
  const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  try { assert.throws(()=>createDemoAdminServiceV573(app), /接続条件/); }
  finally { process.env.FIREBASE_AUTH_EMULATOR_HOST=previous; }
  assert.throws(()=>createDemoAdminServiceV573({
    options:{projectId:'real-live-project',databaseURL:DEMO_DB_URL_V573}
  }),/接続条件/);
  console.log('VER573_ADMIN_AUTH_AND_RTDB_EMULATOR_PASSED: demo only');
  console.log('VER574_HTTP_COMPAT_AUTH_AND_REPLAY_PASSED: no HTTP deployment, demo only');
  console.log('VER575_LEGACY_READ_ONLY_AUDIT_PASSED: no migration destination was written');
  console.log('VER576_LOSSLESS_SCHEMA_DRY_RUN_PASSED: no destination writer');
} finally {
  await deleteApp(app);
}
