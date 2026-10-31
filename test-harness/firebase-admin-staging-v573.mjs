// Ver.573: real Admin Auth+RTDB SDK against two local Emulators only.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { handleRoomTodoPromotionV572 } from '../security/room-promotion-request-v572.mjs';
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
} finally {
  await deleteApp(app);
}
