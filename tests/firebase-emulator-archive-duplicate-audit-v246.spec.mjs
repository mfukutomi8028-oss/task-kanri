import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-archive-duplicate-audit-v246';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function emulatorRequest(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

function taskRecord(id, title, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title,
    description: '',
    requester: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    tags: [],
    dueDate: '',
    dueTime: '',
    pinned: false,
    checklist: [],
    comments: [],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 10_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1,
    ...overrides
  };
}

async function installEmulatorBoundary(page, initialTasks = []) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port, tasks }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(Array.isArray(tasks) ? tasks : []));
    } catch {}
    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, tasks: initialTasks });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return productionRequests;
}

async function boot(page, initialTasks = []) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page, initialTasks);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return productionRequests;
}

async function waitForTask(page, id, revision = null) {
  await page.waitForFunction(({ taskId, expectedRevision }) => {
    const task = window.WorkBoardWorkflowV152?.taskMap?.().get(taskId);
    return Boolean(task) && (expectedRevision === null || Number(task.revision || 0) === expectedRevision);
  }, { taskId: id, expectedRevision: revision }, { timeout: 10_000 });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.246 product: stale archive restore preserves the remote winner, then the current base can restore', async ({ page }) => {
  await boot(page);
  const taskId = 'archive-race-v246';
  const archivePath = `rooms/${ROOM}/workflowV152/archives/${taskId}`;

  const first = await page.evaluate(id => window.WorkBoardWorkflowV152.archiveTask(id, 'manual'), taskId);
  expect(first?.ok).toBe(true);
  const firstStored = await readDb(archivePath);
  expect(firstStored?.reason).toBe('manual');

  const remoteWinner = {
    archivedAt: Number(firstStored.archivedAt || 0) + 10_000,
    archivedBy: 'remote-user',
    reason: 'remote-rearchive'
  };
  await putDb(archivePath, remoteWinner);
  await expect.poll(async () => page.evaluate(id => window.WorkBoardWorkflowV152.archiveInfo(id)?.reason || '', taskId)).toBe('remote-rearchive');

  const staleRestore = await page.evaluate(({ id, expected }) => window.WorkBoardWorkflowV152.unarchiveTask(id, expected), { id: taskId, expected: firstStored });
  expect(staleRestore).toMatchObject({ ok: false, conflict: true });
  expect(await readDb(archivePath)).toEqual(remoteWinner);
  await expect.poll(async () => page.evaluate(id => window.WorkBoardWorkflowV152.archiveInfo(id), taskId)).toEqual(remoteWinner);

  const freshRestore = await page.evaluate(({ id, expected }) => window.WorkBoardWorkflowV152.unarchiveTask(id, expected), { id: taskId, expected: remoteWinner });
  expect(freshRestore?.ok).toBe(true);
  expect(await readDb(archivePath)).toBeNull();
});

test('Ver.246 product: stale duplicate merge preserves the remote target, then the current revisions can merge', async ({ page }) => {
  const sourceId = 'duplicate-race-source-v246';
  const targetId = 'duplicate-race-target-v246';
  const sourceTitle = '競合監査・重複元';
  const targetTitle = '競合監査・統合先';
  const sourceInitial = taskRecord(sourceId, sourceTitle, {
    description: 'source-description-v246',
    tags: ['source-v246']
  });
  const targetInitial = taskRecord(targetId, targetTitle, {
    description: 'target-description-v246',
    tags: ['target-v246']
  });
  await putDb(`rooms/${ROOM}/tasks/${sourceId}`, sourceInitial);
  await putDb(`rooms/${ROOM}/tasks/${targetId}`, targetInitial);

  await boot(page, [sourceInitial, targetInitial]);
  await waitForTask(page, sourceId, 1);
  await waitForTask(page, targetId, 1);

  const stale = await page.evaluate(async ({ sourceId, targetId }) => {
    const W = window.WorkBoardWorkflowV152;
    const originalEnsure = W.ensureRemote.bind(W);
    const real = await originalEnsure();
    let injected = false;
    const proxy = new Proxy(real, {
      get(target, property, receiver) {
        if (property === 'runTransaction') {
          return async (ref, updateFn, options) => {
            if (!injected) {
              injected = true;
              const targetRef = real.ref(real.db, `rooms/${W.ROOM_ID}/tasks/${targetId}`);
              const snapshot = await real.get(targetRef);
              const current = snapshot.val();
              await real.set(targetRef, {
                ...current,
                description: 'REMOTE_WINNER_DESCRIPTION_V246',
                updatedAt: Date.now() + 60_000,
                updatedBy: 'remote-user',
                revision: Number(current?.revision || 0) + 1
              });
            }
            return real.runTransaction(ref, updateFn, options);
          };
        }
        return Reflect.get(target, property, receiver);
      }
    });
    W.ensureRemote = async () => proxy;
    window.confirm = () => true;
    const result = await window.WorkBoardDuplicateV182.mergeDuplicate(sourceId, targetId);
    W.ensureRemote = originalEnsure;
    return { injected, result };
  }, { sourceId, targetId });

  expect(stale.injected).toBe(true);
  expect(stale.result).toMatchObject({ ok: false, conflict: true });
  const targetAfterConflict = await readDb(`rooms/${ROOM}/tasks/${targetId}`);
  const sourceAfterConflict = await readDb(`rooms/${ROOM}/tasks/${sourceId}`);
  expect(targetAfterConflict).toMatchObject({ description: 'REMOTE_WINNER_DESCRIPTION_V246', revision: 2, updatedBy: 'remote-user' });
  expect(sourceAfterConflict).toMatchObject({ status: '対応中', revision: 1 });
  expect(await readDb(`rooms/${ROOM}/workflowV152/duplicates/${sourceId}`)).toBeNull();
  expect(await readDb(`rooms/${ROOM}/workflowV152/archives/${sourceId}`)).toBeNull();

  await waitForTask(page, targetId, 2);
  await expect.poll(async () => page.evaluate(id => window.WorkBoardWorkflowV152.taskMap().get(id)?.description || '', targetId)).toBe('REMOTE_WINNER_DESCRIPTION_V246');

  const fresh = await page.evaluate(async ({ sourceId, targetId }) => {
    window.confirm = () => true;
    return window.WorkBoardDuplicateV182.mergeDuplicate(sourceId, targetId);
  }, { sourceId, targetId });
  expect(fresh?.ok).toBe(true);

  const target = await readDb(`rooms/${ROOM}/tasks/${targetId}`);
  const source = await readDb(`rooms/${ROOM}/tasks/${sourceId}`);
  const duplicate = await readDb(`rooms/${ROOM}/workflowV152/duplicates/${sourceId}`);
  const archive = await readDb(`rooms/${ROOM}/workflowV152/archives/${sourceId}`);

  expect(target.description).toContain('REMOTE_WINNER_DESCRIPTION_V246');
  expect(target.description).toContain('source-description-v246');
  expect(target.revision).toBe(3);
  expect(source).toMatchObject({ status: '完了', duplicateOf: targetId, revision: 2 });
  expect(duplicate?.targetId).toBe(targetId);
  expect(archive?.reason).toBe('duplicate');
});
