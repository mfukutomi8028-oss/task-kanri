import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-e2e';
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

async function bootEmulatorPage(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return productionRequests;
}

async function waitForTask(page, id) {
  await page.waitForFunction(taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId), id, { timeout: 10_000 });
}

async function clickCurrent(page, selector) {
  return page.evaluate(buttonSelector => {
    const button = document.querySelector(buttonSelector);
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  }, selector);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('merges a duplicate task atomically and exposes it through the archive UI', async ({ page }) => {
  const sourceId = 'task-duplicate-source-e2e';
  const targetId = 'task-duplicate-target-e2e';
  const sourceTitle = '重複元タスク';
  const targetTitle = '統合先タスク';
  const now = Date.now();

  await putDb(`rooms/${ROOM}/tasks/${sourceId}`, taskRecord(sourceId, sourceTitle, {
    description: '重複元の説明',
    tags: ['source-tag'],
    comments: [{ id: 'source-comment', author: '森井', text: '重複元コメント', createdAt: now - 3000 }],
    checklist: [{ id: 'source-check', text: '重複元チェック', done: true }],
    pinned: true
  }));
  await putDb(`rooms/${ROOM}/tasks/${targetId}`, taskRecord(targetId, targetTitle, {
    description: '統合先の説明',
    tags: ['target-tag'],
    comments: [{ id: 'target-comment', author: '福冨', text: '統合先コメント', createdAt: now - 2000 }],
    checklist: [{ id: 'target-check', text: '統合先チェック', done: false }]
  }));

  const productionRequests = await bootEmulatorPage(page);
  await waitForTask(page, sourceId);
  await waitForTask(page, targetId);

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.waitForFunction(taskId => Boolean(document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)), sourceId, { timeout: 10_000 });
  const sourceOpened = await clickCurrent(page, `[data-task-id="${sourceId}"]`);
  expect(sourceOpened).toBeTruthy();

  await expect(page.locator('[data-duplicate-target-v153]')).toBeVisible();
  const targetSelected = await page.evaluate(target => {
    const select = document.querySelector('[data-duplicate-target-v153]');
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = target;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value === target;
  }, targetId);
  expect(targetSelected).toBeTruthy();

  page.once('dialog', dialog => dialog.accept());
  const mergeDispatched = await clickCurrent(page, '[data-merge-duplicate-v153]');
  expect(mergeDispatched).toBeTruthy();

  await expect.poll(async () => (await readDb(`rooms/${ROOM}/workflowV152/duplicates/${sourceId}`))?.targetId || '').toBe(targetId);
  await expect.poll(async () => (await readDb(`rooms/${ROOM}/workflowV152/archives/${sourceId}`))?.reason || '').toBe('duplicate');

  const source = await readDb(`rooms/${ROOM}/tasks/${sourceId}`);
  const target = await readDb(`rooms/${ROOM}/tasks/${targetId}`);
  expect(source).toMatchObject({
    status: '完了',
    pinned: false,
    duplicateOf: targetId,
    revision: 2
  });
  expect(Number(source.completedAt || 0)).toBeGreaterThan(0);
  expect(source.completedMemo).toContain(targetTitle);

  expect(target.revision).toBe(2);
  expect(target.description).toContain('統合先の説明');
  expect(target.description).toContain('重複元の説明');
  expect(target.tags).toEqual(expect.arrayContaining(['target-tag', 'source-tag']));
  expect(target.comments.map(item => item.id)).toEqual(expect.arrayContaining(['target-comment', 'source-comment']));
  expect(target.checklist.map(item => item.text)).toEqual(expect.arrayContaining(['統合先チェック', '重複元チェック']));

  await page.waitForFunction(({ source, target }) => {
    const W = window.WorkBoardWorkflowV152;
    return W?.duplicateOf?.(source) === target && W?.isArchived?.(source) === true;
  }, { source: sourceId, target: targetId }, { timeout: 10_000 });

  await page.locator('.nav-filter[data-filter="done"]').click();
  await expect(page.locator('.workflow-archive-context-v153')).toBeVisible();
  await expect(page.locator('.workflow-archive-access-badge-v153')).toHaveText('1');
  await page.locator('[data-open-archive-v153]').click();
  await expect(page.locator('.workflow-archive-modal-v153')).toBeVisible();
  await expect(page.locator('.workflow-archive-modal-v153')).toContainText(sourceTitle);
  await expect(page.locator('.workflow-archive-modal-v153')).toContainText('重複統合');
  await expect(page.locator(`[data-open-canonical-v153="${targetId}"]`)).toBeVisible();

  expect(productionRequests).toEqual([]);
});
