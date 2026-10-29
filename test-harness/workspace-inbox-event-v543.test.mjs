import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function fixture(mode = 'local-only', externalServer) {
  const window = {};
  const module = read('workspace-inbox-event-v543.js');
  vm.runInNewContext(module, { window }, { filename: 'workspace-inbox-event-v543.js' });
  const shared = window.WorkBoardInboxEventV543;
  vm.runInNewContext(module, { window });
  assert.equal(window.WorkBoardInboxEventV543, shared, 'one module per browser');

  let connection = mode, rejectTransactions = false;
  const local = {}, server = externalServer || new Map();
  const calls = { emitted: 0, connection: 0, writes: [], errors: [] };
  const path = (recipient, id) => 'rooms/isolated-v543/workflowV152/inbox/' + recipient + '/' + id;
  const sdk = {
    db: {},
    ref(db, at) { assert.equal(db, sdk.db); return { at }; },
    async runTransaction(target, update, options) {
      assert.equal(options.applyLocally, false, 'never apply local SDK writes twice');
      if (rejectTransactions) throw new Error('disconnected');
      const current = server.get(target.at) || null;
      const next = update(current);
      calls.writes.push({ at: target.at, before: current, after: next });
      if (next) server.set(target.at, next);
      return { committed: true, snapshot: { val: () => next } };
    }
  };
  const api = shared.create({
    roomId: 'isolated-v543',
    normalizeRecipient: s => String(s || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 100),
    sanitizeEventId: s => String(s || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 100),
    applyLocal: (user, id, item) => {
      local[user] ||= {};
      if (!local[user][id]) local[user][id] = item;
      calls.emitted++;
    },
    ensureRemote: async () => { calls.connection++; return connection === 'ready' ? sdk : null; },
    getRemoteState: () => connection,
    log: (...args) => calls.errors.push(args)
  });
  return {
    local, server, calls, path, api, shared,
    setMode: v => { connection = v; },
    fail: v => { rejectTransactions = Boolean(v); }
  };
}

const event = (taskId = 'task-one', extras = {}) => ({
  taskId, type: 'comment', title: 'コメントが届きました', body: '内容', actor: '福冨', createdAt: 12345,
  ...extras
});

test('Ver.543 rejects incomplete dependencies and events without taskId without changing data', async () => {
  const f = fixture();
  assert.throws(() => f.shared.create({ roomId: 'x' }), /dependencies/);
  const result = await f.api.write('森井', 'comment_one', { taskId: '' });
  assert.equal(result.ok, false);
  assert.equal(f.calls.connection, 0);
  assert.equal(f.calls.emitted, 0);
  assert.equal(f.local['森井'], undefined);
});

test('Ver.543 canonical event shape, field bounds, default values and sanitized deterministic key', async () => {
  const f = fixture();
  assert.equal((await f.api.write('医事.係', 'task#one/コメント', {
    taskId: 'task-a', title: 'T'.repeat(140), body: 'B'.repeat(400), createdAt: 500
  })).ok, true);
  const entry = f.local['医事-係']['task-one-コメント'];
  assert.equal(entry.taskId, 'task-a');
  assert.equal(entry.title.length, 120);
  assert.equal(entry.body.length, 300);
  assert.equal(entry.type, 'update');
  assert.equal(entry.actor, '');
  assert.equal(entry.createdAt, 500);
  assert.equal(entry.readAt, 0);
  assert.equal(f.calls.emitted, 1);
});

test('Ver.543 local duplicates preserve the first notification, including marked readAt', async () => {
  const f = fixture();
  const first = event('task-a');
  assert.equal((await f.api.write('森井', 'comment_7', first)).localOnly, true);
  f.local['森井'].comment_7.readAt = 501;
  assert.equal((await f.api.write('森井', 'comment_7', event('task-a', {
    body: 'rewritten', createdAt: 999
  }))).ok, true);
  assert.equal(Object.keys(f.local['森井']).length, 1);
  assert.equal(f.local['森井'].comment_7.body, '内容');
  assert.equal(f.local['森井'].comment_7.readAt, 501);
  assert.equal(f.local['森井'].comment_7.createdAt, 12345);
  assert.equal(f.calls.emitted, 2, 'retain old event emission on retry');
  assert.equal(f.calls.writes.length, 0);
});

test('Ver.543 remote duplicate writer keeps the first event and never resets readAt', async () => {
  const f = fixture('ready'), id = 'reaction_task_a_21';
  const first = event('task-a', { type: 'reaction' });
  assert.equal((await f.api.write('森井', id, first)).ok, true);
  const record = f.server.get(f.path('森井', id));
  record.readAt = 6789;
  assert.equal((await f.api.write('森井', id, event('task-a', {
    body: 'late retry', actor: '別人', createdAt: 888
  }))).ok, true);
  const stored = f.server.get(f.path('森井', id));
  assert.equal(f.calls.writes.length, 2);
  assert.equal(f.calls.writes[1].after, record, 'transaction reuses stored event');
  assert.equal(stored.readAt, 6789);
  assert.equal(stored.body, '内容');
  assert.equal(stored.actor, '福冨');
  assert.equal(stored.createdAt, 12345);
  assert.equal(Object.keys(f.local['森井']).length, 1);
});

test('Ver.543 repeated same id is scoped to each room recipient, not overwritten cross-user', async () => {
  const f = fixture('ready');
  await f.api.write('森井', 'assign_same', event('task-a', { title: 'A' }));
  await f.api.write('佐藤', 'assign_same', event('task-a', { title: 'B' }));
  assert.equal(f.server.get(f.path('森井', 'assign_same')).title, 'A');
  assert.equal(f.server.get(f.path('佐藤', 'assign_same')).title, 'B');
  assert.equal(f.server.size, 2);
});

test('Ver.543 local-only and remote-unavailable outcomes preserve observer pending retry contract', async () => {
  const f = fixture('error');
  const failed = await f.api.write('森井', 'reply_key', event());
  assert.equal(failed.ok, false);
  assert.equal(failed.localOnly, false);
  assert.equal(f.local['森井'].reply_key.taskId, 'task-one', 'old optimistic cache retained');
  assert.equal(f.calls.writes.length, 0);
  assert.equal(f.calls.errors.length, 0);
  f.setMode('local-only');
  const local = await f.api.write('森井', 'reply_key', event('task-other'));
  assert.equal(local.ok, true);
  assert.equal(local.localOnly, true);
  assert.equal(f.local['森井'].reply_key.taskId, 'task-one', 'first local event wins');
});

test('Ver.543 remote transaction rejection returns ok:false without throwing or clearing queued event', async () => {
  const f = fixture('ready');
  f.fail(true);
  const result = await f.api.write('森井', 'reply_retry', event());
  assert.equal(result.ok, false);
  assert.equal(f.calls.errors.length, 1);
  assert.equal(f.calls.errors[0][0], 'Ver.152 inbox write failed');
  assert.equal(f.local['森井'].reply_retry.taskId, 'task-one');
  f.fail(false);
  assert.equal((await f.api.write('森井', 'reply_retry', event())).ok, true);
  assert.equal(f.server.has(f.path('森井', 'reply_retry')), true);
});

test('Ver.543 identical event ID in two separate clients converges to one remote first-wins record', async () => {
  const server = new Map();
  const a = fixture('ready', server), b = fixture('ready', server);
  const id = 'reply_task_a_comment1_森井';
  await a.api.write('森井', id, event('task-a', { body: 'writer one' }));
  await b.api.write('森井', id, event('task-a', { body: 'writer two', createdAt: 55555 }));
  assert.equal(server.size, 1);
  assert.equal(server.get(a.path('森井', id)).body, 'writer one');
  assert.equal(server.get(a.path('森井', id)).createdAt, 12345);
});

test('Ver.543 writer only delegates existing workflow owner and keeps observer durable pending queue', () => {
  const sidecar = read('workflow-v152.js');
  const module = read('workspace-inbox-event-v543.js');
  const manifest = read('release-manifest.js');
  const observer = read('inbox-events-v183.js');
  const modern = read('modern/preview/index.html');
  assert.match(sidecar, /window\.WorkBoardInboxEventV543\.create\(/);
  assert.match(sidecar, /return inboxEventPersistence\.write\(recipient,eventId,event\)/);
  assert.match(sidecar, /if\(!data\.inbox\[user\]\[id\]\)data\.inbox\[user\]\[id\]=item/);
  assert.match(module, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
  assert.match(module, /getRemoteState\(\) === 'local-only'/);
  assert.match(observer, /queuePending\(recipient,id,event\)[\s\S]*?W\.writeInboxEvent\(recipient,id,event\)[\s\S]*?if\(result\?\.ok\)clearPending\(recipient,id\)/);
  assert.doesNotMatch(module, /\bonValue\(|\blocalStorage\b|\bdocument\b|\bfetch\(|firebaseConfig/);
  assert.doesNotMatch(modern, /workspace-inbox-event-v543|firebase|app\.js/i);
  assert.equal((manifest.match(/"workspace-inbox-event-v543\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-inbox-event-v543.js"') < scripts.indexOf('"workflow-v152.js"'));
});
