import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-schedule-copy-v225';
const HOST = '127.0.0.1';
const PORT = 9000;
const SOURCE_ID = 'schedule-copy-source-v225';
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
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

function localIsoDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sourceRecord() {
  const start = new Date();
  start.setHours(10, 15, 0, 0);
  const end = new Date(start.getTime() + 75 * 60 * 1000);
  const now = Date.now();
  return {
    id: SOURCE_ID,
    title: 'Firebase コピー元予定',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    assignee: '福冨',
    location: '会議室B',
    category: 'その他',
    memo: '一括コピー検証',
    relatedTaskId: '',
    revision: 4,
    createdAt: now - 60_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨'
  };
}

async function installEmulatorBoundary(page, sourceDate) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port, date }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-schedule-range:${room}`, 'today');
    localStorage.setItem(`system-task-schedule-anchor:${room}`, date);
    localStorage.setItem(`system-task-schedule-display-mode:${room}`, 'list');

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
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, date: sourceDate });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return productionRequests;
}

async function boot(page, sourceDate) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page, sourceDate);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '225', undefined, { timeout: 10_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return productionRequests;
}

async function setDate(page, selector, value) {
  await page.locator(selector).evaluate((input, next) => {
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('copies multiple explicit dates atomically into Firebase without changing the source revision', async ({ page }) => {
  const source = sourceRecord();
  const sourceDate = localIsoDate(new Date(source.startAt));
  await putDb(`rooms/${ROOM}/schedules/${SOURCE_ID}`, source);

  const productionRequests = await boot(page, sourceDate);
  await page.locator('.nav-item[data-layout="schedule"]').click();
  await expect(page.locator(`[data-schedule-id="${SOURCE_ID}"]`)).toBeVisible({ timeout: 20_000 });
  await page.locator(`[data-schedule-id="${SOURCE_ID}"]`).click();
  await page.locator('#copySchedule').click();
  await expect(page.locator('#scheduleCopyDialog')).toBeVisible();

  await page.locator('#scheduleCopyMethod').selectOption('dates');
  const base = new Date(source.startAt);
  const targets = [2, 5, 9].map(offset => {
    const date = new Date(base);
    date.setDate(date.getDate() + offset);
    return localIsoDate(date);
  });
  for (const date of targets) {
    await setDate(page, '#scheduleCopyDateInput', date);
    await page.locator('#scheduleCopyAddDate').click();
  }
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveText('3件の予定を作成');
  await page.locator('#scheduleCopySubmit').click();
  await expect(page.locator('#toast')).toContainText('3件の予定をコピーしました');

  await expect.poll(async () => Object.keys((await readDb(`rooms/${ROOM}/schedules`)) || {}).length, { timeout: 15_000 }).toBe(4);
  const schedules = await readDb(`rooms/${ROOM}/schedules`);
  expect(schedules[SOURCE_ID].revision).toBe(4);
  expect(schedules[SOURCE_ID].startAt).toBe(source.startAt);

  const copies = Object.entries(schedules).filter(([id]) => id !== SOURCE_ID).map(([, value]) => value);
  expect(copies).toHaveLength(3);
  const copiedDates = copies.map(item => localIsoDate(new Date(item.startAt))).sort();
  expect(copiedDates).toEqual([...targets].sort());

  for (const item of copies) {
    expect(item.revision).toBe(1);
    expect(item.title).toBe(source.title);
    expect(item.assignee).toBe(source.assignee);
    expect(item.location).toBe(source.location);
    expect(item.category).toBe(source.category);
    expect(item.memo).toBe(source.memo);
    expect(item.relatedTaskId || '').toBe(source.relatedTaskId);
    expect(new Date(item.endAt).getTime() - new Date(item.startAt).getTime()).toBe(75 * 60 * 1000);
    expect(new Date(item.startAt).getHours()).toBe(new Date(source.startAt).getHours());
    expect(new Date(item.startAt).getMinutes()).toBe(new Date(source.startAt).getMinutes());
  }
  expect(productionRequests).toEqual([]);
});
