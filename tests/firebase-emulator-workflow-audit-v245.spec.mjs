import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-workflow-audit-v245';
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
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.245 product: v150 dependency child transaction preserves unrelated workflow records', async ({ page }) => {
  await putDb(`rooms/${ROOM}/workflowV148/dependencies/unrelated-task`, { 'existing-blocker': true });
  await boot(page);

  const result = await page.evaluate(() => window.WorkBoardWorkflowV150.writeDependencies('audit-task-v245', ['dep-a-v245', 'dep-b-v245']));
  expect(result?.ok).toBe(true);

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV148/dependencies/audit-task-v245`)).toEqual({
    'dep-a-v245': true,
    'dep-b-v245': true
  });
  expect(await readDb(`rooms/${ROOM}/workflowV148/dependencies/unrelated-task`)).toEqual({ 'existing-blocker': true });
});

test('Ver.245 product: stale reminder save and clear preserve the remote winner, then the current base can commit', async ({ page }) => {
  await boot(page);
  const taskId = 'audit-reminder-v245';
  const firstAt = Date.now() + 3_600_000;
  const remoteAt = firstAt + 3_600_000;
  const freshAt = remoteAt + 3_600_000;
  const reminderPath = `rooms/${ROOM}/workflowV148/reminders/福冨/${taskId}`;

  const first = await page.evaluate(({ taskId, at }) => window.WorkBoardWorkflowV152.writeReminder(taskId, { at, note: 'client-old' }), { taskId, at: firstAt });
  expect(first?.ok).toBe(true);
  const firstStored = await readDb(reminderPath);
  expect(firstStored?.note).toBe('client-old');

  const remoteWinner = { at: remoteAt, note: 'remote-newer', updatedAt: Date.now() + 10_000 };
  await putDb(reminderPath, remoteWinner);
  await expect.poll(async () => page.evaluate(id => window.WorkBoardWorkflowV152.reminderFor(id)?.note || '', taskId)).toBe('remote-newer');

  const staleSave = await page.evaluate(({ taskId, at, expected }) => window.WorkBoardWorkflowV152.writeReminder(taskId, { at, note: 'client-stale' }, undefined, expected), { taskId, at: firstAt, expected: firstStored });
  expect(staleSave?.ok).toBe(false);
  expect(staleSave?.conflict).toBe(true);
  expect(await readDb(reminderPath)).toEqual(remoteWinner);
  await expect.poll(async () => page.evaluate(id => window.WorkBoardWorkflowV152.reminderFor(id)?.note || '', taskId)).toBe('remote-newer');

  const staleClear = await page.evaluate(({ taskId, expected }) => window.WorkBoardWorkflowV152.writeReminder(taskId, null, undefined, expected), { taskId, expected: firstStored });
  expect(staleClear?.ok).toBe(false);
  expect(staleClear?.conflict).toBe(true);
  expect(await readDb(reminderPath)).toEqual(remoteWinner);

  const freshSave = await page.evaluate(({ taskId, at, expected }) => window.WorkBoardWorkflowV152.writeReminder(taskId, { at, note: 'client-fresh' }, undefined, expected), { taskId, at: freshAt, expected: remoteWinner });
  expect(freshSave?.ok).toBe(true);
  const stored = await readDb(reminderPath);
  expect(stored?.note).toBe('client-fresh');
  expect(stored?.at).toBe(freshAt);
  expect(Number(stored?.updatedAt || 0)).toBeGreaterThan(0);
});
