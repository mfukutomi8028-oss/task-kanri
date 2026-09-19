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
    content: '監査用',
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

async function boot(page, { patchBulkSource } = {}) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);

  if (patchBulkSource) {
    await page.route('**/bulk-actions-v174.js*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      const next = patchBulkSource(source);
      expect(next).not.toBe(source);
      await route.fulfill({ response, body: next, contentType: 'application/javascript' });
    });
  }

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.classList.contains('remote-online'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '242', undefined, { timeout: 8_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  expect(await page.evaluate(() => window.__WB_BULK_DELETE_V175__?.version || '')).toBe('175');
  return productionRequests;
}

async function waitForTask(page, id) {
  await page.waitForFunction(
    taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId),
    id,
    { timeout: 30_000 }
  );
}

async function openList(page) {
  // Sidebar pointer/focus behavior has separate coverage. Use the product's real
  // click handlers without hit-testing so these cases isolate bulk/Firebase ownership.
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(button => button.click());
  await page.locator('[data-task-layout="list"]').evaluate(button => button.click());
  await expect(page.locator('#listView')).toBeVisible();
}

function rowById(page, id) {
  return page.locator(`#listView tr[data-task-id="${id}"]`);
}

async function selectOne(page, id) {
  const row = rowById(page, id);
  await expect(row).toHaveCount(1);
  // Selection semantics are the target here, not sidebar hit-testing. Trigger the
  // same change listener directly so the desktop overlay cannot mask this audit.
  await row.locator('[data-bulk-id]').evaluate(input => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#listView [data-bulk-bar]')).toBeVisible();
}

async function applyBulk(page) {
  await page.locator('#listView [data-bulk-apply]').evaluate(button => button.click());
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.243 audit: remote non-delete bulk currently aborts on the unsubscribed room transaction cache', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-status-v243';
  const unrelatedId = 'task-bulk-status-unrelated-v243';
  const original = taskRecord(id, '一括状態変更', { revision: 3 });
  const unrelated = taskRecord(unrelatedId, '無関係タスク', { revision: 7, customAuditField: 'keep-me' });
  await putDb(`rooms/${ROOM}/tasks/${id}`, original);
  await putDb(`rooms/${ROOM}/tasks/${unrelatedId}`, unrelated);
  const storedOriginal = await readDb(`rooms/${ROOM}/tasks/${id}`);
  const storedUnrelated = await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`);

  await boot(page);
  await waitForTask(page, id);
  await openList(page);
  await selectOne(page, id);

  await page.locator('#listView [data-bulk-action]').selectOption('status');
  await page.locator('#listView [data-bulk-target]').selectOption('保留');
  await applyBulk(page);

  await expect(page.locator('#toast')).toContainText('他の更新と競合しました。最新内容を確認してください');
  expect(await readDb(`rooms/${ROOM}/tasks/${id}`)).toEqual(storedOriginal);
  expect(await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`)).toEqual(storedUnrelated);
});

test('Ver.243 audit: remote bulk delete uses the active sidecar and cleans task-owned schedule and knowledge records', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-delete-v243';
  const scheduleId = 'schedule-bulk-delete-v243';
  const knowledgeId = 'knowledge-bulk-delete-v243';
  const unrelatedId = 'task-bulk-delete-unrelated-v243';
  const unrelated = taskRecord(unrelatedId, '無関係タスク', { revision: 5, customAuditField: 'untouched' });

  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, '一括削除', { knowledgeId, revision: 2 }));
  await putDb(`rooms/${ROOM}/tasks/${unrelatedId}`, unrelated);
  await putDb(`rooms/${ROOM}/schedules/${scheduleId}`, scheduleRecord(scheduleId, id, { revision: 4 }));
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, knowledgeRecord(knowledgeId, id, { revision: 6 }));
  const storedUnrelated = await readDb(`rooms/${ROOM}/tasks/${unrelatedId}`);

  await boot(page);
  await waitForTask(page, id);
  await openList(page);
  await selectOne(page, id);
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

test('Ver.243 audit: legacy cleanup reproduces knowledge ownership loss when the original knowledge id is reassigned after task deletion', async ({ page }) => {
  test.slow();
  const id = 'task-bulk-ownership-race-v243';
  const otherId = 'task-bulk-ownership-new-owner-v243';
  const knowledgeId = 'knowledge-bulk-ownership-race-v243';

  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id, '所有権競合削除', { knowledgeId, revision: 2 }));
  await putDb(`rooms/${ROOM}/tasks/${otherId}`, taskRecord(otherId, '新所有者', { revision: 8 }));
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, knowledgeRecord(knowledgeId, id, { revision: 3 }));

  const needle = "const cleanupWarnings = await cleanupRelations(api, id, String(base?.knowledgeId || ''));";
  await boot(page, {
    patchBulkSource: source => source.replace(needle, `
      window.__WB_BULK_AUDIT_BEFORE_CLEANUP__ = id;
      while (!window.__WB_BULK_AUDIT_CONTINUE__) await new Promise(resolve => setTimeout(resolve, 10));
      ${needle}`)
  });
  await waitForTask(page, id);
  await openList(page);
  await selectOne(page, id);
  await page.locator('#listView [data-bulk-action]').selectOption('delete');
  page.once('dialog', dialog => dialog.accept());
  await applyBulk(page);

  await page.waitForFunction(taskId => window.__WB_BULK_AUDIT_BEFORE_CLEANUP__ === taskId, id, { timeout: 15_000 });
  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${id}`)).toBeNull();

  const reassigned = knowledgeRecord(knowledgeId, otherId, {
    revision: 9,
    title: '別タスクへ再割当済み',
    content: 'このレコードは新所有者のもの'
  });
  await putDb(`rooms/${ROOM}/knowledge/${knowledgeId}`, reassigned);
  await putDb(`rooms/${ROOM}/tasks/${otherId}`, taskRecord(otherId, '新所有者', { knowledgeId, revision: 9 }));
  expect(await readDb(`rooms/${ROOM}/knowledge/${knowledgeId}`)).toMatchObject({ taskId: otherId, revision: 9 });

  await page.evaluate(() => { window.__WB_BULK_AUDIT_CONTINUE__ = true; });

  // This is the audited defect: the legacy sidecar deletes by the old knowledge id
  // even though the record now belongs to a different task.
  await expect.poll(() => readDb(`rooms/${ROOM}/knowledge/${knowledgeId}`)).toBeNull();
  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${otherId}`)).toMatchObject({ knowledgeId, revision: 9 });
});
