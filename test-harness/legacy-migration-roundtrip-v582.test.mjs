import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  evaluateLosslessSchemaV576, prepareSyntheticLosslessDraftV582,
  verifySyntheticPersistedRoundTripV582
} from '../security/classic-lossless-schema-v576.mjs';
import {
  syntheticRoomV582, syntheticUidMapV582, syntheticEmulatorOptionsV582
} from './synthetic-room-v582.mjs';

const source=()=>syntheticRoomV582();
const uid=()=>syntheticUidMapV582();
const opts=()=>syntheticEmulatorOptionsV582();
const withDemo=callback=>{
  const before=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  process.env.FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9001';
  try{return callback();}finally{
    if(before===undefined)delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    else process.env.FIREBASE_DATABASE_EMULATOR_HOST=before;
  }
};
const noData=report=>{
  const serialized=JSON.stringify(report);
  for(const forbidden of ['職員A','職員B','架空の月次点検','架空の業務メモ',
    'uidA','uidB','todoA','taskA']){
    assert.equal(serialized.includes(forbidden),false);
  }
};

test('Ver.582 requires exact demo Emulator + synthetic marker, never production endpoints',()=>{
  const check=prepareSyntheticLosslessDraftV582(source(),uid(),opts());
  assert.equal(check.report.result,'NO_GO');
  assert.equal(check.draft,undefined);
  assert.equal(check.report.reason,'synthetic-emulator-only');
  assert.equal(withDemo(()=>prepareSyntheticLosslessDraftV582(source(),uid(),{
    ...opts(),projectId:'real-production'
  })).draft,undefined);
  assert.equal(withDemo(()=>prepareSyntheticLosslessDraftV582(source(),uid(),{
    ...opts(),targetRoomId:'real-room'
  })).draft,undefined);
  const f=source();delete f.meta.migrationFixture;
  assert.equal(withDemo(()=>prepareSyntheticLosslessDraftV582(f,uid(),opts())).draft,undefined);
});

test('Ver.582 existing Ver.576 assessor remains metadata-only and unchanged NO_GO',()=>{
  const data=source(),before=structuredClone(data);
  const report=evaluateLosslessSchemaV576(data,uid());
  assert.equal(report.reason,'pending-production-design');
  assert.equal(report.roundTripVerified,true);
  assert.equal(report.result,'NO_GO');
  assert.equal(report.draftDeployable,false);
  assert.deepEqual(data,before);
  assert.equal(report.counts.tasks,2);
  assert.equal(report.counts.todos,2);
  assert.equal(report.counts.schedules,1);
  assert.equal(report.counts.businessMemos,2);
  noData(report);
});

test('Ver.582 synthetic projection preserves fields and verifies unchanged source',()=>{
  withDemo(()=>{
    const original=source(),unchanged=structuredClone(original);
    const prepared=prepareSyntheticLosslessDraftV582(original,uid(),opts());
    assert.equal(prepared.report.reason,'emulator-projection-only');
    assert.ok(prepared.draft);
    assert.equal(prepared.draft.shared.tasks.taskA.futureField.nested.preserve,'そのまま');
    assert.equal(prepared.draft.shared.schedules.scheduleA.recurrence.until,'2027-01-25');
    assert.equal(prepared.draft.shared.businessMemos.memoA.paperColor,'#f7c9d7');
    assert.equal(prepared.draft.personal.uidA.todos.todoA.revision,0);
    assert.equal(prepared.draft.personal.uidB.todos.todoB.completed,true);
    assert.equal(prepared.draft.personal.uidB.inbox.eventB.taskId,'taskB');
    assert.equal(prepared.draft.internal.workflowV148Rest.otherSettings.custom,'残す設定');
    assert.deepEqual(original,unchanged);
    const verified=verifySyntheticPersistedRoundTripV582(
      original,uid(),structuredClone(prepared.draft),unchanged,opts());
    assert.equal(verified.result,'NO_GO');
    assert.equal(verified.reason,'emulator-persistence-verified');
    assert.equal(verified.persistedRoundTripVerified,true);
    assert.equal(verified.draftDeployable,false);
    noData(verified);
  });
});

test('Ver.582 rejects empty maps, empty arrays, nulls and integer-only maps before persistence',()=>{
  withDemo(()=>{
    for(const change of [
      room=>{room.workflowV152.inbox['職員B']={};},
      room=>{room.tasks.taskA.unknownField=null;},
      room=>{room.tasks.taskA.unknownField=[];},
      room=>{room.tasks.taskA.unknownField={'0':'numeric-key'};}
    ]){
      const original=source();change(original);
      const checked=prepareSyntheticLosslessDraftV582(original,uid(),opts());
      assert.equal(checked.report.result,'NO_GO');
      assert.equal(checked.report.reason,'unsafe-rtdb-empty-or-null-values');
      assert.ok(checked.report.persistenceHazards>=1);
      assert.equal(checked.draft,undefined);
      noData(checked.report);
    }
  });
});

test('Ver.582 detects target corruption and concurrent source update without exposing records',()=>{
  withDemo(()=>{
    const original=source(),map=uid(),options=opts();
    const draft=prepareSyntheticLosslessDraftV582(original,map,options).draft;
    const changedTarget=structuredClone(draft);
    changedTarget.shared.businessMemos.memoA.body='altered';
    const wrong=verifySyntheticPersistedRoundTripV582(original,map,
      changedTarget,original,options);
    assert.equal(wrong.reason,'persisted-draft-mismatch');
    assert.equal(wrong.persistedRoundTripVerified,false);
    const changedSource=structuredClone(original);
    changedSource.todos.todoA.revision++;
    const changed=verifySyntheticPersistedRoundTripV582(original,map,
      draft,changedSource,options);
    assert.equal(changed.reason,'source-changed-during-staging');
    assert.equal(changed.persistedRoundTripVerified,false);
    noData(wrong);noData(changed);
  });
});

test('Ver.582 refuses identity-map collisions, unknown root and missing owners',()=>{
  withDemo(()=>{
    for(const [room,mapping] of [
      [source(),{'職員A':'uidA'}],
      [source(),{'職員A':'same','職員B':'same'}],
      [{...source(),unlistedCollection:{private:'no'}},uid()]
    ]){
      const prepared=prepareSyntheticLosslessDraftV582(room,mapping,opts());
      assert.equal(prepared.report.result,'NO_GO');
      assert.equal(prepared.draft,undefined);
      assert.equal(prepared.report.roundTripVerified,false);
      noData(prepared.report);
    }
  });
});

test('Ver.582 does not deploy, touch live app or release manifest',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  const script=read('test-harness/migration-roundtrip-v582-emulator.mjs');
  const packageJson=JSON.parse(read('package.json'));
  const workflow=read('.github/workflows/regression-checks.yml');
  assert.match(packageJson.scripts['test:migration:v582'],/firebase emulators:exec --only database/);
  assert.match(workflow,/npm run test:migration:v582/);
  assert.match(script,/LOCAL demo RTDB Emulator/);
  assert.doesNotMatch(script,/firebase deploy|real-production|process\.env\.GOOGLE_APPLICATION_CREDENTIALS/);
  assert.doesNotMatch(read('release-manifest.js'),/migration-roundtrip-v582/);
  assert.doesNotMatch(read('app.js'),/prepareSyntheticLosslessDraftV582/);
});
