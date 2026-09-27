import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-schedule-handoff-v304';

async function installProductTest(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

async function boot(page, options = {}) {
  await installProductTest(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await expect(page.locator('#workMobileHeader')).toBeVisible();
}

async function activateLayout(page, layout) {
  const nav = page.locator(`.nav-item[data-layout="${layout}"]`).first();
  await expect(nav).toHaveCount(1);
  await nav.evaluate(element => element.click());
}

async function clickMobileScheduleCreate(page) {
  await page.locator('.work-mobile-action-button').click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  await page.locator("[data-mobile-create='schedule']").click();
}

test('Ver.304 product: canonical schedule navigation exposes create button in the same JavaScript task', async ({ page }) => {
  await boot(page);
  await activateLayout(page, 'tasks');
  await expect(page.locator('#scheduleView')).toBeHidden();

  const snapshot = await page.evaluate(() => {
    const nav = document.querySelector(".nav-item[data-layout='schedule']");
    if (!nav) return { nav: false, button: false, dialogOpen: false };
    nav.click();
    const button = document.querySelector('[data-new-schedule]');
    button?.click();
    return {
      nav: true,
      button: Boolean(button),
      dialogOpen: Boolean(document.getElementById('scheduleDialog')?.open)
    };
  });

  expect(snapshot).toEqual({ nav: true, button: true, dialogOpen: true });
});

test('Ver.304 product: mobile create opens Schedule with synchronous post-navigation handoff', async ({ page }) => {
  await boot(page);
  await activateLayout(page, 'tasks');
  await expect(page.locator('#scheduleDialog')).not.toHaveAttribute('open', '');

  await clickMobileScheduleCreate(page);

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
});

test('Ver.304 product: already-rendered Schedule keeps the direct open path', async ({ page }) => {
  await boot(page);
  await activateLayout(page, 'schedule');
  await expect(page.locator('[data-new-schedule]')).toBeVisible();

  await clickMobileScheduleCreate(page);

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
});

test('Ver.304 product: 861 to 860 late-load boundary keeps schedule create handoff', async ({ page }) => {
  await installProductTest(page, { width: 861 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await activateLayout(page, 'tasks');
  await clickMobileScheduleCreate(page);

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
});
