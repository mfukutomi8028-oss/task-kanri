import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-schedule-retry-v303';

async function installAudit(page, { candidate = false } = {}) {
  await page.setViewportSize({ width: 430, height: 900 });
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

  if (candidate) {
    await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      let body = await response.text();
      const current = `    document.querySelector(".nav-item[data-layout='schedule'], [data-layout='schedule']")?.click();\n    setTimeout(tryOpen, 80);\n    setTimeout(tryOpen, 220);\n    setTimeout(tryOpen, 500);`;
      const replacement = `    document.querySelector(".nav-item[data-layout='schedule'], [data-layout='schedule']")?.click();\n    tryOpen();`;
      if (!body.includes(current)) throw new Error('Ver.303 schedule retry candidate injection point not found');
      body = body.replace(current, replacement);
      await route.fulfill({ response, body });
    });
  }

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '272', undefined, { timeout: 8_000 });
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

test('Ver.303 audit: canonical schedule navigation exposes create button in the same JavaScript task', async ({ page }) => {
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

test('Ver.303 candidate: mobile create opens Schedule with one synchronous post-navigation retry', async ({ page }) => {
  await boot(page, { candidate: true });
  await activateLayout(page, 'tasks');
  await expect(page.locator('#scheduleDialog')).not.toHaveAttribute('open', '');

  await clickMobileScheduleCreate(page);

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
});

test('Ver.303 candidate: already-rendered Schedule keeps the direct open path', async ({ page }) => {
  await boot(page, { candidate: true });
  await activateLayout(page, 'schedule');
  await expect(page.locator('[data-new-schedule]')).toBeVisible();

  await clickMobileScheduleCreate(page);

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
});
