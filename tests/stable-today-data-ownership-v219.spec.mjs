import { test, expect } from '@playwright/test';

const ROOM = 'audit-stable-today-data-v219';
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
    const task = (id, title, assignee) => ({
      id, title, description: '', requester: '', assignee,
      status: '未着手', priority: '中', category: 'その他', tags: [],
      dueDate: today, dueTime: '', pinned: false, checklist: [], comments: [], history: [],
      recurrence: 'none', recurrenceRule: {}, createdAt: Date.now() - 1000,
      createdBy: '福冨', updatedAt: Date.now(), updatedBy: '福冨',
      completedAt: 0, completedMemo: '', revision: 1
    });
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      task('audit-mine-v219', '自分担当', '福冨'),
      task('audit-room-group-v219', '共有ルーム担当', roomName),
      task('audit-legacy-group-v219', '旧固定名担当', 'システム課'),
      task('audit-other-v219', '他担当', '森井')
    ]));

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);
    const schedule = (id, title, assignee) => ({
      id, title, memo: '', location: '', assignee, category: 'その他',
      startAt: start.toISOString(), endAt: end.toISOString(), relatedTaskId: '',
      createdAt: Date.now() - 1000, updatedAt: Date.now(), revision: 1
    });
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      schedule('audit-schedule-mine-v219', '自分の予定', '福冨'),
      schedule('audit-schedule-room-group-v219', '共有ルームの予定', roomName)
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
  await expect(page.locator('[data-task-id="audit-mine-v219"]')).toBeVisible();
}

test('audit characterizes Today mine/group divergence before data-ownership cleanup', async ({ page }) => {
  await boot(page);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await expect(mineFilter).toBeVisible();
  await mineFilter.click();

  const mine = page.locator('[data-task-id="audit-mine-v219"]');
  const roomGroup = page.locator('[data-task-id="audit-room-group-v219"]');
  const legacyGroup = page.locator('[data-task-id="audit-legacy-group-v219"]');
  const other = page.locator('[data-task-id="audit-other-v219"]');

  await expect(mine).toBeVisible();
  await expect(roomGroup).toHaveAttribute('data-v108-hidden', '');
  await expect(legacyGroup).not.toHaveAttribute('data-v108-hidden', '');
  await expect(other).toHaveAttribute('data-v108-hidden', '');

  // app.jsの正本では共有担当はroomNameだが、stableは固定名を独自共有担当として扱っている。
  await expect(roomGroup).toBeHidden();
  await expect(legacyGroup).toBeVisible();
});

test('audit characterizes Today schedule mine filtering as current-user-only before cleanup', async ({ page }) => {
  await boot(page);

  await page.locator('.nav-filter[data-filter="mine"]').first().click();

  await expect(page.locator('[data-schedule-id="audit-schedule-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="audit-schedule-room-group-v219"]')).toHaveCount(0);
});
