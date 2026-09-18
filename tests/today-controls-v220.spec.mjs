import { test, expect } from '@playwright/test';

const ROOM = 'test-today-controls-v220';

async function boot(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    class TestNotification {
      static permission = 'granted';
      static requestPermission() { return Promise.resolve('granted'); }
      constructor() {}
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: TestNotification
    });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '220');
  await expect(page.locator('#todayView')).toBeVisible();
  await page.waitForFunction(() => document.getElementById('scheduleNotificationSidebarV220'));
}

test('moves schedule notification below collaboration status and removes it from Today actions', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);

  const placement = await page.evaluate(() => {
    const connection = document.getElementById('connectionPill');
    const host = document.getElementById('scheduleNotificationSidebarV220');
    return {
      immediatelyAfterConnection: connection?.nextElementSibling === host,
      text: host?.textContent?.trim() || '',
      todayNotificationCount: document.querySelectorAll('#todayView [data-enable-schedule-notifications], #todayView .notification-status').length
    };
  });

  expect(placement.immediatelyAfterConnection).toBe(true);
  expect(placement.text).toContain('予定通知ON');
  expect(placement.todayNotificationCount).toBe(0);

  await page.locator('.sidebar').hover();
  await expect(page.locator('#scheduleNotificationSidebarV220')).toBeVisible();
  await expect(page.locator('#scheduleNotificationSidebarV220 .notification-status')).toHaveText('予定通知ON');
});

test('places a visible divider between mark-read and schedule actions without changing action order', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);

  const metrics = await page.evaluate(() => {
    const actions = document.querySelector('#todayView .activity-panel .activity-actions');
    const markRead = actions?.querySelector('[data-mark-activity-read]');
    const divider = actions?.querySelector('.today-action-divider-v220');
    const schedule = actions?.querySelector('[data-layout-jump="schedule"]');
    const children = actions ? [...actions.children] : [];
    const rect = divider?.getBoundingClientRect();
    return {
      markReadIndex: children.indexOf(markRead),
      dividerIndex: children.indexOf(divider),
      scheduleIndex: children.indexOf(schedule),
      scheduleText: schedule?.textContent?.trim() || '',
      dividerWidth: rect?.width || 0,
      dividerHeight: rect?.height || 0,
      notificationCount: actions?.querySelectorAll('[data-enable-schedule-notifications], .notification-status').length || 0
    };
  });

  expect(metrics.markReadIndex).toBeGreaterThanOrEqual(0);
  expect(metrics.dividerIndex).toBe(metrics.markReadIndex + 1);
  expect(metrics.scheduleIndex).toBe(metrics.dividerIndex + 1);
  expect(metrics.scheduleText).toBe('スケジュールを見る');
  expect(metrics.dividerWidth).toBeGreaterThan(0);
  expect(metrics.dividerWidth).toBeLessThanOrEqual(2);
  expect(metrics.dividerHeight).toBeGreaterThanOrEqual(20);
  expect(metrics.notificationCount).toBe(0);
});
