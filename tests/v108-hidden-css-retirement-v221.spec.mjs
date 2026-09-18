import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'test-v108-hidden-css-retirement-v221';
const ROOM_NAME = '情報システム共有';
const coreDensitySource = fs.readFileSync(new URL('../ui-core-density-v188.css', import.meta.url), 'utf8');

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
      task('retire-css-mine-v221', '自分担当', '福冨'),
      task('retire-css-room-group-v221', '共有ルーム担当', roomName),
      task('retire-css-legacy-group-v221', '旧固定名担当', 'システム課'),
      task('retire-css-other-v221', '他担当', '森井'),
      task('retire-css-hold-v221', '保留担当', '福冨', '保留'),
      task('retire-css-waiting-v221', '空き時間確認待ち', '福冨', '確認待ち', '')
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
}

test('Ver.221 product CSS permanently retires the legacy data-v108-hidden selector', async ({ page }) => {
  expect(coreDensitySource).not.toMatch(/#todayView\s*\[data-v108-hidden\]/);
  await boot(page);

  const selectorStillLoaded = await page.evaluate(() => {
    for (const sheet of [...document.styleSheets]) {
      let rules;
      try { rules = [...sheet.cssRules]; } catch { continue; }
      if (rules.some(rule => String(rule.selectorText || '').includes('data-v108-hidden'))) return true;
    }
    return false;
  });
  expect(selectorStillLoaded).toBe(false);
  await expect(page.locator('#todayView [data-v108-hidden]')).toHaveCount(0);
});

test('Today semantics remain canonical after the legacy hidden-marker presentation is removed', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#todayView')).toBeVisible();

  await expect(page.locator('[data-task-id="retire-css-mine-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-room-group-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-legacy-group-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-other-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-hold-v221"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-css-waiting-v221"]')).toHaveCount(0);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await mineFilter.click();
  await expect(page.locator('[data-task-id="retire-css-mine-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-room-group-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-legacy-group-v221"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-css-other-v221"]')).toHaveCount(0);

  await mineFilter.click();
  await expect(page.locator('[data-task-id="retire-css-other-v221"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-css-legacy-group-v221"]')).toBeVisible();
});

test('Today controls and mobile Schedule presentation remain usable after selector retirement', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  const activityActions = page.locator('#todayView .activity-panel .activity-actions').first();
  if (await activityActions.count()) await expect(activityActions).toBeVisible();
  await expect(page.locator('#scheduleNotificationSidebarV220')).toBeVisible();

  await page.locator('.nav-item[data-layout="schedule"]').evaluate(button => button.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('.schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('.schedule-search-v176')).toBeVisible();
  await expect(page.locator('.schedule-date-v176')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});
