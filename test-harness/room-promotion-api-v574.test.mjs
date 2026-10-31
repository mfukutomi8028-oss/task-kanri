import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePromotionHttpV574 as handle, planPromotionRecoveryV574 as recover,
  PROMOTION_ROUTE_V574 as route, PROMOTION_SCHEMA_V574 as schema } from '../security/room-promotion-api-v574.mjs';
import { auditLegacyRoomForV574 as audit } from '../security/legacy-room-schema-audit-v574.mjs';

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
