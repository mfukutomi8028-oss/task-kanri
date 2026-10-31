// Ver.568–569: isolated future-schema Auth/Rules proof. Never connects to live Firebase.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, update, runTransaction } from 'firebase/database';
import assert from 'node:assert/strict';
import { planRoomTodoPromotionV570 } from '../security/room-atomic-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = fs.readFileSync(path.join(root, 'security/database.rules.v568.candidate.json'), 'utf8');
const env = await initializeTestEnvironment({
  projectId: 'demo-task-kanri-v568',
  database: { host: '127.0.0.1', port: 9001, rules }
});
const dbRef = (ctx, location) => ref(ctx.database(), location);

try {
  // Test fixtures are written only with emulator rules disabled.
  await env.withSecurityRulesDisabled(async admin => {
    await set(dbRef(admin, '/'), {
      roomsV2: {
        'room-a': {
          access: { members: { alice: 'editor', bob: 'viewer', chief: 'admin' } },
          shared: { tasks: { task1: { title: '共有業務', revision: 1 } } },
          personal: {
            alice: {
              todos: { todo1: { id: 'todo1', ownerUid: 'alice', text: '提出', revision: 3, completed: false } },
              inbox: { event1: { body: '連絡' } }
            },
            bob: { todos: { todo2: { id: 'todo2', ownerUid: 'bob', text: '閲覧', revision: 4, completed: false } } }
          }
        },
        'room-b': {
          access: { members: { bob: 'editor' } },
          shared: { tasks: { task2: { title: '別ルーム', revision: 1 } } }
        }
      }
    });
  });

  const anonymous = env.unauthenticatedContext();
  const alice = env.authenticatedContext('alice');
  const bob = env.authenticatedContext('bob');
  const outsider = env.authenticatedContext('charlie');
  const chief = env.authenticatedContext('chief');

  // Neither a known room ID nor an authenticated but unrelated UID grants access.
  await assertFails(get(dbRef(anonymous, 'roomsV2/room-a/shared/tasks')));
  await assertFails(set(dbRef(anonymous, 'roomsV2/room-a/shared/tasks/new'), { title: '侵入', revision: 1 }));
  await assertFails(get(dbRef(outsider, 'roomsV2/room-a/shared/tasks')));
  await assertFails(set(dbRef(outsider, 'roomsV2/room-a/shared/tasks/new'), { title: '侵入', revision: 1 }));
  await assertFails(get(dbRef(alice, 'roomsV2/room-b/shared/tasks')));
  await assertFails(get(dbRef(alice, 'rooms/room-a/tasks'))); // legacy tree is never granted
  await assertFails(set(dbRef(alice, 'rooms/room-a/tasks/legacy-write'), { title: '旧クライアント', revision: 1 }));
  await assertFails(get(dbRef(alice, 'roomsV2/room-a'))); // no room-wide read
  await assertFails(get(dbRef(chief, 'roomsV2/room-a'))); // admin cannot read the room root
  await assertFails(set(dbRef(alice, 'roomsV2/room-a'), { shared: {} })); // no room-wide write
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks'), {})); // no collection-wide write
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/operations')));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/operations/promotions/alice/fake'), { taskId: 'forged' }));

  // Room viewer can read shared records, but only editor/admin may mutate.
  await assertSucceeds(get(dbRef(bob, 'roomsV2/room-a/shared/tasks')));
  await assertFails(set(dbRef(bob, 'roomsV2/room-a/shared/tasks/viewer-edit'), { title: '拒否', revision: 1 }));
  await assertSucceeds(get(dbRef(alice, 'roomsV2/room-a/shared/tasks')));
  await assertSucceeds(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/editor-edit'), { title: '許可', revision: 1 }));
  await assertSucceeds(set(dbRef(bob, 'roomsV2/room-b/shared/tasks/editor-edit'), { title: '許可', revision: 1 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-b/shared/tasks/task2'), { title: '越境', revision: 2 }));


  // Ver.569: candidate task records have one minimum schema and a monotonic revision.
  // These are *future* minimal records; current Classic tasks have a richer schema.
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/missing-revision'), { title: '改訂番号なし' }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/blank-title'), { title: '', revision: 1 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/long-title'), { title: 'あ'.repeat(121), revision: 1 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/decimal-revision'), { title: '少数', revision: 1.5 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/client-role'), { title: '不正フィールド', revision: 1, role: 'admin' }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1'), { title: '古い上書き', revision: 1 }));
  await assertSucceeds(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1'), { title: '更新', revision: 2 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1/title'), '改訂番号を変えない変更'));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1'), { title: '同じ改訂番号', revision: 2 }));
  await assertSucceeds(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1'), { title: '更新2', revision: 3 }));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/task1'), null)); // linked deletes need future trusted path
  await assertSucceeds(set(dbRef(chief, 'roomsV2/room-a/shared/tasks/admin-edit'), { title: '管理者', revision: 1 }));
  await assertFails(set(dbRef(chief, 'roomsV2/room-a/access/members/bob'), 'admin')); // admin role is not membership issuer

  // Personal ToDo and inbox are UID-scoped even among members of the same room.
  await assertSucceeds(get(dbRef(alice, 'roomsV2/room-a/personal/alice/todos')));
  await assertSucceeds(set(dbRef(alice, 'roomsV2/room-a/personal/alice/todos/todo3'), { title: '自身の追加' }));
  await assertFails(get(dbRef(bob, 'roomsV2/room-a/personal/alice/todos')));
  await assertFails(get(dbRef(chief, 'roomsV2/room-a/personal/alice/todos'))); // admin is not the private owner
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/personal/bob/todos')));
  await assertFails(get(dbRef(alice, 'roomsV2/room-b/personal/alice/todos')));
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/personal/alice'))); // no private-root read
  await assertSucceeds(get(dbRef(alice, 'roomsV2/room-a/personal/alice/inbox')));
  await assertFails(get(dbRef(bob, 'roomsV2/room-a/personal/alice/inbox')));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/personal/alice/inbox/event2'), { body: '偽通知' }));
  await assertSucceeds(set(dbRef(alice, 'roomsV2/room-a/personal/alice/inboxRead/event1'), true));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/personal/alice/inboxRead/event1'), 'incorrect-type'));

  // A client cannot grant itself membership or escalate another member.
  await assertSucceeds(get(dbRef(alice, 'roomsV2/room-a/access/members/alice')));
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/access/members/bob')));
  await assertFails(set(dbRef(outsider, 'roomsV2/room-a/access/members/charlie'), 'admin'));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/access/members/alice'), 'admin'));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/access/members/bob'), 'editor'));

  // Ver.570: a browser cannot add the trusted replay marker, even with a
  // multi-location update of its otherwise writable personal and shared paths.
  await assertFails(update(dbRef(alice, 'roomsV2/room-a'), {
    'shared/tasks/forged-promotion': { title: '偽一括更新', revision: 1 },
    'personal/alice/todos/todo1': { id: 'todo1', ownerUid: 'alice', text: '提出', revision: 4, completed: true },
    'operations/promotions/alice/fake': { taskId: 'forged-promotion' }
  }));
  const intent = {
    todoId: 'todo1', expectedRevision: 3, requestId: 'operationA',
    title: 'タスク化', description: '本文'
  };
  const trusted = { uid: 'alice', generatedTaskId: 'promotedTask', now: 1761876000000 };
  // This bypassed-rules context simulates a trusted service only; no backend is deployed.
  await env.withSecurityRulesDisabled(async admin => {
    const roomRef = dbRef(admin, 'roomsV2/room-a');
    await get(roomRef); // warm canonical room, avoiding an uncached null first callback
    let lastAction = 'none';
    const tx = await runTransaction(roomRef, current => {
      const planned = planRoomTodoPromotionV570(current, intent, trusted);
      lastAction = planned.action;
      return planned.action === 'commit' ? planned.room : undefined;
    }, { applyLocally: false });
    assert.equal(tx.committed, true);
    assert.equal(lastAction, 'commit');
    const replay = planRoomTodoPromotionV570(tx.snapshot.val(), intent, {
      ...trusted, generatedTaskId: 'differentTask', now: trusted.now + 1
    });
    assert.equal(replay.action, 'replayed');
    assert.equal(replay.taskId, 'promotedTask');
    const stale = planRoomTodoPromotionV570(tx.snapshot.val(), {
      ...intent, requestId: 'operationB'
    }, { ...trusted, generatedTaskId: 'differentTask' });
    assert.equal(stale.action, 'deny');
    assert.equal(stale.reason, 'stale-or-foreign-todo');
  });
  const promotedTask = await get(dbRef(alice, 'roomsV2/room-a/shared/tasks/promotedTask'));
  const promotedTodo = await get(dbRef(alice, 'roomsV2/room-a/personal/alice/todos/todo1'));
  assert.deepEqual(promotedTask.val(), { title: 'タスク化', description: '本文', revision: 1 });
  assert.equal(promotedTodo.val().revision, 4);
  assert.equal(promotedTodo.val().completed, true);
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/operations/promotions/alice/operationA')));
  await assertFails(get(dbRef(bob, 'roomsV2/room-a/personal/alice/todos/todo1')));

  // Revocation is enforced on the next rules-checked read/write.
  await env.withSecurityRulesDisabled(async admin => {
    await set(dbRef(admin, 'roomsV2/room-a/access/members/alice'), null);
  });
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/shared/tasks')));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/after-revoke'), { title: '拒否', revision: 1 }));
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/personal/alice/todos')));

  console.log('VER570_CANDIDATE_RULES_ROOM_ATOMIC_PASSED: isolated demo Emulator only');
} finally {
  await env.cleanup();
}
