import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-long-lived-responsibility-v313';

async function installInstrumentation(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([{
      id: 'v313-task-1', title: 'V313 seeded task', status: '未着手', assignee: '福冨',
      priority: '中', category: 'PC', description: '', dueDate: '', tags: []
    }]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__WB_NAV_V313__ = {
      shellRequests: 0,
      bindAdds: 0,
      navCallbacks: 0,
      initialNavRoot: null
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const needle = `  function bindGlobalClicks() {\n    if (window.__workBoardMobileFixClicksV101) return;\n    window.__workBoardMobileFixClicksV101 = true;\n    document.querySelector(".nav")?.addEventListener("click", event => {\n      if (event.target?.closest?.(".nav-item")) {\n        closeMobileMenu();\n        syncMobileHeaderTitle();\n        patchMobileBoardTabs();\n      }\n    });\n  }`;
    const replacement = `  function bindGlobalClicks() {\n    if (window.__workBoardMobileFixClicksV101) return;\n    window.__workBoardMobileFixClicksV101 = true;\n    const navRoot = document.querySelector(".nav");\n    if (navRoot) {\n      window.__WB_NAV_V313__.bindAdds += 1;\n      window.__WB_NAV_V313__.initialNavRoot ||= navRoot;\n    }\n    navRoot?.addEventListener("click", event => {\n      window.__WB_NAV_V313__.navCallbacks += 1;\n      if (event.target?.closest?.(".nav-item")) {\n        closeMobileMenu();\n        syncMobileHeaderTitle();\n        patchMobileBoardTabs();\n      }\n    });\n  }`;
    if (!body.includes(needle)) throw new Error('Ver.313 nav-root delegation target not found');
    body = body.replace(needle, replacement);
    body = `window.__WB_NAV_V313__.shellRequests += 1;\n${body}`;
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installInstrumentation(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(release).toBe('277');
  await page.waitForFunction(version => document.documentElement.dataset.firstPaintVersion === version, release, { timeout: 8_000 });
  return release;
}

async function metrics(page) {
  return page.evaluate(() => ({
    shellRequests: window.__WB_NAV_V313__.shellRequests,
    bindAdds: window.__WB_NAV_V313__.bindAdds,
    navCallbacks: window.__WB_NAV_V313__.navCallbacks,
    sameNavRoot: window.__WB_NAV_V313__.initialNavRoot === document.querySelector('.nav'),
    guard: Boolean(window.__workBoardMobileFixClicksV101)
  }));
}

async function clickNav(page, selector) {
  const before = (await metrics(page)).navCallbacks;
  await page.locator(selector).first().click();
  await expect.poll(async () => (await metrics(page)).navCallbacks).toBe(before + 1);
}

test('Ver.313 audit: mobile cold boot owns exactly one nav-root listener and ignores outside clicks', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect(await metrics(page)).toMatchObject({ shellRequests: 1, bindAdds: 1, navCallbacks: 0, sameNavRoot: true, guard: true });

  await page.locator('.main').click({ position: { x: 8, y: 8 } });
  expect(await metrics(page)).toMatchObject({ bindAdds: 1, navCallbacks: 0, sameNavRoot: true });
});

test('Ver.313 audit: one stable nav root covers Tasks, Today, Schedule, and dynamic Work Memo', async ({ page }) => {
  await boot(page);
  await clickNav(page, '.nav-item[data-layout="tasks"]');
  await expect(page.locator('#boardView')).toBeVisible();
  expect((await metrics(page)).sameNavRoot).toBe(true);

  await clickNav(page, '.nav-item[data-layout="today"]');
  await expect(page.locator('#todayView')).toBeVisible();
  expect((await metrics(page)).sameNavRoot).toBe(true);

  await clickNav(page, '.nav-item[data-layout="schedule"]');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
  expect((await metrics(page)).sameNavRoot).toBe(true);

  await expect(page.locator('[data-work-memo-layout]')).toHaveCount(1);
  await clickNav(page, '[data-work-memo-layout]');
  await expect(page.locator('.work-mobile-title-text')).toContainText('業務メモ');
  expect(await metrics(page)).toMatchObject({ bindAdds: 1, navCallbacks: 4, sameNavRoot: true });
});

test('Ver.313 audit: repeated resize reconciliation does not rebind navigation delegation', async ({ page }) => {
  await boot(page);
  for (const width of [420, 600, 860, 500, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(50);
  }
  expect(await metrics(page)).toMatchObject({ shellRequests: 1, bindAdds: 1, navCallbacks: 0, sameNavRoot: true, guard: true });
  await clickNav(page, '.nav-item[data-layout="today"]');
  expect(await metrics(page)).toMatchObject({ bindAdds: 1, navCallbacks: 1, sameNavRoot: true });
});

test('Ver.313 audit: 861 to 860 late load binds exactly once and preserves dynamic nav coverage', async ({ page }) => {
  await boot(page, { width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await metrics(page)).toMatchObject({ shellRequests: 0, bindAdds: 0, navCallbacks: 0, sameNavRoot: false, guard: false });

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect.poll(async () => (await metrics(page)).bindAdds).toBe(1);
  await clickNav(page, '[data-work-memo-layout]');
  expect(await metrics(page)).toMatchObject({ shellRequests: 1, bindAdds: 1, navCallbacks: 1, sameNavRoot: true, guard: true });
});

test('Ver.313 audit: desktop cold boot owns no mobile navigation listener', async ({ page }) => {
  await boot(page, { width: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await metrics(page)).toMatchObject({ shellRequests: 0, bindAdds: 0, navCallbacks: 0, sameNavRoot: false, guard: false });
});
