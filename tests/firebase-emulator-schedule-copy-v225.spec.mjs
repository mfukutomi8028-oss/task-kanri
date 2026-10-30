import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-schedule-copy-v225';
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

async function installEmulatorBoundary(page, sourceDate, { modern = false } = {}) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port, date, modern }) => {
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
    window.WORK_BOARD_TEST = Object.freeze({
      emulator: true, host, port,
      ...(modern ? { modernReadV553: true, modernWriteV562: true } : {})
    });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, date: sourceDate, modern });

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


// Ver.562: re-use the SAME Classic RTDB schedule collection, reminder watcher,
// related-task selector and atomic copy writer from the Modern test entry.
// These tests intentionally run against demo-project Firebase Emulator only.
async function seedModernSchedule() {
  const source = { ...sourceRecord(), relatedTaskId: 'task-link' };
  const unrelated = { ...sourceRecord(), id: 'other-schedule', title: '独立した予定',
    relatedTaskId: '', revision: 2 };
  unrelated.startAt = new Date(new Date(source.startAt).getTime() + 4 * 60 * 60 * 1000).toISOString();
  unrelated.endAt = new Date(new Date(source.endAt).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const now = Date.now();
  await putDb('rooms/' + ROOM + '/meta', {
    users: ['福冨', '森井'], userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
  await putDb('rooms/' + ROOM + '/tasks/task-link', {
    id: 'task-link', title: '関連タスク', assignee: '福冨', status: '未着手',
    category: 'その他', priority: '中', createdAt: now - 10_000,
    updatedAt: now, revision: 1, history: [], checklist: [], comments: [],
    recurrence: 'none'
  });
  await putDb('rooms/' + ROOM + '/schedules/' + SOURCE_ID, source);
  await putDb('rooms/' + ROOM + '/schedules/other-schedule', unrelated);
  return { source, unrelated };
}

async function bootModernSchedule(page, source) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const unsafe = await installEmulatorBoundary(page,
    localIsoDate(new Date(source.startAt)), { modern: true });
  await page.goto('/?room=' + encodeURIComponent(ROOM) +
    '&modernReadV553=1&modernWriteV562=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(id => {
    const snapshot = window.WorkBoardReadV550?.read?.();
    return window.WORK_BOARD_ASSETS_READY === true
      && snapshot?.ready === true && snapshot.source === 'remote-online'
      && snapshot.schedules.some(row => row.id === id);
  }, SOURCE_ID, { timeout: 30_000 });
  const frame = page.frameLocator('iframe[data-modern-schedule-v553]');
  await frame.locator('#refreshV553').click();
  await expect(frame.locator('body')).toHaveAttribute('data-schedule-write-v562', 'enabled');
  await expect(frame.locator('[data-schedule-id="' + SOURCE_ID + '"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(unsafe).toEqual([]);
  return { frame, unsafe, pageErrors };
}

const sourcePathV562 = 'rooms/' + ROOM + '/schedules/' + SOURCE_ID;
const allSchedulesPathV562 = 'rooms/' + ROOM + '/schedules';
const modernSourceButtonV562 = action =>
  '[data-schedule-id="' + SOURCE_ID + '"] [data-schedule-action-v562="' + action + '"]';

test('Ver.562 Modern creates/edits a linked schedule using Classic remote CAS', async ({ page }) => {
  const { source, unrelated } = await seedModernSchedule();
  const safety = await bootModernSchedule(page, source);
  await safety.frame.locator('#scheduleNewV562').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await expect(page.locator('iframe[data-modern-schedule-v553]')).toHaveCount(0);
  await page.locator('#scheduleTitle').fill('Modern からの共同予定');
  const day = new Date(source.startAt);
  day.setDate(day.getDate() + 2);
  const date = localIsoDate(day);
  await page.locator('#scheduleStart').fill(date + 'T09:00');
  await page.locator('#scheduleEnd').fill(date + 'T10:00');
  await page.locator('#scheduleRelatedTask').selectOption('task-link');
  await page.locator('#scheduleForm button[type="submit"]').click();
  await expect(page.locator('#scheduleDialog')).not.toBeVisible();
  await expect.poll(async () => Object.values(await readDb(allSchedulesPathV562) || {})
    .some(row => row.title === 'Modern からの共同予定')).toBe(true);
  let records = Object.values(await readDb(allSchedulesPathV562) || {});
  const created = records.find(row => row.title === 'Modern からの共同予定');
  expect(created).toMatchObject({ revision: 1, relatedTaskId: 'task-link' });
  expect(await readDb(sourcePathV562)).toMatchObject({ revision: 4, relatedTaskId: 'task-link' });
  expect(await readDb(allSchedulesPathV562 + '/other-schedule')).toEqual(unrelated);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(id => window.WorkBoardReadV550?.read?.()?.schedules
    .some(row => row.id === id), SOURCE_ID, { timeout: 30_000 });
  const frame = page.frameLocator('iframe[data-modern-schedule-v553]');
  await frame.locator('#refreshV553').click();
  await frame.locator(modernSourceButtonV562('edit')).click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#scheduleTitle').fill('共同の予定を編集');
  await page.locator('#scheduleLocation').fill('機器室');
  await page.locator('#scheduleForm button[type="submit"]').click();
  await expect(page.locator('#scheduleDialog')).not.toBeVisible();
  await expect.poll(() => readDb(sourcePathV562))
    .toMatchObject({ revision: 5, title: '共同の予定を編集', location: '機器室', relatedTaskId: 'task-link' });
  expect(await readDb(allSchedulesPathV562 + '/other-schedule')).toEqual(unrelated);
  expect(safety.unsafe).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Ver.562 stale Classic edit retains unsaved input and preserves peer winner', async ({ browser }) => {
  const { source } = await seedModernSchedule();
  const a = await browser.newPage();
  const b = await browser.newPage();
  try {
    const first = await bootModernSchedule(a, source);
    const second = await bootModernSchedule(b, source);
    await second.frame.locator(modernSourceButtonV562('edit')).click();
    await expect(b.locator('#scheduleDialog')).toBeVisible();
    await b.locator('#scheduleTitle').fill('B の未保存編集');

    await first.frame.locator(modernSourceButtonV562('edit')).click();
    await a.locator('#scheduleTitle').fill('A の先行更新');
    await a.locator('#scheduleForm button[type="submit"]').click();
    await expect.poll(() => readDb(sourcePathV562))
      .toMatchObject({ revision: 5, title: 'A の先行更新' });
    await b.waitForFunction(id => window.WorkBoardReadV550?.read?.()?.schedules
      .some(row => row.id === id && row.revision === 5), SOURCE_ID, { timeout: 30_000 });
    await b.locator('#scheduleForm button[type="submit"]').click();
    await expect(b.locator('#scheduleDialog')).toBeVisible();
    await expect(b.locator('#scheduleTitle')).toHaveValue('B の未保存編集');
    expect(await readDb(sourcePathV562)).toMatchObject({ revision: 5, title: 'A の先行更新' });
    expect(first.unsafe).toEqual([]);
    expect(second.unsafe).toEqual([]);
    expect(first.pageErrors).toEqual([]);
    expect(second.pageErrors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test('Ver.562 cancel/stale delete preserves winner, then Classic CAS removes only selected schedule', async ({ page }) => {
  const { source, unrelated } = await seedModernSchedule();
  const safety = await bootModernSchedule(page, source);
  page.once('dialog', dialog => dialog.dismiss());
  await safety.frame.locator(modernSourceButtonV562('remove')).click();
  await expect(safety.frame.locator('#scheduleActionStatusV562')).toContainText('キャンセル');
  expect(await readDb(sourcePathV562)).toEqual(source);

  await putDb(sourcePathV562, { ...source, title: '他端末の先行変更', revision: 5 });
  await page.waitForFunction(id => window.WorkBoardReadV550?.read?.()?.schedules
    .some(row => row.id === id && row.revision === 5), SOURCE_ID, { timeout: 30_000 });
  // Modern still holds its original visible row revision until user refresh.
  await safety.frame.locator(modernSourceButtonV562('remove')).click();
  await expect(safety.frame.locator('#scheduleActionStatusV562'))
    .toContainText('処理できませんでした');
  expect(await readDb(sourcePathV562)).toMatchObject({ revision: 5, title: '他端末の先行変更' });

  page.once('dialog', dialog => dialog.accept());
  await safety.frame.locator(modernSourceButtonV562('remove')).click();
  await expect.poll(() => readDb(sourcePathV562)).toBeNull();
  await expect(safety.frame.locator('#scheduleActionStatusV562')).toContainText('削除しました');
  expect(await readDb(allSchedulesPathV562 + '/other-schedule')).toEqual(unrelated);
  expect(safety.unsafe).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Ver.562 Modern recurring-copy uses existing atomic Classic collection transaction', async ({ page }) => {
  const { source, unrelated } = await seedModernSchedule();
  const safety = await bootModernSchedule(page, source);
  await safety.frame.locator(modernSourceButtonV562('copy')).click();
  await expect(page.locator('iframe[data-modern-schedule-v553]')).toHaveCount(0);
  await expect(page.locator('#scheduleCopyDialog')).toBeVisible();
  await page.locator('#scheduleCopyMethod').selectOption('dates');
  const date = new Date(source.startAt);
  date.setDate(date.getDate() + 3);
  await setDate(page, '#scheduleCopyDateInput', localIsoDate(date));
  await page.locator('#scheduleCopyAddDate').click();
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveText('1件の予定を作成');
  await page.locator('#scheduleCopySubmit').click();
  await expect.poll(async () => Object.keys(await readDb(allSchedulesPathV562) || {}).length).toBe(3);
  const records = await readDb(allSchedulesPathV562);
  const copies = Object.values(records).filter(row =>
    row.id !== SOURCE_ID && row.id !== 'other-schedule');
  expect(copies).toHaveLength(1);
  expect(copies[0]).toMatchObject({
    title: source.title, relatedTaskId: 'task-link',
    location: source.location, revision: 1
  });
  expect(records[SOURCE_ID]).toEqual(source);
  expect(records['other-schedule']).toEqual(unrelated);
  expect(safety.unsafe).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Ver.562 recurring-copy rejects a changed source without duplicate copies', async ({ page }) => {
  const { source, unrelated } = await seedModernSchedule();
  const safety = await bootModernSchedule(page, source);
  await safety.frame.locator(modernSourceButtonV562('copy')).click();
  await page.locator('#scheduleCopyMethod').selectOption('dates');
  const date = new Date(source.startAt);
  date.setDate(date.getDate() + 4);
  await setDate(page, '#scheduleCopyDateInput', localIsoDate(date));
  await page.locator('#scheduleCopyAddDate').click();
  await putDb(sourcePathV562, { ...source, title: '他端末で更新', revision: 5 });
  await page.waitForFunction(id => window.WorkBoardReadV550?.read?.()?.schedules
    .some(row => row.id === id && row.revision === 5), SOURCE_ID, { timeout: 30_000 });
  await page.locator('#scheduleCopySubmit').click();
  await expect(page.locator('#scheduleCopyDialog')).toBeVisible();
  const records = await readDb(allSchedulesPathV562);
  expect(Object.keys(records)).toHaveLength(2);
  expect(records[SOURCE_ID]).toMatchObject({ title: '他端末で更新', revision: 5 });
  expect(records['other-schedule']).toEqual(unrelated);
  expect(safety.unsafe).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});
