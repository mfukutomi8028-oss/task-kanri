import { test, expect } from '@playwright/test';

const ROOM = 'test-stable-today-retirement-v219';
const ROOM_NAME = '情報システム共有';

async function boot(page) {
  await page.addInitScript(({ room, roomName }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, roomName);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const task = (id, title, assignee, status = '未着手', dueDate = today) => ({
      id, title, description: '', requester: '', assignee, status,
      priority: '中', category: 'その他', tags: [], dueDate, dueTime: '', pinned: false,
      checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
      createdAt: Date.now() - 1000, createdBy: '福冨', updatedAt: Date.now(), updatedBy: '福冨',
      completedAt: 0, completedMemo: '', revision: 1
    });
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      task('retire-mine-v219', '自分担当', '福冨'),
      task('retire-room-group-v219', '共有ルーム担当', roomName),
      task('retire-legacy-group-v219', '旧固定名担当', 'システム課'),
      task('retire-other-v219', '他担当', '森井'),
      task('retire-hold-v219', '保留担当', '福冨', '保留'),
      task('retire-waiting-v219', '空き時間確認待ち', '福冨', '確認待ち', '')
    ]));

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);
    const schedule = (id, title, assignee) => ({
      id, title, memo: '', location: '', assignee, category: 'その他',
      startAt: start.toISOString(), endAt: end.toISOString(), relatedTaskId: '',
      createdAt: Date.now() - 1000, updatedAt: Date.now(), revision: 1
    });
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      schedule('retire-schedule-mine-v219', '自分の予定', '福冨'),
      schedule('retire-schedule-room-group-v219', '共有ルームの予定', roomName),
      schedule('retire-schedule-other-v219', '他担当の予定', '森井')
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, roomName: ROOM_NAME });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#todayView')).toBeVisible();
}

test('Ver.219 canonical Today renderer preserves task semantics without stable runtime', async ({ page }) => {
  await boot(page);

  await expect(page.locator('[data-task-id="retire-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-hold-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-waiting-v219"]')).toHaveCount(0);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await expect(mineFilter).toBeVisible();
  await mineFilter.click();

  await expect(page.locator('[data-task-id="retire-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-hold-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-waiting-v219"]')).toHaveCount(0);
  expect(await page.locator('#todayView [data-v108-hidden]').count()).toBe(0);

  await mineFilter.click();
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toBeVisible();
});

test('Ver.219 canonical Today renderer keeps room-group schedules in mine scope without stable runtime', async ({ page }) => {
  await boot(page);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await mineFilter.click();

  await expect(page.locator('[data-schedule-id="retire-schedule-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="retire-schedule-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="retire-schedule-other-v219"]')).toHaveCount(0);
  expect(await page.locator('#todayView [data-v108-hidden]').count()).toBe(0);

  await mineFilter.click();
  await expect(page.locator('[data-schedule-id="retire-schedule-other-v219"]')).toBeVisible();
});

test('Ver.219 current runtime does not request stable-fixes-v108.js', async ({ page }) => {
  await boot(page);
  const requestedStable = await page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => String(entry.name || '').includes('stable-fixes-v108.js')));
  expect(requestedStable).toBe(false);
});
