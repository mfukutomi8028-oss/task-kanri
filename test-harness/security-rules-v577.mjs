// Ver.577: isolated read-only candidate Rules exercise, never a production deployment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment }
  from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';

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
          internal:{meta:{users:['職員A','職員B']},workflowV152Rest:{archives:{x:{at:1}}}},
          operations:{promotions:{alice:{oldRequest:{taskId:'taskA'}}}}
        },
        roomB:{access:{members:{bob:'editor'}},shared:{tasks:{secret:{title:'別室',revision:0}}}}
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
      'shared/tasks/taskA/revision':1,'personal/alice/todos/'+oldTodoId+'/revision':1
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
  console.log('VER577_READ_SCOPES_AND_SERVER_ONLY_WRITES_PASSED: demo emulator only');
}finally{
  await env.cleanup();
}
