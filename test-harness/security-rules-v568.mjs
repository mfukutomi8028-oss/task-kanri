// Ver.568–569: isolated future-schema Auth/Rules proof. Never connects to live Firebase.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';

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
      access: {
        'room-a': { members: { alice: 'editor', bob: 'viewer', chief: 'admin' } },
        'room-b': { members: { bob: 'editor' } }
      },
      roomsV2: {
        'room-a': { shared: { tasks: { task1: { title: '共有業務', revision: 1 } } } },
        'room-b': { shared: { tasks: { task2: { title: '別ルーム', revision: 1 } } } }
      },
      personalV2: {
        alice: { 'room-a': {
          todos: { todo1: { title: '個人ToDo' } },
          inbox: { event1: { body: '連絡' } }
        } },
        bob: { 'room-a': { todos: { todo2: { title: '他人のToDo' } } } }
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
  await assertFails(set(dbRef(alice, 'roomsV2/room-a'), { shared: {} })); // no room-wide write
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks'), {})); // no collection-wide write

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
  await assertFails(set(dbRef(chief, 'access/room-a/members/bob'), 'admin')); // admin role is not membership issuer

  // Personal ToDo and inbox are UID-scoped even among members of the same room.
  await assertSucceeds(get(dbRef(alice, 'personalV2/alice/room-a/todos')));
  await assertSucceeds(set(dbRef(alice, 'personalV2/alice/room-a/todos/todo3'), { title: '自身の追加' }));
  await assertFails(get(dbRef(bob, 'personalV2/alice/room-a/todos')));
  await assertFails(get(dbRef(alice, 'personalV2/bob/room-a/todos')));
  await assertFails(get(dbRef(alice, 'personalV2/alice/room-b/todos')));
  await assertFails(get(dbRef(alice, 'personalV2/alice/room-a'))); // no private-root read
  await assertSucceeds(get(dbRef(alice, 'personalV2/alice/room-a/inbox')));
  await assertFails(get(dbRef(bob, 'personalV2/alice/room-a/inbox')));
  await assertFails(set(dbRef(alice, 'personalV2/alice/room-a/inbox/event2'), { body: '偽通知' }));
  await assertSucceeds(set(dbRef(alice, 'personalV2/alice/room-a/inboxRead/event1'), true));
  await assertFails(set(dbRef(alice, 'personalV2/alice/room-a/inboxRead/event1'), 'incorrect-type'));

  // A client cannot grant itself membership or escalate another member.
  await assertSucceeds(get(dbRef(alice, 'access/room-a/members/alice')));
  await assertFails(get(dbRef(alice, 'access/room-a/members/bob')));
  await assertFails(set(dbRef(outsider, 'access/room-a/members/charlie'), 'admin'));
  await assertFails(set(dbRef(alice, 'access/room-a/members/alice'), 'admin'));
  await assertFails(set(dbRef(alice, 'access/room-a/members/bob'), 'editor'));

  // Revocation is enforced on the next rules-checked read/write.
  await env.withSecurityRulesDisabled(async admin => {
    await set(dbRef(admin, 'access/room-a/members/alice'), null);
  });
  await assertFails(get(dbRef(alice, 'roomsV2/room-a/shared/tasks')));
  await assertFails(set(dbRef(alice, 'roomsV2/room-a/shared/tasks/after-revoke'), { title: '拒否', revision: 1 }));
  await assertFails(get(dbRef(alice, 'personalV2/alice/room-a/todos')));

  console.log('VER569_CANDIDATE_RULES_ALLOW_DENY_SCHEMA_PASSED: isolated demo Emulator only');
} finally {
  await env.cleanup();
}
