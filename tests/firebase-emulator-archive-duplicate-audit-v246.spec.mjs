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

async function installEmulatorBoundary(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
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
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return productionRequests;
}

async function boot(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return productionRequests;
}

async function waitForTask(page, id) {
  await page.waitForFunction(taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId), id, { timeout: 10_000 });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.246 audit: current unarchive removes a newer remote archive record without an expected-base guard', async ({ page }) => {
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

  const staleRestore = await page.evaluate(id => window.WorkBoardWorkflowV152.unarchiveTask(id), taskId);
  expect(staleRestore?.ok).toBe(true);
  expect(await readDb(archivePath)).toBeNull();
});

test('Ver.246 audit: duplicate merge can overwrite a target update inserted after revision GET and still report success', async ({ page }) => {
  const sourceId = 'duplicate-race-source-v246';
  const targetId = 'duplicate-race-target-v246';
  const sourceTitle = '競合監査・重複元';
  const targetTitle = '競合監査・統合先';
  await putDb(`rooms/${ROOM}/tasks/${sourceId}`, taskRecord(sourceId, sourceTitle, {
    description: 'source-description-v246',
    tags: ['source-v246']
  }));
  await putDb(`rooms/${ROOM}/tasks/${targetId}`, taskRecord(targetId, targetTitle, {
    description: 'target-description-v246',
    tags: ['target-v246']
  }));

  await boot(page);
  await waitForTask(page, sourceId);
  await waitForTask(page, targetId);

  const race = await page.evaluate(async ({ sourceId, targetId }) => {
    const W = window.WorkBoardWorkflowV152;
    const originalEnsure = W.ensureRemote.bind(W);
    const real = await originalEnsure();
    let injected = false;
    const proxy = new Proxy(real, {
      get(target, property, receiver) {
        if (property === 'update') {
          return async (ref, updates) => {
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
            return real.update(ref, updates);
          };
        }
        return Reflect.get(target, property, receiver);
      }
    });
    W.ensureRemote = async () => proxy;
    window.confirm = () => true;
    await window.WorkBoardDuplicateV182.mergeDuplicate(sourceId, targetId);
    return { injected };
  }, { sourceId, targetId });

  expect(race.injected).toBe(true);
  const target = await readDb(`rooms/${ROOM}/tasks/${targetId}`);
  const source = await readDb(`rooms/${ROOM}/tasks/${sourceId}`);
  const duplicate = await readDb(`rooms/${ROOM}/workflowV152/duplicates/${sourceId}`);
  const archive = await readDb(`rooms/${ROOM}/workflowV152/archives/${sourceId}`);

  expect(target.description).toContain('target-description-v246');
  expect(target.description).toContain('source-description-v246');
  expect(target.description).not.toContain('REMOTE_WINNER_DESCRIPTION_V246');
  expect(target.revision).toBe(2);
  expect(source).toMatchObject({ status: '完了', duplicateOf: targetId, revision: 2 });
  expect(duplicate?.targetId).toBe(targetId);
  expect(archive?.reason).toBe('duplicate');
});
