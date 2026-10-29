import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../workspace-start-date-v548.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const revision = value => { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : 0; };

function fixture({ online = true, starts = { t: { date: '2026-01-01', revision: 2 } } } = {}) {
  const window = {};
  vm.runInNewContext(source, { window }, { filename: 'workspace-start-date-v548.js' });
  const module = window.WorkBoardStartDatePersistenceV548;
  vm.runInNewContext(source, { window });
  assert.equal(window.WorkBoardStartDatePersistenceV548, module);
  const state = { roomId: 'sandbox-v548', db: {}, online, taskStarts: clone(starts) };
  let storage = clone(starts), server = clone(starts), persistCount = 0, transactCount = 0, failTransaction = false, abort = false;
  let capturedPath = null;
  const firebaseModules = {
    ref(db, path) { assert.equal(db, state.db); capturedPath = path; return { path }; },
    async runTransaction(target, updater) {
      assert.equal(target.path, 'rooms/sandbox-v548/taskStarts/t');
      transactCount++;
      if (failTransaction) throw new Error('offline-now');
      const next = updater(clone(server.t || null));
      if (next === undefined || abort) return { committed: false };
      server.t = clone(next);
      return { committed: true };
    }
  };
  const owner = module.create({
    getFeatureState: () => state, ensureFirebase: async () => online,
    firebaseModules, finiteRevision: revision, currentUser: () => 'test-operator',
    loadLocalStarts: () => clone(storage),
    persistLocalStarts: next => { persistCount++; storage = clone(next); }
  });
  return { owner, module, state, get server() { return clone(server); },
    set server(value) { server = clone(value); }, get storage() { return clone(storage); },
    get persistCount() { return persistCount; }, get transactCount() { return transactCount; },
    get capturedPath() { return capturedPath; },
    failTransaction: () => { failTransaction = true; }, abort: () => { abort = true; } };
}

test('Ver.548 singleton, dependencies and frozen public API', async () => {
  const f = fixture();
  assert.ok(Object.isFrozen(f.module));
  assert.ok(Object.isFrozen(f.owner));
  assert.throws(() => f.module.create({}), /dependencies/);
  await assert.rejects(f.owner.save('', '', 0), /task id/);
});

test('Ver.548 remote child transaction retains schema, revision, author and unrelated IDs', async () => {
  const f = fixture({ starts: { t: { date: '2026-01-01', revision: 2 }, other: { date: '2026-01-30', revision: 50 } } });
  const result = await f.owner.save('t', '2026-02-01', 2);
  assert.equal(result.ok, true);
  assert.equal(result.localOnly, false);
  assert.equal(f.server.t.revision, 3);
  assert.equal(f.server.t.date, '2026-02-01');
  assert.equal(f.server.t.updatedBy, 'test-operator');
  assert.ok(f.server.t.updatedAt > 0);
  assert.deepEqual(f.server.other, { date: '2026-01-30', revision: 50 });
  assert.equal(f.persistCount, 0);
  assert.equal(f.transactCount, 1);
  assert.equal(f.capturedPath, 'rooms/sandbox-v548/taskStarts/t');
  assert.equal(f.state.taskStarts.t.revision, 2, 'online cache remains subscription-owned');
});

test('Ver.548 stale expected revision preserves remote winner', async () => {
  const f = fixture();
  f.server = { t: { date: '2026-03-01', revision: 3, updatedBy: 'other' } };
  const before = f.server;
  const result = await f.owner.save('t', '2026-02-01', 2);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.deepEqual(f.server, before);
});

test('Ver.548 empty record begins at revision one, and clearing is revision-safe', async () => {
  const f = fixture({ starts: {} });
  assert.equal((await f.owner.save('t', '2026-03-01', 0)).ok, true);
  assert.equal(f.server.t.revision, 1);
  assert.equal((await f.owner.save('t', '', 1)).ok, true);
  assert.equal(f.server.t.date, '');
  assert.equal(f.server.t.revision, 2);
});

test('Ver.548 remote abort and network error cannot report success', async () => {
  const f = fixture();
  f.abort();
  assert.equal((await f.owner.save('t', '2026-05-01', 2)).ok, false);
  f.failTransaction();
  await assert.rejects(f.owner.save('t', '2026-05-01', 2), /offline-now/);
  assert.equal(f.server.t.date, '2026-01-01');
});

test('Ver.548 local-only commit updates the owner cache once without Firebase write', async () => {
  const f = fixture({ online: false });
  const result = await f.owner.save('t', '2026-06-01', 2);
  assert.equal(result.ok, true);
  assert.equal(result.localOnly, true);
  assert.equal(f.storage.t.date, '2026-06-01');
  assert.equal(f.state.taskStarts.t.revision, 3);
  assert.equal(f.persistCount, 1);
  assert.equal(f.transactCount, 0);
});

test('Ver.548 local revision conflict preserves original state without writing', async () => {
  const f = fixture({ online: false });
  const old = f.storage;
  const result = await f.owner.save('t', '2026-06-01', 1);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.deepEqual(f.storage, old);
  assert.deepEqual(f.state.taskStarts, old);
  assert.equal(f.persistCount, 0);
});

test('Ver.548 has no second subscription, Firebase client, UI or storage owner', () => {
  assert.doesNotMatch(source, /\bonValue\s*\(|\bonChildAdded\s*\(|\binitializeApp\s*\(|\bgetDatabase\s*\(|\bdocument\./);
  assert.doesNotMatch(source, /\blocalStorage\./);
  assert.match(source, /runTransaction\(/);
});


function orphanFixture({ online = true, tasks = {}, starts = { t: { date: '2027-03-01', revision: 2 } } } = {}) {
  const window = {};
  vm.runInNewContext(source, { window }, { filename: 'workspace-start-date-v548.js' });
  const state = {
    roomId: 'isolated-v549', db: {}, online,
    tasksLoaded: true, startsLoaded: true,
    tasks: clone(tasks), taskStarts: clone(starts)
  };
  let remoteTasks = clone(tasks), remoteStarts = clone(starts);
  let localSaved = null, persistCount = 0, errorCount = 0, taskReadCount = 0;
  let appearOnSecondRead = false, raceRevision = false, failGet = false;
  const calls = { gets: [], transactions: [] };
  const snapshot = value => ({ exists: () => value !== undefined && value !== null, val: () => clone(value ?? null) });
  const api = {
    ref(db, path) { assert.equal(db, state.db); return { path }; },
    async get(target) {
      calls.gets.push(target.path);
      if (failGet) throw new Error('read-offline');
      if (target.path.endsWith('/tasks/t')) {
        taskReadCount++;
        const value = remoteTasks.t;
        if (appearOnSecondRead && taskReadCount === 1) {
          remoteTasks.t = { id: 't', title: 'created during cleanup' };
        }
        return snapshot(value);
      }
      if (target.path.endsWith('/taskStarts/t')) return snapshot(remoteStarts.t);
      throw new Error('unexpected path ' + target.path);
    },
    async runTransaction(target, update) {
      calls.transactions.push(target.path);
      assert.equal(target.path, 'rooms/isolated-v549/taskStarts/t');
      if (raceRevision) remoteStarts.t = { ...remoteStarts.t, date: '2028-05-01', revision: 3 };
      const value = update(clone(remoteStarts.t || null));
      if (value === undefined) return { committed: false };
      if (value === null) delete remoteStarts.t;
      else remoteStarts.t = clone(value);
      return { committed: true };
    }
  };
  const owner = window.WorkBoardStartDatePersistenceV548.create({
    getFeatureState: () => state,
    ensureFirebase: async () => online,
    firebaseModules: api,
    finiteRevision: revision,
    currentUser: () => 'test',
    loadLocalStarts: () => clone(starts),
    persistLocalStarts: next => { persistCount++; localSaved = clone(next); },
    reportCleanupError: () => { errorCount++; }
  });
  return {
    owner, state, calls,
    get remoteStarts() { return clone(remoteStarts); },
    get localSaved() { return clone(localSaved); },
    get persistCount() { return persistCount; },
    get errorCount() { return errorCount; },
    setAppearOnSecondRead() { appearOnSecondRead = true; },
    setRaceRevision() { raceRevision = true; },
    setFailGet() { failGet = true; },
    removeRemoteStart() { delete remoteStarts.t; },
    setRemoteTask(value) { remoteTasks.t = value; }
  };
}

test('Ver.549 orphan cleanup waits until both canonical caches have loaded', async () => {
  const f = orphanFixture();
  f.state.tasksLoaded = false;
  await f.owner.cleanupOrphans();
  assert.equal(f.calls.gets.length, 0);
  f.state.tasksLoaded = true;
  f.state.startsLoaded = false;
  await f.owner.cleanupOrphans();
  assert.equal(f.calls.gets.length, 0);
});

test('Ver.549 local-only orphan cleanup keeps non-orphan starts and persists the existing cache once', async () => {
  const f = orphanFixture({
    online: false,
    tasks: { kept: { id: 'kept' } },
    starts: {
      t: { date: '2027-03-01', revision: 2 },
      kept: { date: '2027-04-01', revision: 7 }
    }
  });
  await f.owner.cleanupOrphans();
  assert.deepEqual(f.localSaved, { kept: { date: '2027-04-01', revision: 7 } });
  assert.deepEqual(f.state.taskStarts, f.localSaved);
  assert.equal(f.persistCount, 1);
  assert.equal(f.calls.transactions.length, 0);
});

test('Ver.549 remote cleanup checks task twice, then deletes only its matching child revision', async () => {
  const f = orphanFixture();
  await f.owner.cleanupOrphans();
  assert.deepEqual(f.calls.gets, [
    'rooms/isolated-v549/tasks/t',
    'rooms/isolated-v549/taskStarts/t',
    'rooms/isolated-v549/tasks/t'
  ]);
  assert.deepEqual(f.calls.transactions, ['rooms/isolated-v549/taskStarts/t']);
  assert.deepEqual(f.remoteStarts, {});
  assert.equal(f.persistCount, 0);
  assert.equal(f.state.taskStarts.t.revision, 2, 'the subscription owns online cache refresh');
});

test('Ver.549 cleanup never removes a start when its task already exists remotely', async () => {
  const f = orphanFixture();
  f.setRemoteTask({ id: 't' });
  await f.owner.cleanupOrphans();
  assert.deepEqual(f.calls.gets, ['rooms/isolated-v549/tasks/t']);
  assert.equal(f.calls.transactions.length, 0);
  assert.equal(f.remoteStarts.t.revision, 2);
});

test('Ver.549 cleanup stops when the task appears between authoritative reads', async () => {
  const f = orphanFixture();
  f.setAppearOnSecondRead();
  await f.owner.cleanupOrphans();
  assert.equal(f.calls.gets.length, 3);
  assert.equal(f.calls.transactions.length, 0);
  assert.equal(f.remoteStarts.t.revision, 2);
});

test('Ver.549 cleanup does not remove a start absent on the server', async () => {
  const f = orphanFixture();
  f.removeRemoteStart();
  await f.owner.cleanupOrphans();
  assert.equal(f.calls.gets.length, 2);
  assert.equal(f.calls.transactions.length, 0);
});

test('Ver.549 remote revision race aborts deletion and keeps the newer record', async () => {
  const f = orphanFixture();
  f.setRaceRevision();
  await f.owner.cleanupOrphans();
  assert.equal(f.calls.transactions.length, 1);
  assert.equal(f.remoteStarts.t.revision, 3);
  assert.equal(f.remoteStarts.t.date, '2028-05-01');
  assert.equal(f.errorCount, 0);
});

test('Ver.549 remote read failure is reported but never deletes local or remote data', async () => {
  const f = orphanFixture();
  f.setFailGet();
  await f.owner.cleanupOrphans();
  assert.equal(f.errorCount, 1);
  assert.equal(f.calls.transactions.length, 0);
  assert.equal(f.remoteStarts.t.revision, 2);
  assert.equal(f.state.taskStarts.t.revision, 2);
});

test('Ver.549 shared cleanup does not introduce a second subscription, root transaction or direct storage owner', () => {
  assert.match(source, /async function cleanupOrphans\(/);
  assert.match(source, /const taskRecheck = await get\(taskRef\)/);
  assert.match(source, /finiteRevision\(current\.revision\) !== expectedRevision/);
  assert.doesNotMatch(source, /onValue\(|\.on\(|localStorage\./);
  assert.doesNotMatch(source, /runTransaction\(ref\(state\.db, \`rooms\/\$\{state\.roomId\}\`\)/);
});
