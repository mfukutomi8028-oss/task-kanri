import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-work-features-e2e';
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

function memoRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: 'Emulator 業務メモ',
    body: '共有メモ本文',
    category: '手順',
    tags: ['Emulator', '共有'],
    pinned: false,
    revision: 1,
    createdAt: now - 10_000,
    updatedAt: now,
    createdBy: '福冨',
    updatedBy: '福冨',
    ...overrides
  };
}

function futureIso(days = 5) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function bootBoard(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 30_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { productionRequests, pageErrors };
}

async function openMemoMode(page) {
  await clickCurrent(page, '[data-work-memo-layout]');
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
}

async function readMemo(id) {
  return readDb(`rooms/${ROOM}/businessMemos/${id}`);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('adds a shared business memo through the real dialog and persists revision metadata', async ({ page }) => {
  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await clickCurrent(page, '#workMemoViewV167 [data-memo-new]');

  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoTitleV167').fill('Emulator メモ追加確認');
  await page.locator('#workMemoCategoryV167').selectOption({ label: '手順' });
  await page.locator('#workMemoTagsV167').fill('Emulator, 手順');
  await page.locator('#workMemoBodyV167').fill('業務メモの追加をRTDBへ保存する');
  await page.locator('#workMemoPinnedV167').check();
  await clickCurrent(page, '#workMemoFormV167 button[type="submit"]');

  const records = await expect.poll(async () => readDb(`rooms/${ROOM}/businessMemos`) || {}, { timeout: 20_000 })
    .toSatisfy(value => Object.values(value).some(memo => memo?.title === 'Emulator メモ追加確認'));

  const all = await readDb(`rooms/${ROOM}/businessMemos`) || {};
  const [id, stored] = Object.entries(all).find(([, memo]) => memo?.title === 'Emulator メモ追加確認');
  expect(stored).toMatchObject({
    id,
    title: 'Emulator メモ追加確認',
    body: '業務メモの追加をRTDBへ保存する',
    category: '手順',
    tags: ['Emulator', '手順'],
    pinned: true,
    revision: 1,
    createdBy: '福冨',
    updatedBy: '福冨'
  });
  expect(Number(stored.createdAt)).toBeGreaterThan(0);
  expect(Number(stored.updatedAt)).toBeGreaterThan(0);
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').filter({ hasText: 'Emulator メモ追加確認' })).toBeVisible();
  expect(productionRequests).toEqual([]);
});

test('edits a shared business memo through the real dialog and increments revision', async ({ page }) => {
  const id = 'memo-edit-e2e';
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, memoRecord(id, { title: '編集前メモ', body: '編集前本文' }));

  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await clickCurrent(page, `[data-memo-edit="${id}"]`);

  await page.locator('#workMemoTitleV167').fill('編集後メモ');
  await page.locator('#workMemoBodyV167').fill('編集後本文');
  await page.locator('#workMemoCategoryV167').selectOption({ label: 'URL・リンク' });
  await clickCurrent(page, '#workMemoFormV167 button[type="submit"]');

  await expect.poll(() => readMemo(id), { timeout: 20_000 }).toMatchObject({
    id,
    title: '編集後メモ',
    body: '編集後本文',
    category: 'URL・リンク',
    revision: 2,
    updatedBy: '福冨'
  });
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').filter({ hasText: '編集後メモ' })).toBeVisible();
  expect(productionRequests).toEqual([]);
});

test('deletes a shared business memo through the real confirmation flow', async ({ page }) => {
  const id = 'memo-delete-e2e';
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, memoRecord(id, { title: '削除対象メモ' }));

  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await clickCurrent(page, `[data-memo-edit="${id}"]`);
  await expect(page.locator('#workMemoDeleteV167')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await clickCurrent(page, '#workMemoDeleteV167');
  await expect.poll(() => readMemo(id), { timeout: 20_000 }).toBeNull();
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toHaveCount(0);
  expect(productionRequests).toEqual([]);
});

test('saves a future task start date and exposes the task only through the reserved-task UI', async ({ page }) => {
  const { productionRequests } = await bootBoard(page);
  const title = 'Emulator 予約タスク確認';
  const startDate = futureIso(5);

  await clickCurrent(page, '#newTask');
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeVisible();
  await page.locator('#taskTitle').fill(title);
  await page.locator('#taskStartDateV167').fill(startDate);
  await page.locator('#taskForm button[type="submit"]').click();

  const task = await expect.poll(async () => {
    const tasks = await readDb(`rooms/${ROOM}/tasks`) || {};
    const entry = Object.entries(tasks).find(([, value]) => value?.title === title);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }, { timeout: 25_000 }).toMatchObject({ title, createdBy: '福冨' });

  const tasks = await readDb(`rooms/${ROOM}/tasks`) || {};
  const [taskId] = Object.entries(tasks).find(([, value]) => value?.title === title);
  await expect.poll(() => readDb(`rooms/${ROOM}/taskStarts/${taskId}`), { timeout: 25_000 }).toMatchObject({
    date: startDate,
    revision: 1,
    updatedBy: '福冨'
  });

  const reservedButton = page.locator('[data-reserved-task-open]');
  await expect(reservedButton).toBeVisible({ timeout: 30_000 });
  await expect(reservedButton).toContainText('1');
  await clickCurrent(page, '[data-reserved-task-open]');
  await expect(page.locator('#reservedTaskDialogV167')).toBeVisible();
  const reservedCard = page.locator('#reservedTaskListV167').filter({ hasText: title });
  await expect(reservedCard).toContainText(title);
  await expect(page.locator(`#reservedTaskListV167 [data-reserved-date="${taskId}"]`)).toHaveValue(startDate);

  expect(productionRequests).toEqual([]);
});
