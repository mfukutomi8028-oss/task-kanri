import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRoomTodoPromotionV572 as handle, handleRoomTaskEditV578 as handleEdit } from '../security/room-promotion-request-v572.mjs';

const project = 'demo-task-kanri-v572';
const request = Object.freeze({
  authorizationHeader: 'Bearer valid-id-token-alice-12345',
  roomId: 'room-a',
  intent: { todoId: 'todo1', expectedRevision: 3, requestId: 'operationA', title: 'タスク化', description: '本文' }
});
function fixture() {
  return {
    access: { members: { alice: 'editor', bob: 'viewer', chief: 'admin' } },
    shared: { tasks: { existing: { title: '以前のタスク', revision: 1 } } },
    personal: { alice: { todos: { todo1: {
      id: 'todo1', ownerUid: 'alice', text: '提出', revision: 3, completed: false
    } } } },
    operations: { promotions: {} }
  };
}
function sandbox() {
  let room = fixture();
  let verifyCalls = 0, writeCount = 0, transactCalls = 0, nextId = 0;
  let loseAcknowledgement = false, throwBeforeWrite = false, tokenRevoked = false, wrongProject = false;
  const service = {
    expectedProjectId: project,
    async verifyIdToken(token, checkRevoked) {
      verifyCalls++;
      assert.equal(checkRevoked, true);
      if (tokenRevoked || !token.startsWith('valid-id-token-')) throw new Error('auth failure must not leak');
      const uid = token.replace('valid-id-token-', '').replace('-12345', '');
      return {
        uid,
        aud: wrongProject ? 'another-project' : project,
        iss: 'https://securetoken.google.com/' + project,
        role: 'admin' // intentionally malicious claim; room membership is authoritative
      };
    },
    makeTaskId: () => 'generatedTask' + (++nextId),
    now: () => 1761876000000,
    async transactRoom(roomId, updateRoom) {
      transactCalls++;
      assert.equal(roomId, 'room-a');
      if (throwBeforeWrite) throw new Error('upstream disconnected');
      const updated = updateRoom(structuredClone(room));
      if (updated === undefined) {
        return { committed: false, snapshot: { val: () => structuredClone(room) } };
      }
      room = structuredClone(updated);
      writeCount++;
      if (loseAcknowledgement) {
        loseAcknowledgement = false;
        throw new Error('ack lost AFTER server commit');
      }
      return { committed: true, snapshot: { val: () => structuredClone(room) } };
    }
  };
  return {
    service,
    state: () => structuredClone(room),
    stats: () => ({ verifyCalls, transactCalls, writeCount }),
    changeRoom: modifier => { modifier(room); },
    revokeToken: () => { tokenRevoked = true; },
    wrongProject: () => { wrongProject = true; },
    loseAck: () => { loseAcknowledgement = true; },
    failNetwork: () => { throwBeforeWrite = true; }
  };
}

test('Ver.572 validates a signed-token contract and commits only through the existing planner', async () => {
  const s = sandbox();
  const initial = s.state();
  const result = await handle(request, s.service);
  assert.equal(result.status, 'created');
  assert.equal(result.taskId, 'generatedTask1');
  assert.equal(s.state().shared.tasks.generatedTask1.revision, 1);
  assert.equal(s.state().personal.alice.todos.todo1.revision, 4);
  assert.equal(s.state().personal.alice.todos.todo1.completed, true);
  assert.equal(Object.keys(s.state().operations.promotions.alice).length, 1);
  assert.deepEqual(s.state().shared.tasks.existing, initial.shared.tasks.existing);
  assert.deepEqual(s.stats(), { verifyCalls: 1, transactCalls: 1, writeCount: 1 });
});

test('Ver.572 same operation ID returns already-applied without a second write', async () => {
  const s = sandbox();
  assert.equal((await handle(request, s.service)).status, 'created');
  const replay = await handle(request, s.service);
  assert.deepEqual(replay, { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
  assert.equal(Object.keys(s.state().shared.tasks).length, 2);
});

test('Ver.572 transport loss after a real commit is indeterminate; retry recovers original task', async () => {
  const s = sandbox();
  s.loseAck();
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  assert.equal(s.stats().writeCount, 1);
  assert.deepEqual(await handle(request, s.service), { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 network failure before any commit never returns a false success', async () => {
  const s = sandbox(); s.failNetwork();
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  assert.equal(s.stats().writeCount, 0);
});

test('Ver.572 refuses missing, expired and revoked tokens before a database call', async () => {
  const s = sandbox();
  assert.deepEqual(await handle({ ...request, authorizationHeader: '' }, s.service), { status: 'unauthenticated' });
  assert.deepEqual(await handle({ ...request, authorizationHeader: 'Bearer expired-id-token-12345' }, s.service), { status: 'unauthenticated' });
  s.revokeToken();
  assert.deepEqual(await handle(request, s.service), { status: 'unauthenticated' });
  assert.equal(s.stats().transactCalls, 0);
});

test('Ver.572 rejects a token with the wrong Firebase audience even if mocked verifier returns it', async () => {
  const s = sandbox(); s.wrongProject();
  assert.deepEqual(await handle(request, s.service), { status: 'unauthenticated' });
  assert.equal(s.stats().transactCalls, 0);
});

test('Ver.572 client-controlled role/UID/task ID and invalid room keys are rejected before auth', async () => {
  const s = sandbox();
  const invalid = [
    { ...request, uid: 'chief' },
    { ...request, role: 'admin' },
    { ...request, roomId: '../room-b' },
    { ...request, roomId: '__proto__' },
    { ...request, intent: { ...request.intent, ownerUid: 'bob' } },
    { ...request, intent: { ...request.intent, role: 'admin' } },
    { ...request, intent: { ...request.intent, generatedTaskId: 'existing' } },
    { ...request, intent: { ...request.intent, expectedRevision: 1.5 } },
    { ...request, intent: { ...request.intent, title: ' ' } }
  ];
  for (const bad of invalid) assert.equal((await handle(bad, s.service)).status, 'invalid-request');
  assert.equal(s.stats().verifyCalls, 0);
});

test('Ver.572 room membership is checked from current transactional state, never token claims', async () => {
  const s = sandbox();
  s.changeRoom(room => { room.access.members.alice = 'viewer'; });
  assert.equal((await handle(request, s.service)).status, 'forbidden');
  assert.equal(s.stats().writeCount, 0);
  s.changeRoom(room => { delete room.access.members.alice; });
  assert.equal((await handle(request, s.service)).status, 'forbidden');
  assert.equal(s.stats().writeCount, 0);
});

test('Ver.572 revoked membership blocks even an already-committed operation replay', async () => {
  const s = sandbox();
  assert.equal((await handle(request, s.service)).status, 'created');
  s.changeRoom(room => { delete room.access.members.alice; });
  assert.deepEqual(await handle(request, s.service), { status: 'forbidden' });
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 stale revisions, changed payload with same request ID and task ID collisions do not write', async () => {
  const s = sandbox();
  assert.equal((await handle({ ...request, intent: { ...request.intent, expectedRevision: 2 } }, s.service)).status, 'conflict');
  assert.equal((await handle(request, s.service)).status, 'created');
  assert.equal((await handle({ ...request, intent: { ...request.intent, title: '別のタスク' } }, s.service)).status, 'conflict');
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 concurrent same-ID submissions cannot create two tasks', async () => {
  const s = sandbox();
  const results = await Promise.all([handle(request, s.service), handle(request, s.service)]);
  assert.deepEqual(results.map(x => x.status).sort(), ['already-applied', 'created']);
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 different requests for the same old revision cannot both commit', async () => {
  const s = sandbox();
  const second = { ...request, intent: { ...request.intent, requestId: 'operationB' } };
  const responses = await Promise.all([handle(request, s.service), handle(second, s.service)]);
  assert.deepEqual(responses.map(x => x.status).sort(), ['conflict', 'created']);
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 malformed transaction results and unloaded/null rooms never claim success', async () => {
  const s = sandbox();
  s.service.transactRoom = async () => ({ committed: true, snapshot: { val: () => fixture() } });
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  s.service.transactRoom = async () => ({ committed: false, snapshot: { val: () => null } });
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  s.service.transactRoom = async () => null;
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
});

test('Ver.572 server adapter refuses unsafe configuration and does not delegate credentials to the browser', async () => {
  const s = sandbox();
  await assert.rejects(handle(request, { ...s.service, verifyIdToken: undefined }), TypeError);
  await assert.rejects(handle(request, { ...s.service, expectedProjectId: '../other' }), TypeError);
  s.service.makeTaskId = () => '../forged';
  assert.deepEqual(await handle(request, s.service), { status: 'unavailable' });
  assert.equal(s.stats().transactCalls, 0);
});


test('Ver.573 accepts SDK TransactionResult class instances and fails closed on bad getters', async () => {
  const s = sandbox();
  const original = s.service.transactRoom;
  class TransactionResult {
    constructor(result) {
      this.committed = result.committed;
      this.snapshot = result.snapshot;
    }
  }
  s.service.transactRoom = async (...args) => new TransactionResult(await original(...args));
  assert.deepEqual(await handle(request, s.service), { status: 'created', taskId: 'generatedTask1' });
  assert.deepEqual(await handle(request, s.service), { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
  s.service.transactRoom = async () => Object.defineProperty({}, 'committed', {
    get() { throw Error('bad-getter'); }
  });
  assert.deepEqual(await handle(request, s.service),
    { status: 'indeterminate', retrySameRequestId: true });
});


// Ver.578 reuses the SAME mock Admin transaction adapter as Ver.572,
// and exercises a different business command. No duplicate writer/sandbox.
function editFixture() {
  const s=sandbox();
  const task={
    id:'existing',title:'旧業務',description:'元の内容',revision:0,
    assignee:'担当A',createdBy:'担当B',createdAt:1761000000000,
    history:[{text:'過去の履歴'}],comments:[{text:'過去の返信'}],
    checklist:[{label:'検査',done:false}],recurrenceRule:{weeks:2},
    unexpectedField:{preserve:'必須'}
  };
  s.changeRoom(room=>{room.shared.tasks.existing=structuredClone(task);});
  return {s,task};
}
const editRequest=()=>({
  authorizationHeader:'Bearer valid-id-token-alice-12345',roomId:'room-a',
  intent:{taskKey:'existing',expectedRevision:0,requestId:'editOperationA',
    title:'新版の業務',description:'更新後の本文'}
});
test('Ver.578 reuses verified Auth + atomic room transaction, preserves original unknown fields',async()=>{
  const {s,task}=editFixture(),baseline=s.state();
  const first=await handleEdit(editRequest(),s.service);
  assert.deepEqual(first,{status:'updated',taskKey:'existing',revision:1});
  const now=s.state();
  assert.equal(now.shared.tasks.existing.title,'新版の業務');
  assert.equal(now.shared.tasks.existing.description,'更新後の本文');
  assert.equal(now.shared.tasks.existing.revision,1);
  assert.deepEqual(now.shared.tasks.existing.history,task.history);
  assert.deepEqual(now.shared.tasks.existing.comments,task.comments);
  assert.deepEqual(now.shared.tasks.existing.checklist,task.checklist);
  assert.deepEqual(now.shared.tasks.existing.unexpectedField,task.unexpectedField);
  assert.deepEqual(now.shared.tasks.existing.recurrenceRule,task.recurrenceRule);
  assert.deepEqual(now.personal,baseline.personal);
  const marker=now.operations.taskEdits.alice.editOperationA;
  assert.equal(marker.taskKey,'existing');
  assert.equal(marker.revision,1);
  assert.equal(marker.authorUid,'alice');
  assert.equal(marker.digest.length,64);
  assert.equal(marker.title,undefined);
  assert.equal(marker.description,undefined);
  assert.equal(JSON.stringify(marker).includes('元の内容'),false);
  assert.deepEqual(s.stats(),{verifyCalls:1,transactCalls:1,writeCount:1});
});
test('Ver.578 replay and lost acknowledgement never create a duplicate update',async()=>{
  const {s}=editFixture();
  s.loseAck();
  assert.deepEqual(await handleEdit(editRequest(),s.service),{
    status:'indeterminate',retrySameRequestId:true
  });
  assert.equal(s.stats().writeCount,1);
  assert.deepEqual(await handleEdit(editRequest(),s.service),{
    status:'already-applied',taskKey:'existing',revision:1
  });
  assert.equal(s.stats().writeCount,1);
  assert.equal(Object.keys(s.state().operations.taskEdits.alice).length,1);
  assert.deepEqual(await handleEdit({...editRequest(),intent:{
    ...editRequest().intent,title:'同じIDで別の変更'
  }},s.service),{status:'conflict'});
  assert.equal(s.stats().writeCount,1);
});
test('Ver.578 rejects stale versions and conflicting concurrent edits',async()=>{
  const {s}=editFixture();
  const base=editRequest();
  assert.deepEqual(await handleEdit({...base,intent:{
    ...base.intent,expectedRevision:2
  }},s.service),{status:'conflict'});
  const second={...base,intent:{...base.intent,requestId:'editOperationB',
    title:'別ユーザー端末'}};
  const concurrent=await Promise.all([handleEdit(base,s.service),handleEdit(second,s.service)]);
  assert.deepEqual(concurrent.map(x=>x.status).sort(),['conflict','updated']);
  assert.equal(s.stats().writeCount,1);
  assert.equal(s.state().shared.tasks.existing.revision,1);
});
test('Ver.578 membership revocation, viewer downgrade and disabled Auth prevent edits/replay',async()=>{
  const {s}=editFixture();
  s.changeRoom(room=>{room.access.members.alice='viewer';});
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'forbidden'});
  s.changeRoom(room=>{room.access.members.alice='editor';});
  assert.equal((await handleEdit(editRequest(),s.service)).status,'updated');
  s.changeRoom(room=>{delete room.access.members.alice;});
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'forbidden'});
  s.revokeToken();
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'unauthenticated'});
  assert.equal(s.stats().writeCount,1);
});
test('Ver.578 rejects forged identity, unauthorized fields, unsafe room keys before database use',async()=>{
  const {s}=editFixture(),base=editRequest();
  const forged=[
    {...base,uid:'alice'}, {...base,role:'admin'},
    {...base,roomId:'../room-b'},
    {...base,intent:{...base.intent,role:'admin'}},
    {...base,intent:{...base.intent,authorUid:'chief'}},
    {...base,intent:{...base.intent,history:[]}},
    {...base,intent:{...base.intent,updatedAt:999}},
    {...base,intent:{...base.intent,expectedRevision:-1}},
    {...base,intent:{...base.intent,requestId:'../other'}},
    {...base,intent:{...base.intent,description:{field:'invalid'}}},
    {...base,intent:{...base.intent,title:' '}}
  ];
  for(const request of forged)
    assert.deepEqual(await handleEdit(request,s.service),{status:'invalid-request'});
  assert.deepEqual(s.stats(),{verifyCalls:0,transactCalls:0,writeCount:0});
});
test('Ver.578 permits legacy 768-byte keys, revision zero and preserves unknown root data',async()=>{
  const {s}=editFixture(),long='task'+('X'.repeat(260));
  s.changeRoom(room=>{
    room.shared.tasks[long]={id:long,title:'ロングIDの業務',revision:0,
      history:[],comments:[],unknownPayload:{a:'必ず保持'}};
    room.meta={unrelated:'keep'};
  });
  const req={...editRequest(),intent:{...editRequest().intent,
    taskKey:long,requestId:'editLong',title:'修正'}};
  assert.deepEqual(await handleEdit(req,s.service),{
    status:'updated',taskKey:long,revision:1
  });
  assert.deepEqual(s.state().shared.tasks[long].unknownPayload,{a:'必ず保持'});
  assert.deepEqual(s.state().meta,{unrelated:'keep'});
  const tooLong='あ'.repeat(300);
  assert.deepEqual(await handleEdit({...req,intent:{...req.intent,taskKey:tooLong}},s.service),
    {status:'invalid-request'});
});
test('Ver.578 invalid legacy activity shape, absent task, no-op, and indeterminate adapter cannot claim success',async()=>{
  const {s}=editFixture();
  s.changeRoom(room=>{room.shared.tasks.existing.history='legacy-string';});
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'conflict'});
  s.changeRoom(room=>{room.shared.tasks.existing.history=[];});
  assert.deepEqual(await handleEdit({...editRequest(),intent:{
    ...editRequest().intent,taskKey:'nonexistent'
  }},s.service),{status:'conflict'});
  assert.deepEqual(await handleEdit({...editRequest(),intent:{
    ...editRequest().intent,title:'旧業務',description:'元の内容'
  }},s.service),{status:'conflict'});
  s.service.transactRoom=async()=>({committed:true,snapshot:{val:()=>fixture()}});
  assert.deepEqual(await handleEdit(editRequest(),s.service),{
    status:'indeterminate',retrySameRequestId:true
  });
  s.service.transactRoom=async()=>({committed:true,snapshot:{
    val(){throw Error('sensitive-exception');}
  }});
  assert.deepEqual(await handleEdit(editRequest(),s.service),{
    status:'indeterminate',retrySameRequestId:true
  });
  s.service.transactRoom=async()=>null;
  assert.deepEqual(await handleEdit(editRequest(),s.service),{
    status:'indeterminate',retrySameRequestId:true
  });
});
test('Ver.578 uses same project-bound revoked-token verifier as existing promotion',async()=>{
  const {s}=editFixture();
  s.wrongProject();
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'unauthenticated'});
  assert.deepEqual(s.stats(),{verifyCalls:1,transactCalls:0,writeCount:0});
  await assert.rejects(handleEdit(editRequest(),{...s.service,transactRoom:undefined}),TypeError);
  s.service.now=()=>0;
  assert.deepEqual(await handleEdit(editRequest(),s.service),{status:'unavailable'});
  assert.equal(s.stats().transactCalls,0);
});
