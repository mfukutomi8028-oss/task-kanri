import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-workflow-audit-v245';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function request(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => request(path);
const putDb = (path, value) => request(path, { method: 'PUT', value });
const deleteDb = path => request(path, { method: 'DELETE' });

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
    knowledgeId: '',
    createdAt: now - 5000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1,
    ...overrides
  };
}

async function installBoundary(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get: () => demoConfig, set() {} });
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
  const productionRequests = await installBoundary(page);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.classList.contains('remote-online'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150?.dependencyStateReady?.(), undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.245 audit: inherited dependency writer touches workflowV148 only and preserves canonical tasks plus sibling workflow data', async ({ page }) => {
  test.slow();
  const taskA = 'workflow-dep-a-v245';
  const taskB = 'workflow-dep-b-v245';
  const siblingView = { taskLayout: 'list', columnSort: null, updatedAt: Date.now() - 1000 };
  const storedA = taskRecord(taskA, '依存元', { revision: 4, customAuditField: 'keep-a' });
  const storedB = taskRecord(taskB, '依存先', { revision: 7, customAuditField: 'keep-b' });

  await putDb(`rooms/${ROOM}/tasks/${taskA}`, storedA);
  await putDb(`rooms/${ROOM}/tasks/${taskB}`, storedB);
  await putDb(`rooms/${ROOM}/workflowV148/savedViews/view-v245`, siblingView);
  await boot(page);

  const result = await page.evaluate(async ({ taskA, taskB }) => {
    return window.WorkBoardWorkflowV152.writeDependencies(taskA, [taskB]);
  }, { taskA, taskB });
  expect(result?.ok).toBe(true);

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV148/dependencies/${taskA}`)).toEqual({ [taskB]: true });
  expect(await readDb(`rooms/${ROOM}/tasks/${taskA}`)).toEqual(storedA);
  expect(await readDb(`rooms/${ROOM}/tasks/${taskB}`)).toEqual(storedB);
  expect(await readDb(`rooms/${ROOM}/workflowV148/savedViews/view-v245`)).toEqual(siblingView);
});

test('Ver.245 audit: current V152 reminder clear can delete a concurrent remote winner because it uses blind remove', async ({ page }) => {
  test.slow();
  const taskId = 'workflow-reminder-race-v245';
  const user = '福冨';
  const initial = { at: Date.now() + 3_600_000, note: '古い画面の内容', updatedAt: Date.now() - 2000 };
  const remoteWinner = { at: Date.now() + 7_200_000, note: '別端末が更新した内容', updatedAt: Date.now() + 2000 };

  await putDb(`rooms/${ROOM}/tasks/${taskId}`, taskRecord(taskId, 'リマインダー競合監査'));
  await putDb(`rooms/${ROOM}/workflowV148/reminders/${user}/${taskId}`, initial);
  await boot(page);
  await page.waitForFunction(({ taskId, note }) => window.WorkBoardWorkflowV150?.reminderFor?.(taskId)?.note === note,
    { taskId, note: initial.note }, { timeout: 20_000 });

  await page.evaluate(({ winner }) => {
    const base = window.WorkBoardWorkflowV150;
    const originalEnsure = base.ensureRemote;
    base.ensureRemote = async () => {
      const remote = await originalEnsure();
      return {
        ...remote,
        remove: async target => {
          await remote.set(target, winner);
          return remote.remove(target);
        }
      };
    };
  }, { winner: remoteWinner });

  const result = await page.evaluate(async ({ taskId, user }) => {
    return window.WorkBoardWorkflowV152.writeReminder(taskId, null, user);
  }, { taskId, user });

  expect(result?.ok).toBe(true);
  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV148/reminders/${user}/${taskId}`)).toBeNull();
  expect(await readDb(`rooms/${ROOM}/tasks/${taskId}`)).toMatchObject({ id: taskId, revision: 1 });
});
