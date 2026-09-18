import { test, expect } from '@playwright/test';

const ROOM = 'test-core-density-sidecar-retirement-audit-v223';
const SIDECAR = 'core-view-density-v188.js';

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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pad = value => String(value).padStart(2, '0');
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const at = (hour, minute = 0) => new Date(
      today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0, 0
    ).toISOString();
    const schedule = (id, title, startAt, endAt) => ({
      id,
      title,
      startAt,
      endAt,
      assignee: '福冨',
      location: id === 'retire-beta' ? '会議室B' : '会議室A',
      category: 'その他',
      memo: id === 'retire-beta' ? '検索対象メモ' : '通常予定',
      relatedTaskId: '',
      revision: 1,
      createdAt: Date.now() - 1000,
      createdBy: '福冨',
      updatedAt: Date.now(),
      updatedBy: '福冨'
    });

    localStorage.setItem(`system-task-schedule-anchor:${room}`, todayIso);
    localStorage.setItem(`system-task-schedule-range:${room}`, 'today');
    localStorage.setItem(`system-task-schedule-display-mode:${room}`, 'list');
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      schedule('retire-alpha', 'Alpha定例', at(9), at(10)),
      schedule('retire-beta', 'Beta打合せ', at(11), at(12))
    ]));

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

async function bootWithRetiredCoreDensitySidecar(page) {
  await installLocalState(page);
  await blockRemoteFirebase(page);

  let sidecarRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
    } catch (_) {}
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Number(version) >= 224 && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });

  const manifestState = await page.evaluate(sidecar => ({
    required: window.WORK_BOARD_RELEASE?.requiredAssets?.includes(sidecar) ?? false,
    dynamic: window.WORK_BOARD_RELEASE?.dynamicScripts?.includes(sidecar) ?? false,
    apiDefined: typeof window.__WB_CORE_VIEW_DENSITY_V188__ !== 'undefined'
  }), SIDECAR);
  expect(manifestState).toEqual({ required: false, dynamic: false, apiDefined: false });
  expect(sidecarRequests).toBe(0);

  return () => sidecarRequests;
}

async function expectCanonicalToday(page) {
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#todayView .today-head')).toHaveCount(0);
  const actions = page.locator('#todayView .activity-panel .activity-actions');
  await expect(actions.locator('[data-mark-activity-read]')).toHaveCount(1);
  await expect(actions.locator('.today-action-divider-v220')).toHaveCount(1);
  await expect(actions.locator('[data-layout-jump="schedule"]')).toHaveCount(1);
  await expect(actions.locator('[data-new-task]')).toHaveCount(1);

  const placement = await page.evaluate(() => {
    const connection = document.getElementById('connectionPill');
    const host = document.getElementById('scheduleNotificationSidebarV220');
    return {
      hostAfterConnection: connection?.nextElementSibling === host,
      hostHasNotification: Boolean(host?.querySelector('[data-enable-schedule-notifications], .notification-status'))
    };
  });
  expect(placement).toEqual({ hostAfterConnection: true, hostHasNotification: true });
}

async function openScheduleThroughVisibleNavigation(page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 860) {
    const menu = page.locator('.work-mobile-menu-button');
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
  }

  const scheduleNav = page.locator('.nav-item[data-layout="schedule"]');
  await expect(scheduleNav).toBeVisible();
  await scheduleNav.click();
  await expect(page.locator('#scheduleView')).toBeVisible();

  if (viewport && viewport.width <= 860) {
    await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  }
}

async function expectCanonicalSchedule(page) {
  await openScheduleThroughVisibleNavigation(page);
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-controls-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-utility-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-date-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-actions')).toHaveCount(0);
  await expect(page.locator('#scheduleView .schedule-title-block')).toHaveCount(0);
}

async function expectOnlyBetaSchedule(page) {
  await expect(page.locator('#scheduleView [data-schedule-id="retire-alpha"]')).toHaveCount(0);
  await expect(page.locator('#scheduleView [data-schedule-id="retire-beta"]')).toBeVisible();
}

test('Ver.224 product: retired core density sidecar leaves canonical Today and Schedule behavior intact', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getSidecarRequests = await bootWithRetiredCoreDensitySidecar(page);

  await expectCanonicalToday(page);
  await expectCanonicalSchedule(page);

  const search = page.locator('#scheduleView .schedule-search-v176 input');
  await search.fill('Beta');
  await expectOnlyBetaSchedule(page);
  await expect(page.locator('#searchInput')).toHaveValue('Beta');

  const focusState = await page.evaluate(() => {
    const input = document.querySelector('#scheduleView .schedule-search-v176 input');
    return {
      focused: document.activeElement === input,
      start: input?.selectionStart ?? -1,
      end: input?.selectionEnd ?? -1
    };
  });
  expect(focusState).toEqual({ focused: true, start: 4, end: 4 });

  await page.locator('#scheduleView [data-schedule-range="week"]').click();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176 input')).toHaveValue('Beta');
  await expect(page.locator('#scheduleView [data-schedule-range="week"]')).toHaveClass(/active/);
  await expectOnlyBetaSchedule(page);

  await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176 input')).toHaveValue('Beta');
  await expect(page.locator('#scheduleView [data-schedule-mode="calendar"]')).toHaveClass(/active/);

  expect(getSidecarRequests()).toBe(0);
});

test('Ver.224 product: mobile layout remains usable with the core density sidecar fully absent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const getSidecarRequests = await bootWithRetiredCoreDensitySidecar(page);

  await expectCanonicalToday(page);
  await expectCanonicalSchedule(page);

  const search = page.locator('#scheduleView .schedule-search-v176 input');
  await search.fill('Beta');
  await expectOnlyBetaSchedule(page);

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    searchWidth: document.querySelector('#scheduleView .schedule-search-v176')?.getBoundingClientRect().width || 0
  }));
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.searchWidth).toBeGreaterThan(0);
  expect(geometry.searchWidth).toBeLessThanOrEqual(geometry.viewport);
  expect(getSidecarRequests()).toBe(0);
});
