import { test, expect } from '@playwright/test';

const ROOM = 'test-schedule-copy-v225';
const PROJECT_ID = 'demo-task-kanri';
const DATABASE_HOST = '127.0.0.1';
const DATABASE_PORT = 9000;
const PROD_DATABASE_RE = /(?:firebasedatabase\.app|firebaseio\.com)/i;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function localDateTime(date, hour, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  const offset = next.getTimezoneOffset();
  const adjusted = new Date(next.getTime() - offset * 60000);
  return adjusted.toISOString().slice(0, 16);
}

async function clearRoom() {
  const url = `http://${DATABASE_HOST}:${DATABASE_PORT}/rooms/${ROOM}.json?ns=${PROJECT_ID}`;
  const response = await fetch(url, { method: 'DELETE' });
  expect(response.ok).toBeTruthy();
}

async function readRoom() {
  const url = `http://${DATABASE_HOST}:${DATABASE_PORT}/rooms/${ROOM}.json?ns=${PROJECT_ID}`;
  const response = await fetch(url);
  expect(response.ok).toBeTruthy();
  return await response.json();
}

async function seedRoom(sourceDate) {
  const start = localDateTime(sourceDate, 10, 30);
  const end = localDateTime(sourceDate, 11, 45);
  const payload = {
    schedules: {
      'source-schedule': {
        id: 'source-schedule',
        title: 'コピー元予定',
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        assignee: '福冨',
        location: '会議室A',
        category: '定期作業',
        memo: 'コピー元メモ',
        relatedTaskId: 'related-task-1',
        revision: 7,
        createdAt: Date.now() - 60_000,
        createdBy: '福冨',
        updatedAt: Date.now() - 30_000,
        updatedBy: '福冨'
      }
    },
    tasks: {
      'related-task-1': {
        id: 'related-task-1',
        title: '関連タスク',
        status: '未着手',
        priority: '中',
        assignee: '福冨',
        category: '定期作業',
        tags: [],
        description: '',
        checklist: [],
        comments: [],
        revision: 1,
        createdAt: Date.now() - 60_000,
        createdBy: '福冨',
        updatedAt: Date.now() - 30_000,
        updatedBy: '福冨'
      }
    }
  };
  const url = `http://${DATABASE_HOST}:${DATABASE_PORT}/rooms/${ROOM}.json?ns=${PROJECT_ID}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  expect(response.ok).toBeTruthy();
}

async function installEmulatorBoundary(page, sourceDate) {
  const productionRequests = [];
  await page.addInitScript(({ projectId, host, port, sourceIso }) => {
    window.__WORK_BOARD_TEST_EMULATOR__ = { projectId, host, port };
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', 'test-schedule-copy-v225');
    localStorage.setItem('systemTaskScheduleAnchor:test-schedule-copy-v225', sourceIso);
    localStorage.setItem('systemTaskScheduleRange:test-schedule-copy-v225', 'today');
    localStorage.setItem('systemTaskScheduleDisplayMode:test-schedule-copy-v225', 'list');
  }, { projectId: PROJECT_ID, host: DATABASE_HOST, port: DATABASE_PORT, sourceIso: toIsoDate(sourceDate) });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (PROD_DATABASE_RE.test(url)) return route.abort('blockedbyclient');
    return route.continue();
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
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 10_000 });
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

async function openSourceSchedule(page) {
  await page.locator('[data-layout="schedule"]').click();
  const source = page.locator('[data-schedule-id="source-schedule"]').first();
  await expect(source).toBeVisible();
  await source.click();
  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await page.locator('#copySchedule').click();
  await expect(page.locator('#scheduleCopyDialog')).toHaveAttribute('open', '');
}

test.beforeEach(async () => {
  await clearRoom();
});

test('copies multiple explicit dates atomically into Firebase without changing the source revision', async ({ page }) => {
  const sourceDate = new Date();
  sourceDate.setHours(0, 0, 0, 0);
  await seedRoom(sourceDate);
  const productionRequests = await boot(page, sourceDate);
  await openSourceSchedule(page);

  await page.locator('#scheduleCopyMethod').selectOption('dates');
  const dates = [1, 3, 5].map(offset => toIsoDate(addDays(sourceDate, offset)));
  for (const date of dates) {
    await setDate(page, '#scheduleCopyDateInput', date);
    await page.locator('#scheduleCopyAddDate').click();
  }
  await expect(page.locator('#scheduleCopyPreviewSummary')).toContainText('3件の予定を作成');
  await page.locator('#scheduleCopySubmit').click();
  await expect(page.locator('#scheduleCopyDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('#toast')).toContainText('3件の予定をコピーしました');

  await expect.poll(async () => {
    const room = await readRoom();
    return Object.keys(room?.schedules || {}).length;
  }, { timeout: 10_000 }).toBe(4);

  const room = await readRoom();
  expect(room.schedules['source-schedule'].revision).toBe(7);
  const copies = Object.values(room.schedules).filter(item => item.id !== 'source-schedule');
  expect(copies).toHaveLength(3);
  expect(copies.map(item => toIsoDate(new Date(item.startAt))).sort()).toEqual(dates.sort());
  for (const item of copies) {
    expect(item.revision).toBe(1);
    expect(item.title).toBe('コピー元予定');
    expect(item.assignee).toBe('福冨');
    expect(item.location).toBe('会議室A');
    expect(item.category).toBe('定期作業');
    expect(item.memo).toBe('コピー元メモ');
    expect(item.relatedTaskId).toBe('related-task-1');
    expect(new Date(item.endAt).getTime() - new Date(item.startAt).getTime()).toBe(75 * 60 * 1000);
  }
  expect(productionRequests).toEqual([]);
});
