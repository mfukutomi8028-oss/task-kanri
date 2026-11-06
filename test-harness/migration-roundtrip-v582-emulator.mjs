// Ver.582: Synthetic-only persistence/rollback checks, exclusively on
// localhost RTDB Emulator. NEVER connect to or modify a production project.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { DEMO_PROJECT_V573, DEMO_DB_URL_V573 } from '../security/firebase-admin-staging-v573.mjs';
import {
  evaluateLosslessSchemaV576, prepareSyntheticLosslessDraftV582,
  verifySyntheticPersistedRoundTripV582
} from '../security/classic-lossless-schema-v576.mjs';
import {
  syntheticRoomV582, syntheticUidMapV582, syntheticEmulatorOptionsV582
} from './synthetic-room-v582.mjs';

const options=syntheticEmulatorOptionsV582();
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9001'
  || DEMO_PROJECT_V573!==options.projectId
  || !DEMO_PROJECT_V573.startsWith('demo-'))
  throw Error('LOCAL demo RTDB Emulator is required; production access refused');

const app=initializeApp({projectId:DEMO_PROJECT_V573,databaseURL:DEMO_DB_URL_V573},
  'v582-migration-isolated');
const db=getDatabase(app);
const sourceRef=db.ref('rooms/demo-v582-legacy');
const stageRef=db.ref('roomsV2/demo-v582-target');
const identity=syntheticUidMapV582();

function noPrivateFields(report){
  const text=JSON.stringify(report);
  for(const privateValue of ['職員A','職員B','架空の月次点検',
    '架空の業務メモ','uidA','uidB','todoA','taskA']){
    assert.equal(text.includes(privateValue),false,'diagnostic output must not contain records');
  }
}
try {
  // Both paths are fixed, demo-prefixed and inside this isolated instance.
  await sourceRef.set(syntheticRoomV582());
  const baseline=(await sourceRef.get()).val();
  assert.equal(baseline.meta.migrationFixture,'v582-synthetic');
  const before=structuredClone(baseline);
  const original=evaluateLosslessSchemaV576(baseline,identity);
  assert.equal(original.result,'NO_GO');
  assert.equal(original.roundTripVerified,true);
  noPrivateFields(original);

  const prepared=prepareSyntheticLosslessDraftV582(baseline,identity,options);
  assert.equal(prepared.report.result,'NO_GO');
  assert.equal(prepared.report.reason,'emulator-projection-only');
  assert.ok(prepared.draft);
  noPrivateFields(prepared.report);

  // Verify real projection paths without modifying input Classic records.
  assert.equal(prepared.draft.shared.tasks.taskA.title,baseline.tasks.taskA.title);
  assert.equal(prepared.draft.shared.schedules.scheduleA.relatedTaskId,'taskA');
  assert.equal(prepared.draft.shared.businessMemos.memoA.paperColor,'#f7c9d7');
  assert.equal(prepared.draft.personal.uidA.todos.todoA.memo,baseline.todos.todoA.memo);
  assert.equal(prepared.draft.personal.uidB.todos.todoB.owner,baseline.todos.todoB.owner);
  assert.equal(prepared.draft.personal.uidA.inbox.eventA.taskId,'taskA');
  assert.equal(prepared.draft.personal.uidB.reminders.taskB.notifyAt,1761000300);
  assert.equal(prepared.draft.internal.workflowV152Rest.futureExtension.retain,'unknown-field');

  // Stage into a disposable dummy node, inspect persisted bytes/structure,
  // and test rollback to a PREVIOUSLY EXISTING target value.
  const prior={marker:'preexisting-synthetic-target',revision:3};
  await stageRef.set(prior);
  const priorPersisted=(await stageRef.get()).val();
  assert.deepEqual(priorPersisted,prior);
  try {
    await stageRef.set(prepared.draft);
    const staged=(await stageRef.get()).val();
    const unchanged=(await sourceRef.get()).val();
    const verified=verifySyntheticPersistedRoundTripV582(
      baseline,identity,staged,unchanged,options);
    assert.equal(verified.result,'NO_GO');
    assert.equal(verified.reason,'emulator-persistence-verified');
    assert.equal(verified.roundTripVerified,true);
    assert.equal(verified.persistedRoundTripVerified,true);
    assert.equal(verified.draftDeployable,false);
    noPrivateFields(verified);
    assert.deepEqual(unchanged,before,'legacy source must remain untouched');

    await stageRef.child('shared/businessMemos/memoA/paperColor').set('#000000');
    const corrupted=(await stageRef.get()).val();
    const mismatched=verifySyntheticPersistedRoundTripV582(
      baseline,identity,corrupted,unchanged,options);
    assert.equal(mismatched.result,'NO_GO');
    assert.equal(mismatched.reason,'persisted-draft-mismatch');
    assert.equal(mismatched.persistedRoundTripVerified,false);
    noPrivateFields(mismatched);

    // Simulate a concurrent source write: reject even a valid target snapshot.
    await sourceRef.child('tasks/taskA/status').set('別の端末が編集');
    const changedSource=(await sourceRef.get()).val();
    const concurrent=verifySyntheticPersistedRoundTripV582(
      baseline,identity,staged,changedSource,options);
    assert.equal(concurrent.reason,'source-changed-during-staging');
    assert.equal(concurrent.persistedRoundTripVerified,false);
    noPrivateFields(concurrent);
    await sourceRef.set(before);
  } finally {
    // Roll back only the isolated candidate; restore previous dummy content.
    await stageRef.set(priorPersisted);
  }
  assert.deepEqual((await stageRef.get()).val(),prior);
  assert.deepEqual((await sourceRef.get()).val(),before);
  console.log('VER582_SYNTHETIC_PERSISTED_ROUNDTRIP_ROLLBACK_PASSED: localhost only');
} finally {
  try { await stageRef.remove(); } finally { await sourceRef.remove(); }
  await deleteApp(app);
}
