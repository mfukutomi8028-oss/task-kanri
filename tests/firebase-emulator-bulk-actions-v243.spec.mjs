import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-bulk-actions-v243';
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
    knowledgeId: '',
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

function scheduleRecord(id, relatedTaskId, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: '関連予定',
    startAt: new Date(now + 3_600_000).toISOString(),
    endAt: new Date(now + 7_200_000).toISOString(),
    assignee: '福冨',
    location: '',
    category: 'その他',
    memo: '',
    relatedTaskId,
    createdAt: now - 10_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    revision: 1,
    ...overrides
  };
}

function knowledgeRecord(id, taskId, overrides = {}) {
  const now = Date.now();
  return {
    id,
    taskId,
    title: '関連ナレッジ',
    content: '製品確認用',
    tags: [],
    createdAt: now - 10_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
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
  await page.waitForFunction(() => document.getElementById('connectionPill')?.classList.contains('remote-online'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 243, undefined, { timeout: 8_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  expect(await page.evaluate(() => window.WorkBoardBulkV243?.version || '')).toBe('243');
  expect(await page.evaluate(() => Boolean(window.__WB_BULK_DELETE_V175__))).toBe(false);
}

async function waitForTask(page, id) {
  await page.waitForFunction(
    taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId),
    id,
    { timeout: 30_000 }
  );
}

async function waitForKnowledgeCache(page, id, taskId) {
  await page.waitForFunction(({ room, knowledgeId, ownerId }) => {
    try {
      const records = JSON.parse(localStorage.getItem(`system-task-knowledge:${room}`) || '[]');
      return Array.isArray(records) && records.some(item => item?.id === knowledgeId && item?.taskId === ownerId);
    } catch { return false; }
  }, { room: ROOM, knowledgeId: id, ownerId: taskId }, { timeout: 30_000 });
}

async function openList(page) {
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(button => button.click());
  await page.locator('[data-task-layout="list"]').evaluate(button => button.click());
  await expect(page.locator('#listView')).toBeVisible();
}

function rowById(page, id) {
  return page.locator(`#listView tr[data-task-id="${id}"]`);
}

async function selectMany(page, ids) {
  for (const id of ids) {
    const row = rowById(page, id);
    await expect(row).toHaveCount(1);
    await row.locator('[data-bulk-id]').evaluate(input => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  await expect(page.locator('#listView [data-bulk-bar]')).toBeVisible();
}

async function applyBulk(page) {
  await page.locator('#listView [data-bulk-apply]').evaluate(button => button.click());
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.243 product: remote non-delete bulk commits atomically on tasks and preserves unrelated records', async ({ page }) => {
  test.slow();
  const firstId = 'task-bulk-status-a-v243';
  const secondId = 'task-bulk-status-b-v243';
  const unrelatedId = 'task-bulk-status-unrelated-v243';

  await boot(page);
  await putDb(`rooms/${ROOM}/tasks/${firstId}`, taskRecord(firstId, '一括状態変更A', { revision: 3 }));
  await putDb(`rooms/${ROOM}/tasks/${secondId}`, taskRecord(secondId, '一括状態変更B', { revision: 4 }));
  await putDb(`rooms/${ROOM}/tasks/${unrelatedId}`, taskRecord(unrelatedId, '無関係タスク', { revision: 7, customAuditField: 'keep-me' }));
  const storedUnrelated = await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`);

  await waitForTask(page, firstId);
  await waitForTask(page, secondId);
  await openList(page);
  await selectMany(page, [firstId, secondId]);
  await page.locator('#listView [data-bulk-action]').selectOption('status');
  await page.locator('#listView [data-bulk-target]').selectOption('保留');
  await applyBulk(page);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${firstId}`)).toMatchObject({ status: '保留', revision: 4, updatedBy: '福冨' });
  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${secondId}`)).toMatchObject({ status: '保留', revision: 5, updatedBy: '福冨' });
  const first = await readDb(`rooms/${ROOM}/tasks/${firstId}`);
  expect(first.history?.at(-1)?.text).toBe('一括操作で状態を変更しました。');
  expect(first.lastChange).toMatchObject({ label: '状態変更' });
  expect(await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`)).toEqual(storedUnrelated);
});

test('Ver.243 product: remote bulk complete preserves recurring-child semantics', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-recurring-v243';
  const dueDate = '2026-09-20';
  const nextDate = '2026-09-21';
  const childId = `rec-${id}-${nextDate}`;

  await boot(page);
  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, '定期一括完了', {
    revision: 2,
    dueDate,
    recurrence: 'daily',
    recurrenceRule: { interval: 1 }
  }));

  await waitForTask(page, id);
  await openList(page);
  await selectMany(page, [id]);
  await page.locator('#listView [data-bulk-action]').selectOption('complete');
  await applyBulk(page);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${id}`)).toMatchObject({
    status: '完了',
    revision: 3,
    nextRecurringTaskId: childId
  });
  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${childId}`)).toMatchObject({
    id: childId,
    status: '未着手',
    dueDate: nextDate,
    recurringParentId: id,
    revision: 1,
    operationId: childId
  });
});

test('Ver.243 product: remote bulk delete delegates to canonical cleanup for owned schedule and knowledge', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-delete-v243';
  const scheduleId = 'schedule-bulk-delete-v243';
  const knowledgeId = 'knowledge-bulk-delete-v243';
  const unrelatedId = 'task-bulk-delete-unrelated-v243';
  const unrelated = taskRecord(unrelatedId, '無関係タスク', { revision: 5, customAuditField: 'untouched' });

  await boot(page);
  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, '一括削除', { knowledgeId, revision: 2 }));
  await putDb(`rooms/${ROOM}/tasks/${unrelatedId}`, unrelated);
  await putDb(`rooms/${ROOM}/schedules/${scheduleId}`, scheduleRecord(scheduleId, id, { revision: 4 }));
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, knowledgeRecord(knowledgeId, id, { revision: 6 }));
  const storedUnrelated = await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`);

  await waitForTask(page, id);
  await openList(page);
  await selectMany(page, [id]);
  await page.locator('#listView [data-bulk-action]').selectOption('delete');
  page.once('dialog', dialog => dialog.accept());
  await applyBulk(page);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${id}`)).toBeNull();
  await expect.poll(() => readDb(`rooms/${ROOM}/schedules/${scheduleId}`)).toMatchObject({
    id: scheduleId,
    relatedTaskId: '',
    revision: 5,
    updatedBy: '福冨'
  });
  await expect.poll(() => readDb(`rooms/${ROOM}/knowledge/${knowledgeId}`)).toBeNull();
  expect(await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`)).toEqual(storedUnrelated);
});

test('Ver.243 product: reassigned knowledge is preserved and canonical ownership mismatch blocks deletion', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-ownership-v243';
  const otherId = 'task-bulk-ownership-new-owner-v243';
  const knowledgeId = 'knowledge-bulk-ownership-v243';

  await boot(page);
  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, '所有権競合削除', { knowledgeId, revision: 2 }));
  await putDb(`rooms/${ROOM}/tasks/${otherId}`, taskRecord(otherId, '新所有者', { revision: 8 }));
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, knowledgeRecord(knowledgeId, id, { revision: 3 }));

  await waitForTask(page, id);
  await openList(page);

  const reassigned = knowledgeRecord(knowledgeId, otherId, {
    revision: 9,
    title: '別タスクへ再割当済み',
    content: 'このレコードは新所有者のもの'
  });
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, reassigned);
  await putDb(`rooms/${ROOM}/tasks/${otherId}`, taskRecord(otherId, '新所有者', { knowledgeId, revision: 9 }));
  await waitForKnowledgeCache(page, knowledgeId, otherId);

  await selectMany(page, [id]);
  await page.locator('#listView [data-bulk-action]').selectOption('delete');
  page.once('dialog', dialog => dialog.accept());
  await applyBulk(page);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${id}`)).toMatchObject({ id, knowledgeId, revision: 2 });
  await expect.poll(() => readDb(`rooms/${ROOM}/knowledge/${knowledgeId}`)).toMatchObject({
    id: knowledgeId,
    taskId: otherId,
    revision: 9,
    title: '別タスクへ再割当済み'
  });
  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${otherId}`)).toMatchObject({ knowledgeId, revision: 9 });
  await expect(page.locator('#workflowToastV148')).toContainText('未削除', { timeout: 20_000 });
});
