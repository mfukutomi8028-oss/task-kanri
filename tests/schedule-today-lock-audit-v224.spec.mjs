import { test, expect } from '@playwright/test';

const ROOM = 'test-schedule-today-canonical-v227';

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

async function boot(page) {
  let retiredSidecarRequests = 0;
  await installLocalState(page);
  await page.route('**/schedule-today-lock-v129.js*', route => {
    retiredSidecarRequests += 1;
    return route.abort('blockedbyclient');
  });
  await blockRemoteFirebase(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '227' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  // Schedule Today semantics are under test here; mobile drawer hit-testing is not.
  // Trigger the same navigation handler directly so a closed mobile drawer cannot block the test.
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  return () => retiredSidecarRequests;
}

async function localToday(page) {
  return page.evaluate(() => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
}

test('Ver.227 app corrects stale Today anchor and blocks prev/next without the retired sidecar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const sidecarRequests = await boot(page);

  const today = await localToday(page);
  const label = page.locator('#scheduleView .schedule-range-label');
  const prev = page.locator('#scheduleView [data-schedule-move="prev"]');
  const next = page.locator('#scheduleView [data-schedule-move="next"]');
  const week = page.locator('#scheduleView [data-schedule-range="week"]');

  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);
  await expect(label).toHaveText(today);
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(prev).toHaveAttribute('aria-disabled', 'true');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');

  const storedAnchor = await page.evaluate(room => localStorage.getItem(`system-task-schedule-anchor:${room}`), ROOM);
  expect(storedAnchor).toBe(today);
  expect(sidecarRequests()).toBe(0);
});

test('Ver.227 keeps normal week movement and returns canonically to Today without sidecar DOM repair', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const sidecarRequests = await boot(page);

  const today = await localToday(page);
  const label = page.locator('#scheduleView .schedule-range-label');
  const prev = page.locator('#scheduleView [data-schedule-move="prev"]');
  const next = page.locator('#scheduleView [data-schedule-move="next"]');
  const week = page.locator('#scheduleView [data-schedule-range="week"]');

  await week.click();
  await expect(week).toHaveClass(/active/);
  await expect(prev).toBeEnabled();
  await expect(next).toBeEnabled();
  const weekInitial = (await label.textContent())?.trim() || '';

  await next.click();
  const weekMoved = (await label.textContent())?.trim() || '';
  expect(weekMoved).not.toBe(weekInitial);

  await page.locator('#scheduleView [data-schedule-range="today"]').click();
  await expect(label).toHaveText(today);
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(label).toHaveText(today);
  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');
  expect(sidecarRequests()).toBe(0);
});

test('Ver.227 Today lock controls remain usable at 390px without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sidecarRequests = await boot(page);

  await expect(page.locator('#scheduleView [data-schedule-move="prev"]')).toBeDisabled();
  await expect(page.locator('#scheduleView [data-schedule-move="next"]')).toBeDisabled();
  const metrics = await page.locator('#scheduleView').evaluate(node => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(sidecarRequests()).toBe(0);
});
