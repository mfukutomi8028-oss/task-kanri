import { test, expect } from '@playwright/test';

const ROOM = 'test-core-view-density-ownership-audit-v221';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, '情報システム共有');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    class TestNotification {
      static permission = 'default';
      static requestPermission() {
        TestNotification.permission = 'granted';
        return Promise.resolve('granted');
      }
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
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, { disableCoreDensity = false } = {}) {
  await installLocalState(page);

  if (disableCoreDensity) {
    await page.route('**/core-view-density-v188.js*', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `(() => {
        window.__WB_CORE_VIEW_DENSITY_V188__ = Object.freeze({
          version: 'audit-disabled',
          patchAll() {},
          observers: Object.freeze({ today: null, schedule: null })
        });
      })();`
    }));
  }

  await blockRemoteFirebase(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#todayView')).toBeVisible();
}

test('audit baseline: app raw Today and Schedule DOM still depend on core-view-density post-render canonicalization', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, { disableCoreDensity: true });

  await expect(page.locator('#todayView .today-head')).toBeVisible();
  await expect(page.locator('#todayView .today-head-actions [data-layout-jump="schedule"]')).toHaveCount(1);
  await expect(page.locator('#todayView .today-head-actions [data-new-task]')).toHaveCount(1);
  await expect(page.locator('#todayView .activity-actions [data-enable-schedule-notifications]')).toHaveCount(1);
  await expect(page.locator('#scheduleNotificationSidebarV220')).toHaveCount(0);
  await expect(page.locator('#todayView .today-action-divider-v220')).toHaveCount(0);

  await page.locator('#todayView [data-layout-jump="schedule"]').click();
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-head')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-actions')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toHaveCount(0);
  await expect(page.locator('#scheduleView .schedule-search-v176')).toHaveCount(0);
});

test('audit baseline: active core-view-density owns final Today relocation and Schedule toolbar with feature-scoped observers', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);

  await expect(page.locator('#todayView .today-head')).toHaveCount(0);
  const actions = page.locator('#todayView .activity-panel .activity-actions');
  await expect(actions.locator('[data-layout-jump="schedule"]')).toHaveCount(1);
  await expect(actions.locator('[data-new-task]')).toHaveCount(1);
  await expect(actions.locator('.today-action-divider-v220')).toHaveCount(1);
  await expect(actions.locator('[data-enable-schedule-notifications], .notification-status')).toHaveCount(0);

  const placement = await page.evaluate(() => {
    const connection = document.getElementById('connectionPill');
    const host = document.getElementById('scheduleNotificationSidebarV220');
    const api = window.__WB_CORE_VIEW_DENSITY_V188__;
    return {
      hostAfterConnection: connection?.nextElementSibling === host,
      hostHasNotification: Boolean(host?.querySelector('[data-enable-schedule-notifications], .notification-status')),
      todayObserver: Boolean(api?.observers?.today),
      scheduleObserver: Boolean(api?.observers?.schedule)
    };
  });
  expect(placement).toEqual({
    hostAfterConnection: true,
    hostHasNotification: true,
    todayObserver: true,
    scheduleObserver: true
  });

  await actions.locator('[data-layout-jump="schedule"]').click();
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-date-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-actions')).toHaveCount(0);
});
