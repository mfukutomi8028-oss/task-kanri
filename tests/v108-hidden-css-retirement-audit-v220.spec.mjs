import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'audit-v108-hidden-css-retirement-v220';
const ROOM_NAME = '情報システム共有';
const coreDensitySource = fs.readFileSync(new URL('../ui-core-density-v188.css', import.meta.url), 'utf8');
const LEGACY_SELECTOR_BLOCK = `#todayView [data-v108-hidden] {\n  display: none !important;\n}\n`;

function withoutLegacyV108HiddenSelector() {
  if (!coreDensitySource.includes(LEGACY_SELECTOR_BLOCK)) {
    throw new Error('legacy data-v108-hidden selector block was not found');
  }
  const transformed = coreDensitySource.replace(LEGACY_SELECTOR_BLOCK, '');
  if (transformed.includes('#todayView [data-v108-hidden]')) {
    throw new Error('legacy data-v108-hidden selector remained after audit transform');
  }
  return transformed;
}

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
      task('audit-css-mine-v220', '自分担当', '福冨'),
      task('audit-css-room-group-v220', '共有ルーム担当', roomName),
      task('audit-css-legacy-group-v220', '旧固定名担当', 'システム課'),
      task('audit-css-other-v220', '他担当', '森井'),
      task('audit-css-hold-v220', '保留担当', '福冨', '保留'),
      task('audit-css-waiting-v220', '空き時間確認待ち', '福冨', '確認待ち', '')
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, roomName: ROOM_NAME });

  await page.route(/\/ui-core-density-v188\.css(?:\?.*)?$/i, route => route.fulfill({
    status: 200,
    contentType: 'text/css; charset=utf-8',
    body: withoutLegacyV108HiddenSelector()
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '220' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

test('Today semantics remain canonical when legacy data-v108-hidden CSS selector is virtually removed', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#todayView')).toBeVisible();

  await expect(page.locator('[data-task-id="audit-css-mine-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-room-group-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-legacy-group-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-other-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-hold-v220"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="audit-css-waiting-v220"]')).toHaveCount(0);
  await expect(page.locator('#todayView [data-v108-hidden]')).toHaveCount(0);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await mineFilter.click();
  await expect(page.locator('[data-task-id="audit-css-mine-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-room-group-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-legacy-group-v220"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="audit-css-other-v220"]')).toHaveCount(0);
  await expect(page.locator('#todayView [data-v108-hidden]')).toHaveCount(0);

  await mineFilter.click();
  await expect(page.locator('[data-task-id="audit-css-other-v220"]')).toBeVisible();
  await expect(page.locator('[data-task-id="audit-css-legacy-group-v220"]')).toBeVisible();
});

test('virtual selector retirement leaves the rest of core Today and Schedule presentation usable', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
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

  const activityActions = page.locator('#todayView .activity-panel .activity-actions').first();
  if (await activityActions.count()) await expect(activityActions).toBeVisible();

  await page.locator('.nav-item[data-layout="schedule"]').evaluate(button => button.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('.schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('.schedule-search-v176')).toBeVisible();
  await expect(page.locator('.schedule-date-v176')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});
