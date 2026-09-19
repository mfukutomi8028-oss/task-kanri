import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-work-features-audit-v244';
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

function memoRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: '監査メモ',
    body: '監査本文',
    category: '手順',
    tags: ['監査'],
    pinned: false,
    revision: 1,
    createdAt: now - 5000,
    updatedAt: now,
    createdBy: '福冨',
    updatedBy: '福冨',
    ...overrides
  };
}

function taskRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: '予約タスク監査',
    description: '開始日保護の監査',
    status: '未着手',
    priority: '中',
    assignee: '福冨',
    dueDate: '2099-12-31',
    revision: 1,
    createdAt: now - 5000,
    updatedAt: now,
    updatedBy: '福冨',
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
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 30_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
}

async function click(page, selector) {
  const ok = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(ok).toBeTruthy();
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.244 product: stale business-memo revision is rejected and cannot overwrite the remote winner', async ({ page }) => {
  test.slow();
  const id = 'memo-stale-v244';
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, memoRecord(id));
  await boot(page);
  await click(page, '[data-work-memo-layout]');
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await click(page, `[data-memo-edit="${id}"]`);
  await expect(page.locator('#workMemoRevisionV167')).toHaveValue('1');

  const remoteWinner = memoRecord(id, {
    title: '別端末の更新',
    body: '別端末が先に保存した本文',
    revision: 2,
    updatedAt: Date.now() + 1000,
    updatedBy: '別端末'
  });
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, remoteWinner);
  await expect.poll(() => readDb(`rooms/${ROOM}/businessMemos/${id}`)).toMatchObject({ revision: 2, title: '別端末の更新' });

  await page.locator('#workMemoTitleV167').fill('古い画面からの上書き');
  await page.locator('#workMemoBodyV167').fill('この内容は保存されてはいけない');
  await click(page, '#workMemoFormV167 button[type="submit"]');

  await expect.poll(() => readDb(`rooms/${ROOM}/businessMemos/${id}`)).toMatchObject({
    revision: 2,
    title: '別端末の更新',
    body: '別端末が先に保存した本文',
    updatedBy: '別端末'
  });
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('別のユーザー');
});

test('Ver.244 product: guarded orphan cleanup removes a start record when the canonical task is absent', async ({ page }) => {
  test.slow();
  await boot(page);
  const id = 'orphan-start-v244';
  await putDb(`rooms/${ROOM}/taskStarts/${id}`, {
    date: '2099-12-31',
    revision: 7,
    updatedAt: Date.now(),
    updatedBy: '別端末'
  });

  await expect.poll(() => readDb(`rooms/${ROOM}/taskStarts/${id}`), { timeout: 20_000 }).toBeNull();
  expect(await readDb(`rooms/${ROOM}/tasks/${id}`)).toBeNull();
});

test('Ver.244 product: guarded orphan cleanup preserves a start record while the canonical task exists', async ({ page }) => {
  test.slow();
  const id = 'valid-start-v244';
  const start = {
    date: '2099-12-30',
    revision: 9,
    updatedAt: Date.now(),
    updatedBy: '別端末'
  };
  await putDb(`rooms/${ROOM}/tasks/${id}`, taskRecord(id));
  await putDb(`rooms/${ROOM}/taskStarts/${id}`, start);

  await boot(page);
  await page.waitForTimeout(750);

  expect(await readDb(`rooms/${ROOM}/tasks/${id}`)).toMatchObject({ id, revision: 1 });
  expect(await readDb(`rooms/${ROOM}/taskStarts/${id}`)).toMatchObject({ date: start.date, revision: 9, updatedBy: '別端末' });
});
