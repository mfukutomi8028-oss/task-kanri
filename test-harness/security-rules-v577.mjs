// Ver.577: isolated read-only candidate Rules exercise, never a production deployment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment }
  from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';
import { prepareSyntheticLosslessDraftV582 } from '../security/classic-lossless-schema-v576.mjs';
import { syntheticRoomV582, syntheticUidMapV582 } from './synthetic-room-v582.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rules=fs.readFileSync(path.join(root,'security/database.rules.v577.candidate.json'),'utf8');
const env=await initializeTestEnvironment({
  projectId:'demo-task-kanri-v577',
  database:{host:'127.0.0.1',port:9001,rules}
});
const at=(ctx,p)=>ref(ctx.database(),p);
try {
  // Privileged setup proves legacy rev=0 and all unknown historical fields
  // survive inside Emulator. This is NOT a client permission.
  const oldTodoId='todo_'+('a'.repeat(180));
  await env.withSecurityRulesDisabled(async admin=>{
    await set(at(admin,'/'),{
      roomsV2:{
        roomA:{
          access:{members:{alice:'editor',bob:'viewer',chief:'admin',retired:'removed'}},
          shared:{
            tasks:{taskA:{id:'taskA',title:'業務',revision:0,assignee:'職員A',
              history:[{text:'旧履歴'}],comments:[{body:'内容'}],custom:{legacy:true}}},
            schedules:{s1:{id:'s1',relatedTaskId:'taskA',revision:0}},
            knowledge:{k1:{taskId:'taskA',text:'資料'}},
            businessMemos:{m1:{body:'共有メモ',createdBy:'職員A'}},
            taskStarts:{taskA:{at:1761880000000}}
          },
          personal:{
            alice:{
              todos:{[oldTodoId]:{id:oldTodoId,owner:'職員A',text:'旧ToDo',revision:0}},
              inbox:{eventA:{title:'個人通知',taskId:'taskA'}},
              reminders:{taskA:{notifyAt:1761880000000}}
            },
            bob:{todos:{todoB:{id:'todoB',owner:'職員B',text:'本人',revision:0}}}
          },
          internal:{meta:{users:['職員A','職員B']},workflowV152Rest:{archives:{x:{at:1}}},identities:{alice:{approved:true},bob:{approved:true},chief:{approved:true}}},
          operations:{promotions:{alice:{oldRequest:{taskId:'taskA'}}}}
        },
        roomB:{access:{members:{bob:'editor'}},internal:{identities:{bob:{approved:true}}},shared:{tasks:{secret:{title:'別室',revision:0}}}}
      }
    });
  });
  const anon=env.unauthenticatedContext();
  const alice=env.authenticatedContext('alice');
  const bob=env.authenticatedContext('bob');
  const chief=env.authenticatedContext('chief');
  const outsider=env.authenticatedContext('charlie');
  const retired=env.authenticatedContext('retired');
  const prefix='roomsV2/roomA/';
  const shared=['tasks','schedules','knowledge','businessMemos','taskStarts'];
  for(const key of shared){
    for(const user of [alice,bob,chief])
      await assertSucceeds(get(at(user,prefix+'shared/'+key)));
    for(const user of [anon,outsider,retired])
      await assertFails(get(at(user,prefix+'shared/'+key)));
  }
  const task=await assertSucceeds(get(at(bob,prefix+'shared/tasks/taskA')));
  assert.equal(task.val().revision,0);
  assert.equal(task.val().custom.legacy,true);
  assert.equal(task.val().history[0].text,'旧履歴');
  const oldTodo=await assertSucceeds(get(at(alice,prefix+'personal/alice/todos/'+oldTodoId)));
  assert.equal(oldTodo.val().revision,0);
  assert.equal(oldTodo.val().id,oldTodoId);
  for(const key of ['todos','inbox','reminders']){
    await assertSucceeds(get(at(alice,prefix+'personal/alice/'+key)));
    for(const user of [anon,bob,chief,outsider,retired])
      await assertFails(get(at(user,prefix+'personal/alice/'+key)));
  }
  await assertSucceeds(get(at(bob,prefix+'personal/bob/todos')));
  await assertFails(get(at(alice,prefix+'personal/bob/todos')));
  await assertSucceeds(get(at(alice,prefix+'access/members/alice')));
  await assertFails(get(at(bob,prefix+'access/members/alice')));
  await assertFails(get(at(retired,prefix+'access/members/retired')));

  // Never grant access at a parent: RTDB grants cascade; child deny
  // cannot hide internal/private data once a parent is readable.
  for(const location of [
    'rooms','rooms/roomA','roomsV2','roomsV2/roomA',
    prefix+'shared',prefix+'personal',prefix+'personal/alice',
    prefix+'access',prefix+'access/members',prefix+'internal',
    prefix+'internal/meta',prefix+'operations',prefix+'operations/promotions'
  ])for(const user of [anon,alice,bob,chief,outsider]){
    await assertFails(get(at(user,location)));
  }
  await assertFails(get(at(alice,'roomsV2/roomB/shared/tasks')));
  await assertSucceeds(get(at(bob,'roomsV2/roomB/shared/tasks')));

  // Even editors/admins cannot mutate migrated legacy records in the
  // browser: only a *future audited Admin API* may implement writes.
  for(const user of [anon,alice,bob,chief,outsider]){
    await assertFails(set(at(user,prefix+'shared/tasks/taskA'),
      {id:'taskA',title:'上書き',revision:1,history:[]}));
    await assertFails(set(at(user,prefix+'shared/tasks/newTask'),
      {title:'クライアント新規',revision:1}));
    await assertFails(set(at(user,prefix+'shared/tasks/taskA'),null));
    await assertFails(set(at(user,prefix+'personal/alice/todos/'+oldTodoId),
      {id:oldTodoId,owner:'職員A',text:'偽造',revision:1}));
    await assertFails(set(at(user,prefix+'personal/alice/inbox/eventA'),null));
    await assertFails(set(at(user,prefix+'internal/meta'),{users:['攻撃']}));
    await assertFails(set(at(user,prefix+'access/members/alice'),'admin'));
    await assertFails(set(at(user,prefix+'operations/promotions/alice/forged'),{taskId:'fake'}));
    await assertFails(update(at(user,'roomsV2/roomA'),{
      'shared/tasks/taskA/revision':1,['personal/alice/todos/'+oldTodoId+'/revision']:1
    }));
  }
  // Only after privileged removal, Rules re-evaluate fresh reads on server.
  await env.withSecurityRulesDisabled(async admin=>{
    await set(at(admin,prefix+'access/members/alice'),null);
  });
  await assertFails(get(at(alice,prefix+'shared/tasks')));
  await assertFails(get(at(alice,prefix+'personal/alice/todos')));
  await assertFails(get(at(alice,prefix+'access/members/alice')));
  await assertSucceeds(get(at(bob,prefix+'shared/tasks')));

  // Ver.583: re-use the actual Ver.582 lossless projection and the Ver.577
  // candidate Rules rather than reimplementing the permission logic.
  // This scenario adds only essential checks to the existing Emulator run.
  const demoOptions={projectId:'demo-task-kanri-v577',targetRoomId:'demo-v582-target'};
  const prepared=prepareSyntheticLosslessDraftV582(
    syntheticRoomV582(),syntheticUidMapV582(),demoOptions);
  assert.equal(prepared.report.result,'NO_GO');
  assert.equal(prepared.report.reason,'emulator-projection-only');
  assert.ok(prepared.draft,'synthetic migrated projection must exist');
  const candidateRoom={
    ...prepared.draft,
    access:{members:{uidA:'editor',uidB:'viewer'}},
    internal:{
      ...prepared.draft.internal,
      identities:{uidA:{approved:true},uidB:{approved:true}}
    }
  };
  const migrated='roomsV2/demo-v582-target/';
  await env.withSecurityRulesDisabled(async admin=>{
    await set(at(admin,migrated.slice(0,-1)),candidateRoom);
  });
  const uidA=env.authenticatedContext('uidA');
  const uidB=env.authenticatedContext('uidB');
  const migratedTodoA=await assertSucceeds(
    get(at(uidA,migrated+'personal/uidA/todos/todoA')));
  assert.equal(migratedTodoA.val().text,'架空のToDo A');
  await assertSucceeds(get(at(uidB,migrated+'personal/uidB/todos/todoB')));
  await assertFails(get(at(uidB,migrated+'personal/uidA/todos')));
  await assertFails(get(at(uidA,migrated+'personal/uidB/todos')));
  await assertSucceeds(get(at(uidB,migrated+'shared/tasks')));
  await assertFails(set(at(uidB,migrated+'shared/tasks/taskA'),
    {title:'閲覧者による改変',revision:2}));

  // An approval revoke alone must disable RTDB reads even while membership
  // and the Firebase Auth token remain valid. Never rely on UI-only logout.
  await env.withSecurityRulesDisabled(async admin=>{
    await set(at(admin,migrated+'internal/identities/uidA/approved'),false);
  });
  await assertFails(get(at(uidA,migrated+'personal/uidA/todos')));
  await assertFails(get(at(uidA,migrated+'shared/tasks')));
  await assertFails(get(at(uidA,migrated+'access/members/uidA')));
  await assertSucceeds(get(at(uidB,migrated+'shared/tasks')));
  await env.withSecurityRulesDisabled(async admin=>{
    await set(at(admin,migrated+'access/members/uidB'),null);
  });
  await assertFails(get(at(uidB,migrated+'personal/uidB/todos')));
  await assertFails(get(at(uidB,migrated+'shared/tasks')));
  console.log('VER583_SYNTHETIC_UID_APPROVAL_AND_PERSONAL_SCOPE_PASSED: demo only');
  console.log('VER577_READ_SCOPES_AND_SERVER_ONLY_WRITES_PASSED: demo emulator only');
}finally{
  await env.cleanup();
}
