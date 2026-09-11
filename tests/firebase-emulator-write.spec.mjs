import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-e2e';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

// The normal UI regression suite must never start an emulator implicitly.
// This file becomes active only through `npm run test:firebase`.
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
    status: '完了',
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
    completedAt: now,
    completedMemo: '',
    revision: 1,
    ...overrides
  };
}

async function installEmulatorBoundary(page, user = '福冨') {
  const productionRequests = [];

  await page.addInitScript(({ project, room, host, port, userName }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', userName);
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
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, userName: user });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });

  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  return productionRequests;
}

async function bootEmulatorPage(page, user = '福冨') {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page, user);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });

  const runtime = await page.evaluate(() => ({
    roomId: window.WorkBoardWorkflowV152?.ROOM_ID || '',
    workflowState: window.WorkBoardWorkflowV152?.v152State || '',
    connection: document.getElementById('connectionPill')?.textContent || '',
    databaseURL: window.firebaseConfig?.databaseURL || '',
    testHost: window.WORK_BOARD_TEST?.host || '',
    testPort: window.WORK_BOARD_TEST?.port || 0
  }));

  expect(runtime.roomId).toBe(ROOM);
  expect(runtime.workflowState).toBe('ready');
  expect(runtime.connection).toContain('共同編集ON');
  expect(runtime.databaseURL).toBe(`http://${HOST}:${PORT}/?ns=${PROJECT}`);
  expect(runtime.testHost).toBe(HOST);
  expect(runtime.testPort).toBe(PORT);
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);

  return { productionRequests };
}

async function waitForTask(page, id) {
  await page.waitForFunction(taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId), id, { timeout: 10_000 });
}

async function dispatchCurrentButtonClick(page, selector) {
  return page.evaluate(buttonSelector => {
    const button = document.querySelector(buttonSelector);
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, selector);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('boots in remote-online mode against localhost only', async ({ page }) => {
  const { productionRequests } = await bootEmulatorPage(page);

  const remoteAvailable = await page.evaluate(async () => Boolean(await window.WorkBoardWorkflowV152?.ensureV152Remote?.()));
  expect(remoteAvailable).toBeTruthy();
  expect(productionRequests).toEqual([]);

  const roomData = await readDb(`rooms/${ROOM}`);
  expect(roomData).toBeNull();
});

test('archives and restores a completed task through the contextual archive UI', async ({ page }) => {
  const id = 'task-archive-e2e';
  const title = 'Firebase Emulator アーカイブ確認';
  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, title));

  const { productionRequests } = await bootEmulatorPage(page);
  await waitForTask(page, id);

  const archived = await page.evaluate(taskId => window.WorkBoardWorkflowV152.archiveTask(taskId, 'manual'), id);
  expect(archived?.ok).toBeTruthy();

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV152/archives/${id}`)).toMatchObject({
    archivedBy: '福冨',
    reason: 'manual'
  });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.locator('.nav-filter[data-filter="done"]').click();
  await expect(page.locator('.workflow-archive-context-v153')).toBeVisible();
  await expect(page.locator('.workflow-archive-access-badge-v153')).toHaveText('1');

  await page.locator('[data-open-archive-v153]').click();
  await expect(page.locator('.workflow-archive-modal-v153')).toBeVisible();
  await expect(page.locator('.workflow-archive-modal-v153')).toContainText(title);

  // These sidecar lists intentionally re-render while shared state settles.
  // Dispatch the real button's click synchronously in one browser turn so the
  // test follows its production event listener without racing DOM replacement.
  const restoreDispatched = await dispatchCurrentButtonClick(page, `[data-restore-archive-v153="${id}"]`);
  expect(restoreDispatched).toBeTruthy();

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV152/archives/${id}`)).toBeNull();
  await expect(page.locator('.workflow-archive-access-badge-v153')).toHaveText('0');
  expect(productionRequests).toEqual([]);
});

test('writes personal inbox events and persists read state in the emulator', async ({ page }) => {
  const taskId = 'task-inbox-e2e';
  const eventId = 'mention-event-e2e';
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, taskRecord(taskId, '通知テスト', { status: '対応中', completedAt: 0 }));

  const { productionRequests } = await bootEmulatorPage(page);
  await waitForTask(page, taskId);

  const writeResult = await page.evaluate(({ taskIdValue, eventIdValue }) => window.WorkBoardWorkflowV152.writeInboxEvent('福冨', eventIdValue, {
    taskId: taskIdValue,
    type: 'mention',
    title: '@メンションされました',
    body: '森井：エミュレータ通知確認',
    actor: '森井',
    createdAt: Date.now()
  }), { taskIdValue: taskId, eventIdValue: eventId });
  expect(writeResult?.ok).toBeTruthy();

  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.unreadCount?.() === 1, undefined, { timeout: 10_000 });
  await expect(page.locator('[data-open-personal-inbox-v153]')).toBeVisible();
  await expect(page.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');

  await page.locator('[data-open-personal-inbox-v153]').click();
  await expect(page.locator('.workflow-inbox-shell-v153')).toBeVisible();
  await expect(page.locator('.workflow-inbox-shell-v153')).toContainText('@メンションされました');

  const readDispatched = await dispatchCurrentButtonClick(page, `[data-inbox-read-v153="${eventId}"]`);
  expect(readDispatched).toBeTruthy();

  await expect.poll(async () => Number((await readDb(`rooms/${ROOM}/workflowV152/inbox/福冨/${eventId}`))?.readAt || 0)).toBeGreaterThan(0);
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.unreadCount?.() === 0, undefined, { timeout: 10_000 });
  expect(productionRequests).toEqual([]);
});

test('generates an assignee notification from a live task change', async ({ page }) => {
  const taskId = 'task-auto-inbox-e2e';
  const eventId = `assign_${taskId}_2`;
  const initial = taskRecord(taskId, '自動通知テスト', {
    assignee: '森井',
    status: '対応中',
    completedAt: 0,
    createdBy: '森井',
    updatedBy: '森井',
    revision: 1
  });
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, initial);

  const { productionRequests } = await bootEmulatorPage(page);
  await waitForTask(page, taskId);
  await page.waitForTimeout(300);

  await putDb(`rooms/${ROOM}/tasks/${taskId}`, {
    ...initial,
    assignee: '福冨',
    updatedBy: '森井',
    updatedAt: Date.now(),
    revision: 2
  });

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV152/inbox/福冨/${eventId}`), { timeout: 10_000 }).toMatchObject({
    taskId,
    type: 'assign',
    title: '担当になりました',
    body: '自動通知テスト',
    actor: '森井',
    readAt: 0
  });
  await page.waitForFunction(id => Boolean(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]), eventId, { timeout: 10_000 });
  await expect(page.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  expect(productionRequests).toEqual([]);
});

test('keeps one idempotent inbox event when two browser clients write the same event id', async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  const safetyA = await bootEmulatorPage(pageA);
  const safetyB = await bootEmulatorPage(pageB);
  const eventId = 'shared-event-e2e';

  const [resultA, resultB] = await Promise.all([
    pageA.evaluate(id => window.WorkBoardWorkflowV152.writeInboxEvent('福冨', id, {
      taskId: 'task-shared-e2e', type: 'comment', title: '同時通知', body: 'client-a', actor: '森井', createdAt: 1001
    }), eventId),
    pageB.evaluate(id => window.WorkBoardWorkflowV152.writeInboxEvent('福冨', id, {
      taskId: 'task-shared-e2e', type: 'comment', title: '同時通知', body: 'client-b', actor: '森井', createdAt: 1002
    }), eventId)
  ]);

  expect(resultA?.ok).toBeTruthy();
  expect(resultB?.ok).toBeTruthy();

  const stored = await readDb(`rooms/${ROOM}/workflowV152/inbox/福冨/${eventId}`);
  expect(stored).toBeTruthy();
  expect(['client-a', 'client-b']).toContain(stored.body);
  expect(stored.readAt).toBe(0);

  await pageA.waitForFunction(id => Boolean(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]), eventId, { timeout: 10_000 });
  await pageB.waitForFunction(id => Boolean(window.WorkBoardWorkflowV152?.inboxFor?.()?.[id]), eventId, { timeout: 10_000 });
  expect(safetyA.productionRequests).toEqual([]);
  expect(safetyB.productionRequests).toEqual([]);

  await pageA.close();
  await pageB.close();
});