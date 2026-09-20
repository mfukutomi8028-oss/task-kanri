import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-workflow-inbox-audit-v247';
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

function inboxEvent(taskId, body, createdAt, readAt = 0) {
  return {
    taskId,
    type: 'comment',
    title: 'コメントが追加されました',
    body,
    actor: '森井',
    createdAt,
    readAt
  };
}

async function boot(page) {
  const pageErrors = [];
  const productionRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
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

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return productionRequests;
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.247 product: mark-all preserves later arrivals and stale read toggles preserve the remote winner', async ({ page }) => {
  const user = '福冨';
  const oldId = 'visible-before-click-v247';
  const newId = 'arrives-after-click-v247';
  const staleId = 'stale-read-toggle-v247';
  const basePath = `rooms/${ROOM}/workflowV152/inbox/${user}`;

  await putDb(`${basePath}/${oldId}`, inboxEvent('task-old-v247', 'クリック前に表示済み', 1001));
  const productionRequests = await boot(page);
  await page.waitForFunction(id => Boolean(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]), oldId, { timeout: 10_000 });
  expect(await page.evaluate(() => window.WorkBoardWorkflowV152.unreadCount())).toBe(1);

  const started = await page.evaluate(async id => {
    const W = window.WorkBoardWorkflowV152;
    const remote = await W.ensureV152Remote();
    remote.goOffline(remote.db);
    window.__v247MarkAllPending = W.markAllInboxRead();
    const local = W.inboxFor()[id];
    return { readAt: Number(local?.readAt || 0), unread: W.unreadCount() };
  }, oldId);
  expect(started.readAt).toBeGreaterThan(0);
  expect(started.unread).toBe(0);

  await putDb(`${basePath}/${newId}`, inboxEvent('task-new-v247', 'クリック後に到着した未表示通知', 2002));
  expect(Number((await readDb(`${basePath}/${newId}`))?.readAt || 0)).toBe(0);

  const result = await page.evaluate(async () => {
    const W = window.WorkBoardWorkflowV152;
    const remote = await W.ensureV152Remote();
    remote.goOnline(remote.db);
    const outcome = await window.__v247MarkAllPending;
    delete window.__v247MarkAllPending;
    return outcome;
  });
  expect(result).toMatchObject({ ok: true, count: 1, conflicts: 0 });

  const oldStored = await readDb(`${basePath}/${oldId}`);
  const newStored = await readDb(`${basePath}/${newId}`);
  expect(Number(oldStored?.readAt || 0)).toBeGreaterThan(0);
  expect(Number(newStored?.readAt || 0)).toBe(0);
  await page.waitForFunction(id => Number(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]?.readAt || 0) === 0, newId, { timeout: 10_000 });
  expect(await page.evaluate(() => window.WorkBoardWorkflowV152.unreadCount())).toBe(1);

  const initialReadAt = 3003;
  const remoteWinnerReadAt = 4004;
  await putDb(`${basePath}/${staleId}`, inboxEvent('task-stale-v247', '既読状態の競合確認', 3003, initialReadAt));
  await page.waitForFunction(({ id, readAt }) => Number(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]?.readAt || 0) === readAt, { id: staleId, readAt: initialReadAt }, { timeout: 10_000 });

  await putDb(`${basePath}/${staleId}`, inboxEvent('task-stale-v247', '既読状態の競合確認', 3003, remoteWinnerReadAt));
  const stale = await page.evaluate(({ id, expected }) => window.WorkBoardWorkflowV152.markInboxRead(id, false, undefined, expected), { id: staleId, expected: initialReadAt });
  expect(stale).toMatchObject({ ok: false, conflict: true });
  expect(Number((await readDb(`${basePath}/${staleId}`))?.readAt || 0)).toBe(remoteWinnerReadAt);
  await page.waitForFunction(({ id, readAt }) => Number(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]?.readAt || 0) === readAt, { id: staleId, readAt: remoteWinnerReadAt }, { timeout: 10_000 });

  const fresh = await page.evaluate(({ id, expected }) => window.WorkBoardWorkflowV152.markInboxRead(id, false, undefined, expected), { id: staleId, expected: remoteWinnerReadAt });
  expect(fresh?.ok).toBe(true);
  expect(Number((await readDb(`${basePath}/${staleId}`))?.readAt || 0)).toBe(0);
  expect(productionRequests).toEqual([]);
});
