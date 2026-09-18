import { test, expect } from '@playwright/test';

const ROOM = 'test-schedule-today-lock-audit-v224';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, '情報システム共有');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const pad = value => String(value).padStart(2, '0');
    const yesterdayIso = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    localStorage.setItem(`system-task-schedule-range:${room}`, 'today');
    localStorage.setItem(`system-task-schedule-anchor:${room}`, yesterdayIso);
    localStorage.setItem(`system-task-schedule-display-mode:${room}`, 'list');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableTodayLock = false } = {}) {
  await installLocalState(page);
  if (disableTodayLock) {
    await page.route('**/schedule-today-lock-v129.js*', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: 'window.__WB_SCHEDULE_TODAY_LOCK_AUDIT_DISABLED__ = true;'
    }));
  }
  await blockRemoteFirebase(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '224' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.locator('.nav-item[data-layout="schedule"]').click();
  await expect(page.locator('#scheduleView')).toBeVisible();
}

async function localToday(page) {
  return page.evaluate(() => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
}

test('audit baseline: schedule-today-lock owns stale today-anchor correction, prev/next blocking and week-label normalization', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);

  const today = await localToday(page);
  const label = page.locator('#scheduleView .schedule-range-label');
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);
  await expect(label).toHaveText(today);

  const week = page.locator('#scheduleView [data-schedule-range="week"]');
  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');

  await page.locator('#scheduleView [data-schedule-move="next"]').click();
  await expect(label).toHaveText(today);
  await page.locator('#scheduleView [data-schedule-move="prev"]').click();
  await expect(label).toHaveText(today);

  await week.evaluate(button => {
    button.textContent = '週';
    button.removeAttribute('title');
  });
  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');
});

test('audit boundary: without schedule-today-lock app owns final Schedule DOM but not the today lock lifecycle', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, { disableTodayLock: true });

  const today = await localToday(page);
  const label = page.locator('#scheduleView .schedule-range-label');
  const week = page.locator('#scheduleView [data-schedule-range="week"]');

  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176')).toBeVisible();
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);
  await expect(week).toHaveText('7日間');

  const initial = (await label.textContent())?.trim() || '';
  expect(initial).not.toBe(today);

  await page.locator('#scheduleView [data-schedule-move="prev"]').click();
  const moved = (await label.textContent())?.trim() || '';
  expect(moved).not.toBe(today);
  expect(moved).not.toBe(initial);

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(label).toHaveText(moved);

  await week.evaluate(button => {
    button.textContent = '週';
    button.removeAttribute('title');
  });
  await expect(week).toHaveText('週');
  await expect(week).not.toHaveAttribute('title', '今日から7日間を表示します');

  console.log(JSON.stringify({ audit: 'schedule-today-lock-v224', today, initial, moved }));
});
